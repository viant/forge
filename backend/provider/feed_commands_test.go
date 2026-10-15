// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"sync/atomic"
	"testing"
	"time"
)

type feedCanonicalCatalog struct{}

func (feedCanonicalCatalog) UsesResourceResolution() bool { return true }
func (feedCanonicalCatalog) List(context.Context, *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	return &WindowDefinitionListOutput{}, nil
}
func (feedCanonicalCatalog) Get(context.Context, *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	return nil, identity.ErrResourceDenied
}

type feedOwnerKey struct{}

func feedOwnershipFixture(t *testing.T) (*Service, context.Context, *atomic.Bool) {
	t.Helper()
	revoked := new(atomic.Bool)
	resolver := func(ctx context.Context) (NamespaceIdentity, error) {
		if revoked.Load() {
			return NamespaceIdentity{}, identity.ErrResourceDenied
		}
		owner, _ := ctx.Value(feedOwnerKey{}).(string)
		if owner == "" {
			return NamespaceIdentity{}, identity.ErrResourceDenied
		}
		return NamespaceIdentity{Namespace: owner, ValidUntil: time.Now().Add(time.Minute)}, nil
	}
	svc := NewService(&Config{WindowDefinitions: feedCanonicalCatalog{}, NamespaceResolver: resolver})
	ctx := requestctx.WithConversationID(context.WithValue(context.Background(), feedOwnerKey{}, "alice"), "conv-a")
	require.NotNil(t, svc.Hub().registerHTTPClient("alice", "client-a", ctx))
	svc.Hub().setSnapshot("alice", "client-a", json.RawMessage(`{"conversationId":"conv-a","windows":[]}`))
	return svc, ctx, revoked
}
func TestCanonicalConversationFeedCommandsDoNotBorrowWindowPins(t *testing.T) {
	svc, ctx, _ := feedOwnershipFixture(t)
	for _, method := range []string{"ui.feed.get", "ui.feed.update"} {
		params := map[string]any{"conversationId": "conv-a", "feedId": "media-plan", "dataSourceRefs": []string{"editDraft"}}
		if method == "ui.feed.update" {
			params["operations"] = []any{map[string]any{"dataSourceRef": "editDraft", "op": "replace", "path": "/form/totalBudget", "value": 120000}}
		}
		worker := make(chan error, 1)
		go func() {
			poll, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			req, err := svc.Hub().dequeueCommand(poll, "alice", "client-a")
			if err == nil {
				var result json.RawMessage
				if method == "ui.feed.get" {
					result = json.RawMessage(`{"feedId":"media-plan","conversationId":"conv-a","dataSources":{"editDraft":{"form":{"totalBudget":120000},"collection":[],"selection":{}}}}`)
				} else {
					result = json.RawMessage(`{"ok":true}`)
				}
				svc.Hub().deliverResponse(&rpcResponse{ID: req.ID, OK: true, Result: result})
			}
			worker <- err
		}()
		output, err := svc.UICommand(ctx, &UICommandInput{ClientID: "client-a", Namespace: "alice", Method: method, Params: params})
		require.NoError(t, err)
		require.True(t, output.OK)
		require.NoError(t, <-worker)
	}
	require.Empty(t, svc.resourcePins, "conversation presentation creates no window authority")
	for _, method := range []string{"ui.datasource.refresh", "ui.control.setValue", "ui.window.hide", "ui.feed.print", "ui.feed.publish", "ui.feed.get.other"} {
		out, err := svc.UICommand(ctx, &UICommandInput{ClientID: "client-a", Method: method, Params: map[string]any{"conversationId": "conv-a", "feedId": "media-plan"}})
		require.Error(t, err)
		require.Nil(t, out)
	}
}
func TestCanonicalConversationFeedCommandsRejectForeignOwnershipAndChangedAttachment(t *testing.T) {
	svc, ctx, revoked := feedOwnershipFixture(t)
	cases := []struct {
		ctx                                     context.Context
		client, namespace, conversation, window string
	}{{ctx, "client-a", "alice", "conv-b", ""}, {requestctx.WithConversationID(ctx, "conv-b"), "client-a", "alice", "conv-b", ""}, {context.WithValue(ctx, feedOwnerKey{}, "bob"), "client-a", "bob", "conv-a", ""}, {ctx, "unknown-client", "alice", "conv-a", ""}, {ctx, "client-a", "bob", "conv-a", ""}, {ctx, "client-a", "alice", "conv-a", "chat/new"}, {context.WithValue(context.Background(), feedOwnerKey{}, "alice"), "client-a", "alice", "conv-a", ""}}
	for _, value := range cases {
		output, err := svc.UICommand(value.ctx, &UICommandInput{ClientID: value.client, Namespace: value.namespace, Method: "ui.feed.get", Params: map[string]any{"conversationId": value.conversation, "feedId": "media-plan", "windowId": value.window}})
		require.Error(t, err)
		require.Nil(t, output)
	}
	worker := make(chan error, 1)
	go func() {
		poll, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		req, err := svc.Hub().dequeueCommand(poll, "alice", "client-a")
		if err == nil {
			revoked.Store(true)
			svc.Hub().deliverResponse(&rpcResponse{ID: req.ID, OK: true, Result: json.RawMessage(`{"feedId":"media-plan"}`)})
		}
		worker <- err
	}()
	out, err := svc.UICommand(ctx, &UICommandInput{ClientID: "client-a", Method: "ui.feed.get", Params: map[string]any{"conversationId": "conv-a", "feedId": "media-plan"}})
	require.Error(t, err)
	require.Nil(t, out)
	require.NoError(t, <-worker)
}
func TestCanonicalConversationFeedCommandsRecheckConversationAfterClientResponse(t *testing.T) {
	svc, ctx, _ := feedOwnershipFixture(t)
	worker := make(chan error, 1)
	go func() {
		poll, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		req, err := svc.Hub().dequeueCommand(poll, "alice", "client-a")
		if err == nil {
			svc.Hub().setSnapshot("alice", "client-a", json.RawMessage(`{"conversationId":"conv-b","windows":[]}`))
			svc.Hub().deliverResponse(&rpcResponse{ID: req.ID, OK: true, Result: json.RawMessage(`{"feedId":"media-plan"}`)})
		}
		worker <- err
	}()
	out, err := svc.UICommand(ctx, &UICommandInput{ClientID: "client-a", Method: "ui.feed.get", Params: map[string]any{"conversationId": "conv-a", "feedId": "media-plan"}})
	require.Error(t, err)
	require.Nil(t, out)
	require.NoError(t, <-worker)
}
