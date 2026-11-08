package resource

import (
	"github.com/stretchr/testify/require"
	service "github.com/viant/forge/backend/provider"
	"testing"
)

type metadataOnlyCompositeLocal struct {
	service.WindowDefinitionCatalog
}

func (*metadataOnlyCompositeLocal) MetadataOnlyWindowList() bool { return true }

type legacyCompositeLocal struct {
	service.WindowDefinitionCatalog
}

func TestCompositePreservesMetadataOnlyDiscoveryContract(t *testing.T) {
	require.True(t, (&CompositeWindowCatalog{Local: &metadataOnlyCompositeLocal{}}).MetadataOnlyWindowList())
	require.True(t, (&CompositeWindowCatalog{}).MetadataOnlyWindowList())
	require.False(t, (&CompositeWindowCatalog{Local: &legacyCompositeLocal{}}).MetadataOnlyWindowList())
}
