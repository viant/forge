package artifactcohort

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/types"
)

func TestReplicaOpenWindowSelectsPublishedClosureLocally(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	descriptor, err := types.CanonicalWindowDescriptor(json.RawMessage(`{"id":"items","backend":{"kind":"inline","rows":[{"safe":true}]}}`))
	if err != nil {
		t.Fatal(err)
	}
	variant := types.WindowResourceVariant{Window: &types.Window{WindowKey: "main", View: types.View{Content: &types.Container{ID: "root"}}, DataSource: map[string]types.DataSource{"items": {InitialFilter: map[string]any{"id": json.Number("9007199254740993")}}}, ResourceDependencies: map[string]string{"items": Hash(descriptor)}}, DataSources: map[string]json.RawMessage{"items": descriptor}}
	// The production producer validates the bundle before publication. This
	// fixture exercises selection and proves that no dependency RPC occurs.
	fingerprint, err := types.WindowVariantFingerprint(variant)
	if err != nil {
		t.Fatal(err)
	}
	bundle := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]types.WindowResourceVariant{fingerprint: variant}}
	raw, _ := json.Marshal(bundle)
	a, _, err := p.Publish(ctx, RootRef{URI: "window://sales/main", Kind: "window", Version: 1}, raw, allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: a.Root.URI, Kind: a.Root.Kind}}
	if _, err = p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	r, err := NewReplica(Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "acct", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	actor := actorContext("alice", "operator")
	if err = r.Sync(actor); err != nil {
		t.Fatal(err)
	}
	if err = r.Admit(actor); err != nil {
		t.Fatal(err)
	}
	before := caller.count(a.Root.URI)
	phaseCounts := map[observe.Phase]int{}
	actor = observe.WithObserver(actor, observe.ObserverFunc(func(e observe.Event) {
		phaseCounts[e.Phase]++
		if e.Phase == phaseWindowDecode && e.Bytes <= 0 {
			t.Fatal("decode omitted byte count")
		}
	}))
	for i := 0; i < 10; i++ {
		selected, hash, e := r.OpenWindowVariant(actor, a.Root.URI, nil)
		if e != nil || hash != a.Root.Hash || selected.Window.WindowKey != "main" || len(selected.DataSources) != 1 || selected.Window.DataSource["items"].InitialFilter["id"] != json.Number("9007199254740993") {
			t.Fatalf("select: %+v %q %v", selected, hash, e)
		}
	}
	if caller.count(a.Root.URI) != before {
		t.Fatal("window selection contacted provider")
	}
	if phaseCounts[phaseWindowOpen] != 10 || phaseCounts[phaseWindowDecode] != 10 {
		t.Fatalf("window phases missing: %+v", phaseCounts)
	}
}
