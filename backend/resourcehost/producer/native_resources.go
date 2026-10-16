// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"encoding/base64"
	"fmt"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	"unicode/utf8"
)

// NativeResource is an explicit startup-owned standard MCP document. Read
// returns captured source bytes, never a request-selected filesystem path.
type NativeResource struct {
	Metadata schema.Resource
	Read     func(context.Context) ([]byte, error)
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
			if request == nil || request.Params.Uri != r.Metadata.Uri {
				return nil, jsonrpc.NewInvalidParamsError("native resource unavailable", nil)
			}
			actor, err := h.provider.currentActor(ctx)
			if err != nil {
				return nil, jsonrpc.NewInvalidParamsError("native resource unavailable", nil)
			}
			raw, err := r.Read(ctx)
			if err == nil {
				err = h.provider.finishActor(ctx, actor)
			}
			if err != nil {
				return nil, jsonrpc.NewInvalidParamsError("native resource unavailable", nil)
			}
			content := schema.ReadResourceResultContentsElem{Uri: r.Metadata.Uri, MimeType: r.Metadata.MimeType}
			if utf8.Valid(raw) {
				content.Text = string(raw)
			} else {
				content.Blob = base64.StdEncoding.EncodeToString(raw)
			}
			return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{content}}, nil
		}); err != nil {
			return err
		}
	}
	return nil
}
