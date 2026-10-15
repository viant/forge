// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
)

type deliveryToolExecutor struct{ arguments map[string]interface{} }

func (e *deliveryToolExecutor) Execute(_ context.Context, _ string, inputs map[string]interface{}) (string, error) {
	e.arguments = inputs
	return `{"result":{"items":[{"id":7}]}}`, nil
}

type deliveryToolStore struct{ descriptor *dsproto.DataSource }

func (s deliveryToolStore) Get(string) (*dsproto.DataSource, bool) { return s.descriptor, true }

func TestOrdinaryUnpaginatedToolDeliveryDoesNotStartPrimitiveReadMemo(t *testing.T) {
	executor := &deliveryToolExecutor{}
	descriptor := &dsproto.DataSource{ID: "records", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "result.items"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "ordinary", Method: "list"}}
	starts := 0
	service := datasource.New(datasource.Options{Store: deliveryToolStore{descriptor}, Executor: executor, ReadSequence: func(context.Context) (context.Context, func() error, error) {
		starts++
		t.Fatal("ordinary tool sources cannot require primitive namespace/Datly metadata")
		return nil, nil, nil
	}})
	result, err := service.Fetch(context.Background(), "records", map[string]interface{}{"filter": "owned"}, datasource.FetchOptions{})
	require.NoError(t, err)
	require.Len(t, result.Rows, 1)
	require.Zero(t, starts)
	require.Equal(t, map[string]interface{}{"filter": "owned"}, executor.arguments, "delivery cannot invent pagination arguments or rewrite filters")
	require.Equal(t, "result.items", descriptor.Selectors.Data)
}
