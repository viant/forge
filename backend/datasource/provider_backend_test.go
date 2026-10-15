// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

func TestProviderOwnedDatlyCannotUseGenericExecutorOrMissingHostProof(t *testing.T) {
	for _, scenario := range []string{"missing-callback", "missing-host-proof", "ownership-downgrade"} {
		t.Run(scenario, func(t *testing.T) {
			store := datasource.NewMemoryStore()
			backend := &dsproto.Backend{Kind: dsproto.BackendDatly, Ownership: "provider", Method: "windows/datasource", Component: &windowprotocol.ComponentBinding{ID: "component", Kind: "linked", Revision: "1", ContentFingerprint: identity.ContentFingerprint([]byte("code")), SchemaFingerprint: identity.ContentFingerprint([]byte("schema"))}}
			if scenario == "ownership-downgrade" {
				backend.Kind = dsproto.BackendMCPTool
				backend.Service = "guessed"
			}
			store.Put(&dsproto.DataSource{ID: "source", Backend: backend})
			calls := 0
			options := datasource.Options{Store: store, Executor: pinExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
				calls++
				return `{"data":[]}`, nil
			})}
			if scenario != "missing-callback" {
				options.ProviderExecute = func(context.Context, *dsproto.DataSource, map[string]interface{}) (json.RawMessage, error) {
					calls++
					return json.RawMessage(`{"data":[]}`), nil
				}
			}
			result, err := datasource.New(options).Fetch(context.Background(), "source", nil, datasource.FetchOptions{})
			require.Error(t, err)
			require.Nil(t, result)
			require.Zero(t, calls, "a provider-owned descriptor cannot bypass original host/provider proofs")
		})
	}
}
