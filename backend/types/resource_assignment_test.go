package types

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestWindowPreservesAuthoredResourceLinks(t *testing.T) {
	source := []byte("windowKey: example\nresources:\n  dataSources: [orders, ../shared/options]\n  dialogs: [picker]\n  models: [record]\n  schemas: [form]\n  resourceModels: [draft]\nview:\n  content: {id: root}\n")
	var window Window
	require.NoError(t, yaml.Unmarshal(source, &window))
	require.Equal(t, []string{"orders", "../shared/options"}, window.Resources.DataSources)
	data, err := json.Marshal(window)
	require.NoError(t, err)
	var restored Window
	require.NoError(t, json.Unmarshal(data, &restored))
	require.Equal(t, window.Resources, restored.Resources)
	require.Empty(t, restored.DataSource, "declaring references must not hydrate definitions")
	require.Empty(t, restored.Dialogs, "declaring dialogs must not embed their bodies")
	data, err = yaml.Marshal(restored)
	require.NoError(t, err)
	var yamlCopy Window
	require.NoError(t, yaml.Unmarshal(data, &yamlCopy))
	require.Equal(t, window.Resources, yamlCopy.Resources)
	normalized := window.Resources.Normalized()
	normalized.DataSources[0] = "changed"
	require.Equal(t, []string{"orders", "../shared/options"}, window.Resources.DataSources)
}
