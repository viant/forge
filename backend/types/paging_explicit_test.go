package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"strings"
	"testing"
)

func TestOptionalPagingAndValueColumnPreserveLegacySerialization(t *testing.T) {
	legacy := DataSource{Selectors: &Selectors{Data: "rows"}, Paging: &PagingConfig{Enabled: true, Size: 20, Parameters: &PagingParameters{Page: "Offset", Size: "Limit"}}}
	for _, marshal := range []func(interface{}) ([]byte, error){json.Marshal, yaml.Marshal} {
		raw, err := marshal(legacy)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(raw), "mode") || strings.Contains(string(raw), "valueColumn") {
			t.Fatalf("optional configuration changed legacy wire shape: %s", raw)
		}
	}
	for _, raw := range []string{`{"id":"legacy","selectors":{"data":"rows"},"paging":{"enabled":true,"size":20,"parameters":{"page":"Offset","size":"Limit"}}}`, `id: legacy
selectors: {data: rows}
paging: {enabled: true, size: 20, parameters: {page: Offset, size: Limit}}
`} {
		var ds DataSource
		var err error
		if strings.HasPrefix(raw, "{") {
			err = json.Unmarshal([]byte(raw), &ds)
		} else {
			err = yaml.Unmarshal([]byte(raw), &ds)
		}
		if err != nil {
			t.Fatal(err)
		}
		if ds.Paging.Mode != "" || ds.Selectors.ValueColumn != "" || ds.Paging.Parameters.Page != "Offset" || ds.Paging.Parameters.Size != "Limit" {
			t.Fatalf("legacy authored configuration changed: %#v", ds)
		}
	}
}

func TestExplicitGenericMappingsRoundTripJSONAndYAML(t *testing.T) {
	original := DataSource{Selectors: &Selectors{Data: "reply.amount", ValueColumn: "amount"}, Paging: &PagingConfig{Enabled: true, Mode: "offset", Size: 2, Parameters: &PagingParameters{Page: "skipRows", Size: "takeRows"}}}
	for _, tc := range []struct {
		marshal   func(interface{}) ([]byte, error)
		unmarshal func([]byte, interface{}) error
	}{{json.Marshal, json.Unmarshal}, {yaml.Marshal, yaml.Unmarshal}} {
		raw, err := tc.marshal(original)
		if err != nil {
			t.Fatal(err)
		}
		var ds DataSource
		if err := tc.unmarshal(raw, &ds); err != nil {
			t.Fatal(err)
		}
		if ds.Paging.Mode != "offset" || ds.Selectors.ValueColumn != "amount" || ds.Paging.Parameters.Page != "skipRows" || ds.Paging.Parameters.Size != "takeRows" {
			t.Fatalf("explicit generic mapping lost: %#v", ds)
		}
	}
}
