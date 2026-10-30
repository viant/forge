package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestProjectMenuTargetsEmptyUnknownAndAmbiguousActions(t *testing.T) {
	ctx := context.Background()
	for _, source := range []string{
		`{"schemaVersion":1,"applications":[]}`,
		`{"schemaVersion":1,"applications":[{"menus":[{"disabled":true,"title":"Unavailable"}]}]}`,
		`{"schemaVersion":1,"applications":[{"menus":[{"action":{"resourceUri":"window://synthetic/absent"},"children":[{"action":{"resourceUri":"window://synthetic/allowed"}}]}]}]}`,
	} {
		projection, err := ProjectMenuTargets(ctx, json.RawMessage(source), map[string]bool{"window://synthetic/allowed": true})
		require.NoError(t, err)
		require.Nil(t, projection)
	}
	for _, source := range []string{
		`{"schemaVersion":1,"applications":[{"menus":[{"action":{"windowId":"synthetic"}}]}]}`,
		`{"schemaVersion":1,"applications":[{"menus":[{"action":{"resourceUri":"not-a-resource"}}]}]}`,
		`{"schemaVersion":1,"applications":[{"menus":[{"action":{"resourceUri":"window://synthetic/absent"},"children":[{"action":{"windowId":"synthetic"}}]}]}]}`,
	} {
		require.NoError(t, ValidateMenu(1, json.RawMessage(source)), "general host action validation remains compatible")
		_, err := ProjectMenuTargets(ctx, json.RawMessage(source), nil)
		require.ErrorContains(t, err, "resourceUri or resourceURI")
		require.ErrorContains(t, err, "before publication")
	}
	_, err := ProjectMenuTargets(ctx, json.RawMessage(`{"schemaVersion":1,"applications":[{"menus":[{"action":{"resourceUri":"window://synthetic/allowed","resourceURI":"window://synthetic/allowed"}}]}]}`), map[string]bool{"window://synthetic/allowed": true})
	require.Error(t, err)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, err = ProjectMenuTargets(canceled, json.RawMessage(`{"schemaVersion":1,"applications":[]}`), nil)
	require.ErrorIs(t, err, context.Canceled)
}

func TestReleasedLegacyMenuNormalizesOnlyDerivedVersion(t *testing.T) {
	ctx := context.Background()
	legacy := json.RawMessage(`{"applications":[{"id":"app","menus":[{"id":"allowed","action":{"resourceURI":"window://synthetic/allowed","parameters":{"large":9007199254740993}}},{"id":"denied-group","children":[{"action":{"resourceUri":"window://synthetic/denied"}}]}]}]}`)
	original := bytes.Clone(legacy)
	sourceHash := identity.ContentFingerprint(legacy)
	require.NoError(t, ValidateMenuTargets(ctx, legacy))
	projection, err := ProjectMenuTargets(ctx, legacy, map[string]bool{"window://synthetic/allowed": true})
	require.NoError(t, err)
	require.NotNil(t, projection)
	require.NoError(t, ValidateMenu(1, projection.DefinitionBytes))
	require.Contains(t, string(projection.DefinitionBytes), `"schemaVersion":1`)
	require.NotContains(t, string(projection.DefinitionBytes), "denied-group")
	require.Contains(t, string(projection.DefinitionBytes), "9007199254740993")
	require.Equal(t, original, []byte(legacy))
	require.Equal(t, sourceHash, identity.ContentFingerprint(legacy))
	require.NotEqual(t, sourceHash, projection.ContentFingerprint)
	projection, err = ProjectMenuTargets(ctx, legacy, nil)
	require.NoError(t, err)
	require.Nil(t, projection)
	require.NoError(t, ValidateMenuTargets(ctx, json.RawMessage(`{"applications":[]}`)))
	for _, version := range []string{`0`, `2`, `null`, `"1"`} {
		raw := json.RawMessage(`{"schemaVersion":` + version + `,"applications":[]}`)
		require.Error(t, ValidateMenuTargets(ctx, raw), "explicit version must remain authoritative")
		_, err := ProjectMenuTargets(ctx, raw, nil)
		require.Error(t, err)
	}
}
