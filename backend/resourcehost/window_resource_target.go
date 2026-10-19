package resource

import (
	"context"
	"encoding/json"

	"github.com/viant/forge/backend/requestctx"
	"github.com/viant/forge/backend/types"
	mcpclient "github.com/viant/mcp/client"
)

const windowTargetExtension = "io.viant/window/target"

// Only presentation inputs travel to a resource server. Host selection tokens,
// dependency pins and execution proofs never become authored target metadata.
func presentationWindowTarget(ctx context.Context) *types.WindowTarget {
	selected, ok := requestctx.WindowTargetFromContext(ctx)
	if !ok {
		return nil
	}
	target, err := (types.WindowTarget{Platform: selected.Platform, FormFactor: selected.FormFactor, Surface: selected.Surface, Capabilities: selected.Capabilities}).Normalize()
	if err != nil {
		return nil
	}
	if target.Platform == "" && target.FormFactor == "" && target.Surface == "" && len(target.Capabilities) == 0 {
		return nil
	}
	return &target
}

func supportsWindowTarget(ctx context.Context, client mcpclient.Interface) bool {
	initialized, err := client.Initialize(ctx)
	if err != nil || initialized == nil {
		return false
	}
	raw, err := json.Marshal(initialized.Capabilities.Extensions[windowTargetExtension])
	if err != nil {
		return false
	}
	var capability struct {
		SchemaVersion int `json:"schemaVersion"`
	}
	return json.Unmarshal(raw, &capability) == nil && capability.SchemaVersion == 1
}
