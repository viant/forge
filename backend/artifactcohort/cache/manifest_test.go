package cache

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

func TestManifestFileRestartScopeAndCorruption(t *testing.T) {
	ctx := context.Background()
	p := artifactcohort.NewPublisher()
	a, _, err := p.Publish(ctx, artifactcohort.RootRef{URI: "skill://team/guide", Kind: "skill", Version: 1}, json.RawMessage(`{"document":"published"}`), func(context.Context, json.RawMessage) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	policy := authz.Resource{Tenant: "tenant", Kind: "cohort", ID: "readers", Version: "logical"}
	m, err := p.ReplaceCatalog(ctx, []authz.Document{{Resource: policy, Revision: 1, Policies: map[string]authz.Policy{artifactcohort.PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}, []artifactcohort.Cohort{{Tenant: "tenant", Name: "readers", PolicyResource: policy, Roots: []artifactcohort.RootRef{a.Root}}}, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	store := FileManifestStore{Directory: t.TempDir()}
	if err = store.Save(ctx, "provider", "tenant", "account", m); err != nil {
		t.Fatal(err)
	}
	restarted := FileManifestStore{Directory: store.Directory}
	got, err := restarted.Load(ctx, "provider", "tenant", "account")
	if err != nil || got.Hash != m.Hash {
		t.Fatalf("restart: %v", err)
	}
	if _, err = restarted.Load(ctx, "different-provider", "tenant", "account"); !os.IsNotExist(err) {
		t.Fatalf("cross-provider index: %v", err)
	}
	if _, err = restarted.Load(ctx, "provider", "tenant", "different-account"); !os.IsNotExist(err) {
		t.Fatalf("cross-account index: %v", err)
	}
	path, _ := store.path("provider", "tenant", "account")
	if err = os.WriteFile(path, []byte(`{"source":"provider"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = restarted.Load(ctx, "provider", "tenant", "account"); err == nil {
		t.Fatal("corrupt manifest accepted")
	}
}
