// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

// NativeComponentTransport is the deprecated client-bound component API.
// It is retained only so legacy callers receive an explicit migration error.
type NativeComponentTransport interface {
	ObserveNativeComponent(context.Context, string, string) (windowprotocol.ComponentBinding, error)
	ExecuteNativeComponent(context.Context, string, string, windowprotocol.ComponentBinding, map[string]interface{}) (json.RawMessage, error)
}
type NativeMCPComponentDispatcher struct{}

// Deprecated: MCP wire component pins are unsupported. A pinned workflow must
// use provider-owned resource/datasource resolution and its declared fetch API.
func NewNativeMCPComponentDispatcher(NativeComponentTransport, []string) (*NativeMCPComponentDispatcher, error) {
	return nil, fmt.Errorf("client-bound MCP component transport is unsupported; use provider-owned resource/datasource execution")
}
func (d *NativeMCPComponentDispatcher) IsComponentProducer(string) bool { return false }
func (d *NativeMCPComponentDispatcher) ObserveComponent(context.Context, string, string, windowprotocol.ComponentBinding) (windowprotocol.ComponentBinding, error) {
	return windowprotocol.ComponentBinding{}, fmt.Errorf("client-bound MCP component transport is unsupported; use provider-owned resource/datasource execution")
}
func (d *NativeMCPComponentDispatcher) ExecuteComponent(context.Context, string, string, windowprotocol.ComponentBinding, map[string]interface{}) (json.RawMessage, error) {
	return nil, fmt.Errorf("client-bound MCP component transport is unsupported; use provider-owned resource/datasource execution")
}

var _ windowprotocol.ComponentDispatcher = (*NativeMCPComponentDispatcher)(nil)
