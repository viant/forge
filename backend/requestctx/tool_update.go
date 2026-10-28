package requestctx

import (
	"context"
	"encoding/json"
)

type toolUpdateKey struct{}

// ToolUpdateObserver receives explicitly requested, authorized intermediate
// output. Unlike progress, an update may contain data and can fail publication.
type ToolUpdateObserver func(json.RawMessage) error

func WithToolUpdates(ctx context.Context, observer ToolUpdateObserver) context.Context {
	return context.WithValue(ctx, toolUpdateKey{}, observer)
}
func HasToolUpdates(ctx context.Context) bool {
	observer, _ := ctx.Value(toolUpdateKey{}).(ToolUpdateObserver)
	return observer != nil
}
func EmitToolUpdate(ctx context.Context, value interface{}) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	observer, _ := ctx.Value(toolUpdateKey{}).(ToolUpdateObserver)
	if observer == nil {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return observer(raw)
}
