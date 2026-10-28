// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"unicode/utf8"

	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
)

// NativeResource is an explicit startup-owned standard MCP document. Read
// returns captured source bytes, never a request-selected filesystem path.
type NativeResource struct {
	Metadata schema.Resource
	Read     func(context.Context) ([]byte, error)
	// OnFailure receives only fixed diagnostic labels, never request data or errors.
	OnFailure func(context.Context, NativeResourceFailure)
}

// NativeResourceFailure describes the stage and broad cause of a denied read.
// It deliberately excludes the actor, URI, document body and raw error.
type NativeResourceFailure struct {
	Stage    string
	Category string
}

func nativeResourceFailureCategory(ctx context.Context, err error) string {
	switch {
	case ctx != nil && ctx.Err() != nil:
		return "canceled"
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return "canceled"
	case errors.Is(err, identity.ErrResourceStale):
		return "stale"
	case errors.Is(err, identity.ErrResourceDenied):
		return "denied"
	default:
		return "other"
	}
}

func reportNativeResourceFailure(ctx context.Context, resource NativeResource, stage string, err error) {
	if resource.OnFailure == nil {
		return
	}
	// Diagnostics must not change the MCP result, including if a host callback fails.
	defer func() { _ = recover() }()
	resource.OnFailure(ctx, NativeResourceFailure{Stage: stage, Category: nativeResourceFailureCategory(ctx, err)})
}

func checkNativeResources(resources []NativeResource) error {
	if len(resources) > 4096 {
		return fmt.Errorf("native resource inventory exceeds bounds")
	}
	seen := map[string]bool{}
	for _, r := range resources {
		if r.Metadata.Uri == "" || r.Read == nil || seen[r.Metadata.Uri] {
			return fmt.Errorf("invalid native resource inventory")
		}
		seen[r.Metadata.Uri] = true
	}
	return nil
}
func (h *localMCPHandler) registerNativeResources() error {
	for _, resource := range h.provider.nativeResources {
		r := resource
		if err := h.Registry.RegisterResource(r.Metadata, func(ctx context.Context, request *schema.ReadResourceRequest) (*schema.ReadResourceResult, *jsonrpc.Error) {
			return h.readNativeResource(ctx, request, r)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *localMCPHandler) readNativeResource(ctx context.Context, request *schema.ReadResourceRequest, r NativeResource) (*schema.ReadResourceResult, *jsonrpc.Error) {
	denied := func(stage string, err error) (*schema.ReadResourceResult, *jsonrpc.Error) {
		reportNativeResourceFailure(ctx, r, stage, err)
		return nil, jsonrpc.NewInvalidParamsError("native resource unavailable", nil)
	}
	if request == nil || request.Params.Uri != r.Metadata.Uri {
		return denied("request", identity.ErrResourceDenied)
	}
	actor, err := h.provider.currentActor(ctx)
	if err != nil {
		return denied("current_actor", err)
	}
	raw, err := r.Read(ctx)
	if err != nil {
		return denied("read", err)
	}
	if err = h.provider.finishActor(ctx, actor); err != nil {
		return denied("finish_actor", err)
	}
	content := schema.ReadResourceResultContentsElem{Uri: r.Metadata.Uri, MimeType: r.Metadata.MimeType}
	if utf8.Valid(raw) {
		content.Text = string(raw)
	} else {
		content.Blob = base64.StdEncoding.EncodeToString(raw)
	}
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{content}}, nil
}
