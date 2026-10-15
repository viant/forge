// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

// ErrUnsupportedWindowTransport rejects unregistered browser HTTP transports.
var ErrUnsupportedWindowTransport = errors.New("window datasource HTTP transport requires a host-registered native source")

// RegisterNativeHTTPWindows is startup-only host configuration. Provider payloads
// cannot register transports. Generations are checked by Get; this binding names
// the configured connection, provider identity and exact canonical window URI.
func (c *WindowCatalog) RegisterNativeHTTPWindows(connection Connection, uris []string) error {
	if c == nil || connection.Name == "" || connection.ProviderIdentity == "" {
		return fmt.Errorf("native HTTP windows require an explicit connection and provider")
	}
	connection.Generation = 0
	bindings := map[string]bool{}
	for _, value := range uris {
		uri, err := identity.ParseResourceURI(value)
		if err != nil || uri.Kind != "window" || uri.String() != value {
			return fmt.Errorf("invalid native HTTP window binding")
		}
		bindings[value] = true
	}
	if c.nativeHTTPWindows == nil {
		c.nativeHTTPWindows = map[Connection]map[string]bool{}
	}
	for uri := range c.nativeHTTPWindows[connection] {
		bindings[uri] = true
	}
	c.nativeHTTPWindows[connection] = bindings
	return nil
}

// Project declared backends onto the existing host proxy. The independently
// registered native source retains its HTTP service and selectors. The caller
// has already verified the selected definition, target and source pins.
func projectWindowDatasourceTransport(window *types.Window, descriptors map[string]json.RawMessage, nativeHTTP bool) error {
	for id, raw := range descriptors {
		entry, ok := window.DataSource[id]
		if !ok {
			return identity.ErrResourceDenied
		}
		var descriptor dsproto.DataSource
		if json.Unmarshal(raw, &descriptor) != nil {
			return identity.ErrResourceDenied
		}
		if descriptor.Backend == nil {
			if !nativeHTTP && (entry.Service != nil || descriptor.Service != nil) {
				return fmt.Errorf("%w: datasource %q", ErrUnsupportedWindowTransport, id)
			}
			continue
		}
		entry.Service = &types.Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/" + url.PathEscape(id) + "/fetch", Method: "POST"}
		entry.Selectors = &types.Selectors{Data: "rows", DataInfo: "dataInfo", Metrics: "metrics"}
		window.DataSource[id] = entry
	}
	return nil
}
