package artifactcohort

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/viant/forge/backend/types"
)

// The warm-open benchmark covers the production local admission pointer,
// target selection, and request-owned JSON materialization without MCP I/O.
func BenchmarkReplicaOpenWindowWarm(b *testing.B) {
	ctx := context.Background()
	p := NewPublisher()
	variant := types.WindowResourceVariant{Window: &types.Window{WindowKey: "connectors", View: types.View{Content: &types.Container{ID: "root"}}, DataSource: map[string]types.DataSource{}}, DataSources: map[string]json.RawMessage{}}
	fingerprint, err := types.WindowVariantFingerprint(variant)
	if err != nil {
		b.Fatal(err)
	}
	bundle := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]types.WindowResourceVariant{fingerprint: variant}}
	raw, _ := json.Marshal(bundle)
	root := RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}
	if _, _, err = p.Publish(ctx, root, raw, allowPublished); err != nil {
		b.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	if _, err = p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); err != nil {
		b.Fatal(err)
	}
	r, err := NewReplica(Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "account", Caller: &fakeCaller{publisher: p, fetches: map[string]int{}}, Facts: fixtureFacts{}, SessionKey: fixtureSession})
	if err != nil {
		b.Fatal(err)
	}
	actor := actorContext("alice", "operator")
	if err = r.Sync(actor); err != nil {
		b.Fatal(err)
	}
	if err = r.EnsureAdmitted(actor); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err = r.OpenWindowVariant(actor, root.URI, nil); err != nil {
			b.Fatal(err)
		}
	}
}
