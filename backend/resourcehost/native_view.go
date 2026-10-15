// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	view "github.com/viant/forge/backend/window/view"
	"gopkg.in/yaml.v3"
)

// attachNativeWindowViewMetadata captures the original model-facing descriptor
// inside the admitted owning window during native producer startup.
func attachNativeWindowViewMetadata(ctx context.Context, r *ExtensionReader, file string, raw json.RawMessage) (json.RawMessage, error) {
	source, err := r.ReadFile(ctx, file)
	if err != nil {
		return nil, err
	}
	var spec view.Spec
	var node yaml.Node
	if err = yaml.Unmarshal(source, &node); err != nil {
		return nil, err
	}
	if err = resolveNativeAuthoredImports(ctx, r, file, &node); err != nil {
		return nil, err
	}
	if err = node.Decode(&spec); err != nil {
		return nil, err
	}
	if spec.ID == "" || spec.WindowKey == "" {
		return raw, nil
	}
	var envelope map[string]json.RawMessage
	if err = json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	envelope["viewMetadata"], err = json.Marshal(spec)
	if err != nil {
		return nil, err
	}
	return json.Marshal(envelope)
}
