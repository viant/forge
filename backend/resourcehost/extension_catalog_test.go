package resource

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

func TestExtensionEntryPredicateDoesNotPublishSupportingFiles(t *testing.T) {
	root := t.TempDir()
	extensionWrite(t, root, "playbooks/review.md", "declared-root")
	extensionWrite(t, root, "playbooks/README.md", "support")
	extensionWrite(t, root, "playbooks/references/request.user.md", "support")
	var inspected []string
	directory := ExtensionDirectory{Kind: "playbook", Namespace: "workspace", Directory: "playbooks", FormatVersion: 1, Suffixes: []string{".md"}, Load: extensionJSON,
		IncludeFile: func(ctx context.Context, reader *ExtensionReader, file string) (bool, error) {
			inspected = append(inspected, file)
			raw, err := reader.ReadFile(ctx, file)
			return string(raw) == "declared-root", err
		}}
	definitions, err := SnapshotExtensionDefinitions(context.Background(), root, []ExtensionDirectory{directory})
	require.NoError(t, err)
	require.Len(t, inspected, 3)
	require.Len(t, definitions, 1)
	require.Equal(t, "playbook://workspace/review", definitions[0].URI)
	invalid := errors.New("declared root is invalid")
	directory.IncludeFile = func(context.Context, *ExtensionReader, string) (bool, error) { return false, invalid }
	_, err = SnapshotExtensionDefinitions(context.Background(), root, []ExtensionDirectory{directory})
	require.ErrorIs(t, err, invalid)
}

func extensionWrite(t *testing.T, root, name, data string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(filepath.Join(root, name)), 0700))
	require.NoError(t, os.WriteFile(filepath.Join(root, name), []byte(data), 0600))
}
func extensionJSON(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
	raw, err := reader.ReadFile(ctx, file)
	return json.RawMessage(raw), err
}
func extensionPolicy(_ context.Context, a identity.VerifiedActor, _ identity.ResourceURI, _ string) (identity.ResourceRevisionPolicy, error) {
	return localFixturePolicy{actor: a}, nil
}
func TestExtensionInventoryRecursiveNamespaceAndCurrentBytes(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	extensionWrite(t, root, "extension/templates/campaign/detail.yaml", `{"native":"first"}`)
	extensionWrite(t, root, "extension/templates/root.yml", `{"native":"root"}`)
	extensionWrite(t, root, "extension/skills/nested/package/SKILL.md", `{"native":"skill"}`)
	directories := []ExtensionDirectory{
		{Kind: "template", Namespace: "platform", Directory: "extension/templates", FormatVersion: 1, Load: extensionJSON},
		{Kind: "skill", Namespace: "users", Directory: "extension/skills", FormatVersion: 1, Suffixes: []string{"/SKILL.md"}, Load: extensionJSON},
	}
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "team", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Minute)}
	config := LocalConfig{Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Validators: map[string]LocalResourceValidator{"template": func(_ int64, raw json.RawMessage) error { require.True(t, json.Valid(raw)); return nil }, "skill": func(_ int64, raw json.RawMessage) error { return nil }}}
	provider, err := NewInternalProvider(ctx, root, directories, extensionPolicy, config)
	require.NoError(t, err)
	namespaces, err := provider.NamespaceList(ctx, primitive.NamespaceListRequest{})
	require.NoError(t, err)
	require.Equal(t, "internal", namespaces.ProviderIdentity)
	require.Equal(t, []primitive.Namespace{{Name: "platform", Kinds: []string{"template"}}, {Name: "users", Kinds: []string{"skill"}}}, namespaces.Namespaces)
	got, err := provider.Get(ctx, "template", primitive.GetRequest{URI: "template://platform/campaign/detail"})
	require.NoError(t, err)
	require.JSONEq(t, `{"native":"first"}`, string(got.Resource.Definition))
	extensionWrite(t, root, "extension/templates/campaign/detail.yaml", `{"native":"second"}`)
	next, err := provider.Get(ctx, "template", primitive.GetRequest{URI: "template://platform/campaign/detail"})
	require.NoError(t, err)
	require.NotEqual(t, got.ResolvedResource.ContentFingerprint, next.ResolvedResource.ContentFingerprint)
	require.JSONEq(t, `{"native":"second"}`, string(next.Resource.Definition))
	require.Equal(t, identity.WorkingCandidate, next.ResolvedResource.Kind)
	require.Empty(t, next.ResolvedResource.Revision)
	require.Equal(t, "skill://users/nested/package", localProviderBinding(provider, "skill://users/nested/package").URI)
}
func TestExtensionInventoryCollisionsAndUnsafePaths(t *testing.T) {
	ctx := context.Background()
	tests := []struct {
		name      string
		prepare   func(*testing.T, string)
		directory ExtensionDirectory
	}{
		{"same logical name", func(t *testing.T, r string) {
			extensionWrite(t, r, "definitions/a.yaml", `{}`)
			extensionWrite(t, r, "definitions/a.yml", `{}`)
		}, ExtensionDirectory{Kind: "template", Namespace: "platform", Directory: "definitions", FormatVersion: 1, Load: extensionJSON}},
		{"symlink", func(t *testing.T, r string) {
			extensionWrite(t, r, "definitions/a.yaml", `{}`)
			require.NoError(t, os.Symlink("a.yaml", filepath.Join(r, "definitions/b.yaml")))
		}, ExtensionDirectory{Kind: "template", Namespace: "platform", Directory: "definitions", FormatVersion: 1, Load: extensionJSON}},
		{"traversal", func(t *testing.T, r string) {}, ExtensionDirectory{Kind: "template", Namespace: "platform", Directory: "../definitions", FormatVersion: 1, Load: extensionJSON}},
		{"bad namespace", func(t *testing.T, r string) {}, ExtensionDirectory{Kind: "template", Namespace: "../platform", Directory: "definitions", FormatVersion: 1, Load: extensionJSON}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			test.prepare(t, root)
			_, err := ExtensionBindings(ctx, root, []ExtensionDirectory{test.directory}, extensionPolicy)
			require.Error(t, err)
		})
	}
}
func TestExtensionReaderRejectsEscapeAndStaleCandidate(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	outside := t.TempDir()
	extensionWrite(t, root, "definitions/a.yaml", `{"a":1}`)
	extensionWrite(t, outside, "secret.yaml", `{"secret":true}`)
	bindings, err := ExtensionBindings(ctx, root, []ExtensionDirectory{{Kind: "template", Namespace: "platform", Directory: "definitions", FormatVersion: 1, Load: extensionJSON}}, extensionPolicy)
	require.NoError(t, err)
	actor := identity.VerifiedActor{ValidUntil: time.Now().Add(time.Minute)}
	resolver, err := bindings[0].Resolver(ctx, actor, "resource.get")
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(bindings[0].URI)
	candidates, err := resolver.Source.Candidates(ctx, uri)
	require.NoError(t, err)
	extensionWrite(t, root, "definitions/a.yaml", `{"a":2}`)
	_, err = resolver.Source.ReadCandidate(ctx, uri, candidates[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.NoError(t, os.Remove(filepath.Join(root, "definitions/a.yaml")))
	require.NoError(t, os.Symlink(filepath.Join(outside, "secret.yaml"), filepath.Join(root, "definitions/a.yaml")))
	_, err = resolver.Source.Candidates(ctx, uri)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	r, err := os.OpenRoot(root)
	require.NoError(t, err)
	defer r.Close()
	reader := &ExtensionReader{root: r}
	_, err = reader.ReadFile(ctx, "../secret.yaml")
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}

func TestInternalProviderRevocationDuringNativeLoad(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	extensionWrite(t, root, "windows/nested/screen.yaml", string(localWindowBytes(t)))
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "team", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Minute)}
	revoked := false
	reads := 0
	loader := func(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
		reads++
		raw, err := extensionJSON(ctx, reader, file)
		if reads >= 2 {
			revoked = true
		}
		return raw, err
	}
	config := LocalConfig{Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error {
		if revoked {
			return identity.ErrResourceDenied
		}
		return nil
	}, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error {
		if revoked {
			return identity.ErrResourceDenied
		}
		return nil
	}, Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle}}
	provider, err := NewInternalProvider(ctx, root, []ExtensionDirectory{{Kind: "window", Namespace: "platform", Directory: "windows", FormatVersion: 2, Load: loader}}, extensionPolicy, config)
	require.NoError(t, err)
	got, err := provider.Get(ctx, "window", primitive.GetRequest{URI: "window://platform/nested/screen"})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Nil(t, got)
	require.GreaterOrEqual(t, reads, 2)
}

