package reportfill

import (
	"encoding/json"
	"testing"
)

func TestDatasetRelativeDateRangePreservesValueEquality(t *testing.T) {
	constructed := DatasetRelativeDateRange{Preset: "previousperiod", StartParamPath: "filters.from", EndParamPath: "filters.to"}
	var scope DatasetScope
	raw := []byte(`{"mode":"override","relativeDateRange":{"preset":"previousperiod","startParamPath":"filters.from","endParamPath":"filters.to","metadata":{"version":1}}}`)
	if err := json.Unmarshal(raw, &scope); err != nil {
		t.Fatal(err)
	}
	if scope.RelativeDateRange == nil {
		t.Fatal("relative metadata missing")
	}
	decoded := *scope.RelativeDateRange
	if constructed != decoded {
		t.Fatal("decoded metadata differs from equivalent caller-constructed value")
	}
	keys := map[DatasetRelativeDateRange]string{constructed: "equivalent"}
	if keys[decoded] != "equivalent" {
		t.Fatal("equivalent decoded value cannot look up legacy map key")
	}
}

func TestDatasetScopeOpaqueRelativeMetadataKeepsNilTypedAccess(t *testing.T) {
	for _, relative := range []string{`null`, `"producer metadata"`, `42`, `true`, `[1,2]`} {
		t.Run(relative, func(t *testing.T) {
			var decoded Dataset
			input := []byte(`{"scope":{"relativeDateRange":` + relative + `}}`)
			if err := json.Unmarshal(input, &decoded); err != nil {
				t.Fatal(err)
			}
			if decoded.Scope == nil {
				t.Fatal("scope missing")
			}
			if decoded.Scope.RelativeDateRange != nil {
				t.Fatalf("nonobject relative metadata became a present typed range: %+v", decoded.Scope.RelativeDateRange)
			}
			output, err := json.Marshal(decoded.Scope)
			if err != nil {
				t.Fatal(err)
			}
			var raw struct {
				Relative json.RawMessage `json:"relativeDateRange"`
			}
			if err = json.Unmarshal(output, &raw); err != nil {
				t.Fatal(err)
			}
			if string(raw.Relative) != relative {
				t.Fatalf("opaque relative metadata changed: %s", output)
			}
		})
	}
}
