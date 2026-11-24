// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func projectIndependentDatasourceTransport(window *types.Window, references map[string]primitive.DataSourceReference) {
	for id := range references {
		entry := window.DataSource[id]
		if entry.DataSourceRef != "" {
			continue // Local views retain row-relative selectors and no transport.
		}
		entry.Service = &types.Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/" + url.PathEscape(id) + "/fetch", Method: "POST"}
		entry.Selectors = &types.Selectors{Data: "rows", DataInfo: "dataInfo", Metrics: "metrics"}
		window.DataSource[id] = entry
	}
}

// ErrUnsupportedWindowTransport rejects unregistered browser HTTP transports.
var ErrUnsupportedWindowTransport = errors.New("window datasource HTTP transport requires a host-registered native source")

type nativeWindowSource struct {
	provider string
	uri      string
}

// RegisterNativeHTTPWindows is startup-only host configuration. Provider payloads
// cannot register transports. Generations are checked by Get; this binding names
// the configured connection, provider identity and exact canonical window URI.
func (c *WindowCatalog) RegisterNativeHTTPWindows(connection Connection, uris []string) error {
	if c == nil || connection.Name == "" || connection.ProviderIdentity == "" {
		return fmt.Errorf("native HTTP windows require an explicit connection and provider")
	}
	for _, value := range uris {
		uri, err := identity.ParseResourceURI(value)
		if err != nil || uri.Kind != "window" || uri.String() != value {
			return fmt.Errorf("invalid native HTTP window binding")
		}
	}
	if c.nativeHTTPWindows == nil {
		c.nativeHTTPWindows = make(map[nativeWindowSource]map[string]bool)
	}
	for _, value := range uris {
		key := nativeWindowSource{connection.ProviderIdentity, value}
		if c.nativeHTTPWindows[key] == nil {
			c.nativeHTTPWindows[key] = make(map[string]bool)
		}
		c.nativeHTTPWindows[key][connection.Name] = true
	}
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
		if entry.DataSourceRef != "" {
			// Local evaluation must not bypass the transport admission policy.
			if !nativeHTTP && (entry.Service != nil || descriptor.Service != nil) {
				return fmt.Errorf("%w: datasource %q", ErrUnsupportedWindowTransport, id)
			}
			continue // Only the aggregate owner consumes the host fetch envelope.
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
