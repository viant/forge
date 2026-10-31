package primitive

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDocumentCarrierUsesDeclaredEncoding(t *testing.T) {
	for _, test := range []struct {
		version   int64
		raw, want string
	}{{1, `"YWJj"`, "YWJj"}, {0, `"YWJj"`, "abc"}, {1, `"Exact café Ω"`, "Exact café Ω"}} {
		got, err := (DocumentCarrier{SchemaVersion: test.version, Document: json.RawMessage(test.raw)}).Bytes()
		require.NoError(t, err)
		require.Equal(t, test.want, string(got))
	}
	for _, carrier := range []DocumentCarrier{{SchemaVersion: 2, Document: json.RawMessage(`"text"`)}, {SchemaVersion: 1, Document: json.RawMessage(`123`)}, {SchemaVersion: 0, Document: json.RawMessage(`"not base64!"`)}} {
		_, err := carrier.Bytes()
		require.Error(t, err)
	}
}
