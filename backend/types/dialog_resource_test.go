package types

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	"testing"
)

func TestStandaloneDialogRetainsNestedLookupMetadata(t *testing.T) {
	raw := json.RawMessage(`{"id":"picker","title":"Choose","dataSourceRef":"records","content":{"id":"form","items":[{"id":"choice","lookup":{"dialogId":"nested","dataSource":"options"}}]},"actions":[]}`)
	original := append([]byte(nil), raw...)
	dialog, err := DecodeDialogResource(1, raw)
	require.NoError(t, err)
	require.Equal(t, "picker", dialog.Id)
	encoded, err := json.Marshal(dialog)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"dialogId":"nested"`)
	require.Contains(t, string(encoded), `"dataSource":"options"`)
	require.Equal(t, original, []byte(raw))
	require.Equal(t, "dialogs", primitive.Plural("dialog"))
	require.Equal(t, "dialog", primitive.Kind("dialogs"))
	_, err = DecodeDialogResource(1, json.RawMessage(`{"id":"empty"}`))
	require.Error(t, err)
}
