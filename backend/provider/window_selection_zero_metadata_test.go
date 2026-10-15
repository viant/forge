// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func TestSelectionIssueAndVerifyZeroMetadataRequiresCurrentAuthenticatedActor(t *testing.T) {
	ctx := context.Background()
	signer, err := identity.NewSelectionHMAC(make([]byte, 32))
	require.NoError(t, err)
	pin := identity.ResolvedResource{ProviderIdentity: "source", URI: "window://workspace/overview", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("captured"))}, AuthorityBinding: "source-binding"}
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "21", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Hour)}
	parameters := map[string]any{"selected": "original"}
	target := json.RawMessage(`{"platform":"web"}`)
	service := NewService(&Config{})
	service.ConfigureWindowSelectionEmitter(func(ctx context.Context, w *types.Window, p map[string]any) (*identity.SelectionBinding, error) {
		return signer.Bind(ctx, *w.Resource, target, actor, "original-instance", p)
	})
	window := &types.Window{Resource: &pin}
	issued, err := service.EmitWindowSelection(ctx, window, parameters)
	require.NoError(t, err)
	require.NotNil(t, issued.SelectionBinding)
	require.True(t, issued.Resource.ValidUntil.IsZero())
	require.NoError(t, signer.Verify(ctx, *issued.Resource, target, *issued.SelectionBinding, parameters, actor))
	foreign := actor
	foreign.Subject = "bob"
	require.Error(t, signer.Verify(ctx, pin, target, *issued.SelectionBinding, parameters, foreign))
	actor.ValidUntil = time.Now().Add(-time.Second)
	require.Error(t, signer.Verify(ctx, pin, target, *issued.SelectionBinding, parameters, actor))
	_, err = service.EmitWindowSelection(ctx, window, parameters)
	require.Error(t, err)
	actor = identity.VerifiedActor{PublicRead: true}
	_, err = service.EmitWindowSelection(ctx, window, parameters)
	require.Error(t, err, "public metadata does not grant authenticated selection signing")
}
