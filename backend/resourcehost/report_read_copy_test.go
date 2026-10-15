package resource

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"testing"
	"time"
)

func TestSelectedReadIdentityNormalizesOnlyDeadlineTimezone(t *testing.T) {
	pin := identity.ResolvedResource{URI: "report://test/a", ValidUntil: time.Date(2026, 10, 11, 17, 0, 0, 123, time.FixedZone("fixture", -7*3600))}
	utc := pin
	utc.ValidUntil = pin.ValidUntil.UTC()
	conn := Connection{Name: "provider", ProviderIdentity: "owner", Generation: 1}
	require.Equal(t, selectionResourceID(conn, pin), selectionResourceID(conn, utc))
	require.Equal(t, "fixture", pin.ValidUntil.Location().String())
	utc.ValidUntil = utc.ValidUntil.Add(-time.Nanosecond)
	require.NotEqual(t, selectionResourceID(conn, pin), selectionResourceID(conn, utc))
}
func TestDetachedGetPreservesBytesFlagsAndIsolatesAllMutableCarriers(t *testing.T) {
	original := primitive.GetResult{Resource: &primitive.ResourceState{Definition: json.RawMessage("{ \"number\": 123 }"), DefinitionBytes: []byte("exact"), Dependencies: []primitive.Dependency{{URI: "datasource://test/a"}}, Replay: true}, ResolvedResource: &identity.ResolvedResource{AuthorityBinding: "original"}, ExecutionProof: &primitive.ExecutionProof{Token: "proof", Resource: identity.ResolvedResource{AuthorityBinding: "proof-original"}}, MenuProjection: &primitive.MenuProjection{DefinitionBytes: []byte("navigation")}}
	copy, err := detachedGet(&original)
	require.NoError(t, err)
	require.Equal(t, original, copy)
	copy.Resource.Definition[0] = 'x'
	copy.Resource.DefinitionBytes[0] = 'x'
	copy.Resource.Dependencies[0].URI = "foreign"
	copy.Resource.Replay = false
	copy.ResolvedResource.AuthorityBinding = "foreign"
	copy.ExecutionProof.Resource.AuthorityBinding = "foreign"
	copy.MenuProjection.DefinitionBytes[0] = 'x'
	require.Equal(t, "{ \"number\": 123 }", string(original.Resource.Definition))
	require.Equal(t, "exact", string(original.Resource.DefinitionBytes))
	require.Equal(t, "datasource://test/a", original.Resource.Dependencies[0].URI)
	require.True(t, original.Resource.Replay)
	require.Equal(t, "original", original.ResolvedResource.AuthorityBinding)
	require.Equal(t, "proof-original", original.ExecutionProof.Resource.AuthorityBinding)
	require.Equal(t, "navigation", string(original.MenuProjection.DefinitionBytes))
}