func TestExtensionReaderRetainedDirectoriesStillReadFreshAndDenyRebinding(t *testing.T) {
	for _, scenario := range []string{"newbytes", "replacement", "symlink"} {
		t.Run(scenario, func(t *testing.T) {
			rootPath := t.TempDir()
			extensionWrite(t, rootPath, "definitions/nested/a.yaml", `{"version":1}`)
			root, err := os.OpenRoot(rootPath)
			require.NoError(t, err)
			defer root.Close()
			reader := &ExtensionReader{root: root}
			defer reader.close()
			first, err := reader.ReadFile(context.Background(), "definitions/nested/a.yaml")
			require.NoError(t, err)
			require.JSONEq(t, `{"version":1}`, string(first))
			switch scenario {
			case "newbytes":
				extensionWrite(t, rootPath, "definitions/nested/a.yaml", `{"version":2}`)
				next, err := reader.ReadFile(context.Background(), "definitions/nested/a.yaml")
				require.ErrorIs(t, err, identity.ErrResourceStale)
				require.Nil(t, next)
				fresh := &ExtensionReader{root: root}
				defer fresh.close()
				next, err = fresh.ReadFile(context.Background(), "definitions/nested/a.yaml")
				require.NoError(t, err)
				require.JSONEq(t, `{"version":2}`, string(next))
			case "replacement":
				require.NoError(t, os.Rename(filepath.Join(rootPath, "definitions/nested"), filepath.Join(rootPath, "definitions/old")))
				extensionWrite(t, rootPath, "definitions/nested/a.yaml", `{"version":2}`)
				raw, err := reader.ReadFile(context.Background(), "definitions/nested/a.yaml")
				require.ErrorIs(t, err, identity.ErrResourceStale)
				require.Nil(t, raw)
			case "symlink":
				require.NoError(t, os.Rename(filepath.Join(rootPath, "definitions/nested"), filepath.Join(rootPath, "definitions/old")))
				require.NoError(t, os.Symlink("old", filepath.Join(rootPath, "definitions/nested")))
				raw, err := reader.ReadFile(context.Background(), "definitions/nested/a.yaml")
				require.Error(t, err)
				require.Nil(t, raw)
				fresh := &ExtensionReader{root: root}
				defer fresh.close()
				_, err = fresh.ReadFile(context.Background(), "definitions/nested/a.yaml")
				require.ErrorIs(t, err, identity.ErrResourceDenied)
			}
		})
	}
}
