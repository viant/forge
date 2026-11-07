package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
)

type countedPublishedCatalog struct {
	*syntheticPublishedSource
	lists atomic.Int64
}

func (s *countedPublishedCatalog) List(ctx context.Context, kind, namespace string) ([]primitive.ResourceState, error) {
	s.lists.Add(1)
	return s.syntheticPublishedSource.List(ctx, kind, namespace)
}

func TestPublishedCatalogReusesPreparedIndexAndRefreshesGeneration(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	counted := &countedPublishedCatalog{syntheticPublishedSource: source}
	gateway.publishedMetadata[0].source = counted
	for i := 0; i < 500; i++ {
		uri := fmt.Sprintf("playbook://example/guide-%03d", i)
		source.states[uri] = primitive.ResourceState{URI: uri, Kind: "playbook", Namespace: "example", Name: fmt.Sprintf("guide-%03d", i), Description: "Synthetic summary", ContentFingerprint: source.states["playbook://example/sample"].ContentFingerprint}
	}
	query := CatalogQuery{Namespace: "example", Keywords: []string{"guide"}, Limit: 5}
	for i := 0; i < 25; i++ {
		page, err := ListPage[json.RawMessage](context.Background(), gateway, "playbook", query, false)
		require.NoError(t, err)
		require.Len(t, page.Items, 5)
		require.Equal(t, 500, page.Total)
	}
	require.EqualValues(t, 1, counted.lists.Load(), "requests must reuse the existing index")
	require.Zero(t, source.gets.Load(), "summary discovery must not fetch documents")
	require.Zero(t, trap.calls, "preloaded sources require no remote metadata")

	source.admission = "generation-2"
	delete(source.states, "playbook://example/guide-000")
	page, err := ListPage[json.RawMessage](context.Background(), gateway, "playbook", query, false)
	require.NoError(t, err)
	require.Equal(t, 499, page.Total)
	require.EqualValues(t, 2, counted.lists.Load())
	source.denied = true
	page, err = ListPage[json.RawMessage](context.Background(), gateway, "playbook", query, false)
	require.NoError(t, err)
	require.Empty(t, page.Items, "revocation cannot reuse earlier visibility")
}
