package reportspec

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestDatasetScopeRoundTrip(t *testing.T) {
	for _, input := range []string{
		`{}`,
		`{"mode":"inherit"}`,
		`{"mode":"append","local":{"grain":"day","filters":{"region":["north"]}}}`,
		`{"mode":"override","inheritContext":false,"local":{}}`,
		`{"mode":"exclude","exclude":["window","grain"]}`,
		`{"exclude":[],"local":{},"inheritContext":true}`,
		`{"inheritContext":false,"grain":"day","producerMetadata":{"revision":2}}`,
		`{"mode":"override","relativeDateRange":{"preset":"previousperiod","startParamPath":"filters.from","endParamPath":"filters.to"}}`,
		`{"mode":"append","relativeDateRange":{"preset":"last7days","startExpression":"today-6d","endExpression":"today","format":"yyyy-MM-dd","startParamPath":"filters.from","endParamPath":"filters.to","producerMetadata":[1,2]}}`,
		// relativeDateRange is an open extension in both schemas. Go transports it;
		// the existing authored-report normalizer owns its evaluation and grammar.
		`{"relativeDateRange":{"preset":42,"custom":null}}`,
		`{"relativeDateRange":"producer extension"}`,
		`{"relativeDateRange":null}`,
	} {
		t.Run(input, func(t *testing.T) {
			var scope DatasetScope
			if err := json.Unmarshal([]byte(input), &scope); err != nil {
				t.Fatal(err)
			}
			output, err := json.Marshal(scope)
			if err != nil {
				t.Fatal(err)
			}
			var want, got any
			if err = json.Unmarshal([]byte(input), &want); err != nil {
				t.Fatal(err)
			}
			if err = json.Unmarshal(output, &got); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(want, got) {
				t.Fatalf("scope changed: got %s want %s", output, input)
			}
		})
	}
}

func TestDatasetScopeRejectsInvalidDeclaredFields(t *testing.T) {
	for _, input := range []string{
		`{"mode":"overide"}`, `{"mode":""}`, `{"mode":null}`, `{"mode":4}`,
		`{"inheritContext":null}`, `{"inheritContext":"true"}`,
		`{"local":null}`, `{"local":[]}`,
		`{"exclude":null}`, `{"exclude":"window"}`, `{"exclude":[1]}`, `{"exclude":[null]}`, `{"exclude":["window","window"]}`,
	} {
		t.Run(input, func(t *testing.T) {
			var scope DatasetScope
			if err := json.Unmarshal([]byte(input), &scope); err == nil {
				t.Fatalf("accepted invalid declared scope field: %s", input)
			}
		})
	}
}

func TestDatasetScopeRelativeTypedAccessPreservesExtensions(t *testing.T) {
	var scope DatasetScope
	input := `{"mode":"override","relativeDateRange":{"preset":"previousperiod","startParamPath":"filters.from","endParamPath":"filters.to","producerMetadata":{"formatVersion":1}}}`
	if err := json.Unmarshal([]byte(input), &scope); err != nil {
		t.Fatal(err)
	}
	if scope.RelativeDateRange == nil || scope.RelativeDateRange.Preset != "previousperiod" || scope.RelativeDateRange.StartParamPath != "filters.from" || scope.RelativeDateRange.EndParamPath != "filters.to" {
		t.Fatalf("relative typed access lost: %+v", scope.RelativeDateRange)
	}
	scope.RelativeDateRange.Format = "yyyy-MM-dd"
	output, err := json.Marshal(scope)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(output), `"format":"yyyy-MM-dd"`) || !strings.Contains(string(output), `"producerMetadata":{"formatVersion":1}`) {
		t.Fatalf("typed edit lost extension metadata: %s", output)
	}
}

func TestDatasetScopeRetainsRelativeExtensionBytes(t *testing.T) {
	relative := "{\n  \"preset\": \"previousperiod\", \"metadata\": {\"version\": 1}\n}"
	var scope DatasetScope
	if err := json.Unmarshal([]byte(`{"relativeDateRange":`+relative+`}`), &scope); err != nil {
		t.Fatal(err)
	}
	output, err := scope.marshalRelativeDateRange()
	if err != nil {
		t.Fatal(err)
	}
	if string(output) != relative {
		t.Fatalf("relative extension bytes changed: got %s want %s", output, relative)
	}
}

func TestDatasetScopeCanReplaceOrClearTypedRelativeMetadata(t *testing.T) {
	var scope DatasetScope
	if err := json.Unmarshal([]byte(`{"relativeDateRange":null}`), &scope); err != nil {
		t.Fatal(err)
	}
	scope.RelativeDateRange = &DatasetRelativeDateRange{Preset: "last7days", StartParamPath: "filters.from", EndParamPath: "filters.to"}
	output, err := json.Marshal(scope)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(output), `"preset":"last7days"`) {
		t.Fatalf("typed replacement retained opaque null: %s", output)
	}
	if err = json.Unmarshal(output, &scope); err != nil {
		t.Fatal(err)
	}
	scope.RelativeDateRange = nil
	output, err = json.Marshal(scope)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(output), "relativeDateRange") {
		t.Fatalf("cleared typed range reappeared: %s", output)
	}
}
