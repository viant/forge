package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

func TestWindowEnvelopeExplicitViewMetadataPreservesStrictSchema(t *testing.T) {
	root, bindings := nativeWindowFixture(t)
	defs, err := SnapshotWindowDefinitions(context.Background(), root, bindings, nil)
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, defs)
	require.NoError(t, err)
	uri := snapshot.definitions[0].URI
	parsed, err := identity.ParseResourceURI(uri)
	require.NoError(t, err)
	candidates, err := snapshot.Candidates(context.Background(), parsed)
	require.NoError(t, err)
	raw, err := snapshot.ReadCandidate(context.Background(), parsed, candidates[0])
	require.NoError(t, err)
	var envelope map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(raw, &envelope))
	envelope["viewMetadata"] = json.RawMessage(`{"id":"original","windowKey":"original","quickSearch":{"dataSourceRef":"records","field":"Name"},"resourceURI":"window://foreign/ignored"}`)
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	require.NoError(t, ValidateWindowBundle(2, raw))
	envelope["undeclaredAuthority"] = json.RawMessage(`{"tenant":"forged"}`)
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	require.Error(t, ValidateWindowBundle(2, raw), "known view descriptor field never relaxes other unknown window-envelope fields")
}
