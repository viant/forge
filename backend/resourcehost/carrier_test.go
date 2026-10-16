package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

func TestGatewayLosslessCarrierPreservesBytesAndRejectsTampering(t *testing.T) {
	p := provider("studio-a")
	p.definition = json.RawMessage("{\n  \"view\": {\"title\": \"Sales\"}, \"schemaVersion\": 2\n}\n")
	p.carrier = append([]byte(nil), p.definition...)
	p.projection = json.RawMessage(`{"schemaVersion":2,"view":{"title":"Sales"}}`)
	gateway, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	rows, e := gateway.List(context.Background(), "window", "")
	require.NoError(t, e)
	connection := rows[0].Connection
	ref := identity.ResourceRef{URI: rows[0].Resource.URI}
	result, e := gateway.Get(context.Background(), connection, ref, nil)
	require.NoError(t, e)
	require.Equal(t, []byte(p.definition), []byte(result.Resource.Definition))
	require.Equal(t, identity.ContentFingerprint(p.definition), result.ResolvedResource.ContentFingerprint)
	p.carrier = []byte(`{"schemaVersion":2,"view":{"title":"Forged"}}`)
	p.resourceChanged()
	result, e = gateway.Get(context.Background(), connection, ref, nil)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	require.Nil(t, result)
	p.carrier = append([]byte(nil), p.definition...)
	p.projection = json.RawMessage(`{"schemaVersion":2,"view":{"title":"Forged"}}`)
	p.resourceChanged()
	result, e = gateway.Get(context.Background(), connection, ref, nil)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	require.Nil(t, result)
	p.projection = nil
	p.carrier = nil
	p.resourceChanged()
	_, e = gateway.Get(context.Background(), connection, ref, nil)
	require.ErrorIs(t, e, identity.ErrResourceDenied) // JSON encoding compacts the source; no carrier means no exact-byte proof
	p.projection = json.RawMessage(`{"schemaVersion":2,"view":{"title":"Sales"}}`)
	result, e = gateway.Get(context.Background(), connection, ref, nil)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	require.Nil(t, result)
}
