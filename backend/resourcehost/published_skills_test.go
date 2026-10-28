package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestPublishedSkillSourceUsesClosedPackageAndNeverLegacyOwner(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	ctx := context.Background()
	uri := "skill://example/sample"
	document := "---\nname: sample\ndescription: Review synthetic examples\n---\nExact closed document."
	raw, err := json.Marshal(map[string]any{"schemaVersion": 1, "document": document, "files": map[string]string{"refs/note.txt": "supporting bytes"}})
	require.NoError(t, err)
	state := source.states[uri]
	state.DefinitionBytes, state.Definition = raw, raw
	state.ContentFingerprint = identity.ContentFingerprint(raw)
	source.states[uri] = state
	skills := &NativeSkillSource{Gateway: g}
	names, err := skills.Names(ctx)
	require.NoError(t, err)
	require.Equal(t, []string{"catalog"}, names, "generic skill delivery must recognize a locally registered owner")
	options, err := skills.Options(ctx, "catalog")
	require.NoError(t, err)
	require.False(t, options.SkillDiscovery.Enabled)
	_, err = skills.Get(ctx, "", "catalog")
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	manifest, handled, err := skills.PublishedSkill(ctx, "catalog", uri)
	require.NoError(t, err)
	require.True(t, handled)
	require.Equal(t, uri+"/SKILL.md", manifest.Skill.Uri)
	entry, err := skills.ReadSkillResource(ctx, "catalog", manifest.Skill.Uri)
	require.NoError(t, err)
	require.Equal(t, document, entry.Contents[0].Text)
	file, err := skills.ReadSkillResource(ctx, "catalog", uri+"/refs/note.txt")
	require.NoError(t, err)
	require.Equal(t, "supporting bytes", file.Contents[0].Text)
	require.EqualValues(t, 1, source.gets.Load(), "warm projected reads must not reread immutable bodies")
	_, err = skills.ReadSkillResource(ctx, "unrelated", uri+"/refs/note.txt")
	require.ErrorIs(t, err, identity.ErrResourceDenied, "another connection cannot bypass a claimed namespace")
	_, _, err = skills.CatalogScope(ctx, "", []string{"catalog"})
	require.NoError(t, err)
	require.Zero(t, trap.calls)
	// Cohort admission fences cached pages independently of the configured
	// discovery participants and never enables the native extension.
	scope, _, err := skills.CatalogScope(ctx, "", nil)
	require.NoError(t, err)
	source.admission = "session-2"
	fresh, _, err := skills.CatalogScope(ctx, "", nil)
	require.NoError(t, err)
	require.NotEqual(t, scope, fresh)
	source.denied = true
	_, _, err = skills.PublishedSkill(ctx, "catalog", uri)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	_, err = skills.ReadSkillResource(ctx, "catalog", uri+"/refs/note.txt")
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	_, _, err = skills.CatalogScope(ctx, "", nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Zero(t, trap.calls)
}

func TestCompilePublishedSkillPreservesVersionedUTF8AndRetainedNativeBytes(t *testing.T) {
	document := "---\nname: sample\ndescription: Synthetic package\n---\nExact document."
	for _, value := range []any{
		map[string]any{"schemaVersion": 1, "document": document, "files": map[string]string{"note.txt": "hello"}},
		struct {
			Document []byte            `json:"document"`
			Files    map[string][]byte `json:"files"`
		}{[]byte(document), map[string][]byte{"note.txt": []byte("hello")}},
	} {
		raw, err := json.Marshal(value)
		require.NoError(t, err)
		compiled, err := compilePublishedSkill(context.Background(), "skill://example/sample", raw)
		require.NoError(t, err)
		require.Equal(t, "sample", compiled.Metadata().Frontmatter["name"])
	}
	for _, files := range []map[string]string{{"../escape": "x"}, {"SKILL.md": "replacement"}, {"refs/%2e%2e/x": "x"}} {
		raw, err := json.Marshal(map[string]any{"schemaVersion": 1, "document": document, "files": files})
		require.NoError(t, err)
		_, err = compilePublishedSkill(context.Background(), "skill://example/sample", raw)
		require.Error(t, err)
	}
}
