package types

import (
	"encoding/json"
	"testing"

	identity "github.com/viant/agently-core/protocol/resource"
)

func windowBundleFixture(t *testing.T) WindowResourceEnvelope {
	t.Helper()
	e := WindowResourceEnvelope{SchemaVersion: 2, Format: WindowBundleFormat, Variants: map[string]WindowResourceVariant{}}
	for _, p := range []struct {
		target     WindowTarget
		id, script string
	}{{WindowTarget{}, "desktopRoot", "desktopActions()"}, {WindowTarget{Platform: "ios", FormFactor: "phone"}, "phoneRoot", "phoneActions()"}} {
		descriptor := json.RawMessage(`{"id":"items","backend":{"kind":"inline","rows":[{"safe":true}]}}`)
		descriptor, _ = CanonicalWindowDescriptor(descriptor)
		v := WindowResourceVariant{Window: &Window{View: View{Content: &Container{ID: p.id}}, Actions: &Actions{Code: p.script}, DataSource: map[string]DataSource{"items": {}}, ResourceDependencies: map[string]string{"items": identity.ContentFingerprint(descriptor)}}, DataSources: map[string]json.RawMessage{"items": descriptor}}
		key, err := WindowVariantFingerprint(v)
		if err != nil {
			t.Fatal(err)
		}
		e.Variants[key] = v
		e.Targets = append(e.Targets, WindowTargetBinding{Target: p.target, Variant: key})
	}
	if err := e.Validate(); err != nil {
		t.Fatal(err)
	}
	return e
}
func TestWindowBundleSelectsCompletePinnedVariantAndRetainsOverrides(t *testing.T) {
	e := windowBundleFixture(t)
	raw, _ := json.Marshal(e)
	for _, item := range []struct {
		target     *WindowTarget
		id, script string
	}{{nil, "desktopRoot", "desktopActions()"}, {&WindowTarget{Platform: "ios", FormFactor: "phone", Surface: "app", Capabilities: []string{"touch"}}, "phoneRoot", "phoneActions()"}} {
		v, err := SelectWindowResource(raw, item.target)
		if err != nil || v.Window.View.Content.ID != item.id || v.Window.Actions.Code != item.script || len(v.DataSources) != 1 {
			t.Fatalf("complete target selection: %+v %v", v, err)
		}
	}
	if _, err := SelectWindowResource(raw, &WindowTarget{Platform: "unsupported", FormFactor: "phone"}); err == nil {
		t.Fatal("undeclared target fell back to desktop")
	}
	legacy, _ := json.Marshal(e.Variants[e.Targets[0].Variant].Window)
	if _, err := SelectWindowResource(legacy, nil); err != nil {
		t.Fatal(err)
	}
	for _, target := range []WindowTarget{{Platform: "web"}, {Platform: "ios", FormFactor: "phone"}} {
		if _, err := SelectWindowResource(legacy, &target); err == nil {
			t.Fatal("historical singleton acquired unstored target")
		}
	}
}
func TestWindowBundleRejectsAmbiguousTargetsAndDescriptorTampering(t *testing.T) {
	for _, mode := range []string{"ambiguous", "descriptor", "variant", "default", "wrong-id", "null", "array", "orphan-dependency"} {
		t.Run(mode, func(t *testing.T) {
			e := windowBundleFixture(t)
			switch mode {
			case "ambiguous":
				e.Targets = append(e.Targets, e.Targets[1])
			case "descriptor":
				v := e.Variants[e.Targets[1].Variant]
				v.DataSources["items"] = json.RawMessage(`{"id":"items","backend":{"kind":"systemexec"}}`)
				e.Variants[e.Targets[1].Variant] = v
			case "variant":
				e.Targets[1].Variant = identity.ContentFingerprint([]byte("unavailable"))
			case "default":
				e.Targets = e.Targets[1:]
			case "wrong-id", "null", "array", "orphan-dependency":
				old := e.Targets[1].Variant
				v := e.Variants[old]
				if mode == "orphan-dependency" {
					v.Window.ResourceDependencies["unreferenced"] = identity.ContentFingerprint([]byte("orphan"))
				} else {
					raw := json.RawMessage(`{"id":"other"}`)
					if mode == "null" {
						raw = json.RawMessage(`null`)
					}
					if mode == "array" {
						raw = json.RawMessage(`[]`)
					}
					v.DataSources["items"] = raw
					v.Window.ResourceDependencies["items"] = identity.ContentFingerprint(raw)
				}
				next, err := WindowVariantFingerprint(v)
				if err != nil {
					next = identity.ContentFingerprint([]byte("invalid descriptor variant"))
				}
				delete(e.Variants, old)
				e.Variants[next] = v
				e.Targets[1].Variant = next
			}
			if e.Validate() == nil {
				t.Fatal("invalid bundle accepted")
			}
		})
	}
}
