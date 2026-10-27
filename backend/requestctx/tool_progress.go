package requestctx

import (
	"context"
	"encoding/json"
)

type toolProgressKey struct{}

// ToolProgressObserver receives invocation-local metadata, never result rows.
// Producers serialize concurrent notifications before invoking the observer.
type ToolProgressObserver func(json.RawMessage)

func WithToolProgress(ctx context.Context, observer ToolProgressObserver) context.Context {
	return context.WithValue(ctx, toolProgressKey{}, observer)
}

// EmitToolProgress is a no-op unless the caller explicitly observes execution.
func EmitToolProgress(ctx context.Context, value interface{}) {
	observer, _ := ctx.Value(toolProgressKey{}).(ToolProgressObserver)
	if observer == nil || ctx.Err() != nil {
		return
	}
	raw, err := json.Marshal(value)
	if err == nil {
		observer(raw)
	}
}
