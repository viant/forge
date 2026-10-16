// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	view "github.com/viant/forge/backend/window/view"
)

// WindowViewReader reads original view descriptors from the same admitted
// window catalog snapshots. UI OPEN obtains the selected window freshly.
type WindowViewReader struct{ Gateway *Gateway }

func NewWindowViewReader(g *Gateway) *WindowViewReader { return &WindowViewReader{Gateway: g} }
func (r *WindowViewReader) LoadAll(ctx context.Context) ([]*view.Spec, error) {
	type metadata struct {
		ViewMetadata *view.Spec `json:"viewMetadata"`
	}
	rows, err := authoredPages[metadata](ctx, r.Gateway, "window")
	if err != nil {
		return nil, err
	}
	result := make([]*view.Spec, 0, len(rows))
	for _, row := range rows {
		spec := row.Definition.ViewMetadata
		if spec == nil || spec.ID == "" || spec.WindowKey == "" {
			continue
		}
		spec.ResourceURI = row.Resource.URI
		result = append(result, spec)
	}
	return result, nil
}
