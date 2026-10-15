// SPDX-License-Identifier: Apache-2.0
// Forge resource client pooling extracted from Viant Agently Core.
package manager

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/provider/contract"
)

func TestUnrelatedToolCatalogChangeDoesNotCancelResourceSnapshot(t *testing.T) {
	m, err := New(nil)
	require.NoError(t, err)
	ctx := context.Background()
	partition := m.WithCatalogSources(ctx, m.CatalogPartition(ctx, "alice", "intent"), []string{"intents"})
	index, err := m.VisibleCatalogInPartition(ctx, "alice:intents", partition, time.Now().Add(time.Minute), func(context.Context) ([]primitive.CatalogItem[json.RawMessage], error) {
		m.notifyCatalogChange("unrelated")
		return []primitive.CatalogItem[json.RawMessage]{{Name: "draft", Namespace: "workspace", URI: "intent://workspace/draft"}}, nil
	})
	require.NoError(t, err)
	require.NoError(t, m.CheckVisibleCatalog(ctx, index))

	m.notifyCatalogChange("intents")
	require.ErrorIs(t, m.CheckVisibleCatalog(ctx, index), primitive.ErrCatalogCursor)
}
