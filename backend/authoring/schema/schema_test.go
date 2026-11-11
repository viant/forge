package schema

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
)

func TestCanonicalSchemasRemainIndependentAndPreserveConstraints(t *testing.T) {
	for _, ref := range []string{"forge:report-spec", "forge:window"} {
		first, err := Resolve(ref)
		if err != nil {
			t.Fatal(err)
		}
		if first["$defs"] == nil {
			t.Fatalf("%s missing canonical definitions", ref)
		}
		first["$defs"] = nil
		second, err := Resolve(ref)
		if err != nil {
			t.Fatal(err)
		}
		if second["$defs"] == nil {
			t.Fatal("caller mutated embedded schema")
		}
	}
	report, err := Resolve("forge:report-spec")
	if err != nil {
		t.Fatal(err)
	}
	if report["additionalProperties"] != false {
		t.Fatal("lost canonical object constraint")
	}
	properties := report["properties"].(map[string]any)
	if properties["kind"].(map[string]any)["const"] != "reportSpec" {
		t.Fatal("lost canonical discriminator")
	}
	encoded, _ := json.Marshal(report)
	if len(encoded) < 10000 {
		t.Fatal("canonical schema unexpectedly truncated")
	}
	if _, err := Resolve("https://example.invalid/schema"); err == nil {
		t.Fatal("remote schema unexpectedly resolved")
	}
}

func TestProcessSchemasPreparedOnceAcrossConcurrentReads(t *testing.T) {
	var wait sync.WaitGroup
	for index := 0; index < 100; index++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for _, ref := range []string{"forge:report-spec", "forge:window", "forge:report-transaction", "forge:report-data"} {
				if _, err := Compact(ref); err != nil {
					t.Error(err)
				}
				if _, err := Select(ref, ""); err != nil {
					t.Error(err)
				}
			}
		}()
	}
	wait.Wait()
	for _, entry := range canonical {
		if entry.computations != 1 {
			t.Fatalf("schema computed %d times", entry.computations)
		}
	}
	first, err := Select("forge:report-spec", "/$defs/kpiBlock")
	if err != nil {
		t.Fatal(err)
	}
	first.Schema[0] = 'X'
	again, err := Select("forge:report-spec", "/$defs/kpiBlock")
	if err != nil {
		t.Fatal(err)
	}
	if again.Schema[0] != '{' || again.Complete || again.Fingerprint == "" {
		t.Fatal("selection isolation/identity lost")
	}
	if len(again.Schema) > 5000 {
		t.Fatal("small fragment unexpectedly includes full catalog")
	}
}
func TestFragmentClosesCyclesAndEscapedReferences(t *testing.T) {
	source := map[string]any{"$schema": "https://json-schema.org/draft/2020-12/schema", "$defs": map[string]any{
		"a/b":       map[string]any{"type": "object", "properties": map[string]any{"next": map[string]any{"$ref": "#/$defs/second"}}},
		"second":    map[string]any{"allOf": []any{map[string]any{"$ref": "#/$defs/a~1b"}}, "required": []any{"name"}},
		"unrelated": map[string]any{"type": "string"},
	}}
	d := document{source: source, nodes: map[string]any{}, refs: map[string][]string{}}
	d.index("", source)
	result, err := d.fragment("/$defs/a~1b", d.nodes["/$defs/a~1b"])
	if err != nil {
		t.Fatal(err)
	}
	defs := result["$defs"].(map[string]any)
	if len(defs) != 2 || defs["a/b"] == nil || defs["second"] == nil {
		t.Fatal("cycle closure lost")
	}
	source["$defs"].(map[string]any)["external"] = map[string]any{"$ref": "https://example.invalid/schema"}
	d.index("", source)
	if _, err := d.fragment("/$defs/external", d.nodes["/$defs/external"]); !errors.Is(err, ErrSelection) {
		t.Fatal("external reference did not fail as selection error")
	}
	if _, err := Select("forge:report-spec", "/$defs/missing"); !errors.Is(err, ErrSelection) {
		t.Fatal("unknown pointer did not fail as selection error")
	}
}
