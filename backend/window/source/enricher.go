package window

import (
	"context"
	"github.com/viant/forge/backend/types"
)

// WorkspaceWindowEnricher attaches host-owned extensions to a compiled window.
// Each load receives its own callback; no process-global workspace is used.
type WorkspaceWindowEnricher func(context.Context, *types.Window) error
