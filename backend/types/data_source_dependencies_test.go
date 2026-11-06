package types

import (
	"bytes"
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

// The same independently authored JSON fixtures run against the existing native
// JavaScript helper in dataSourceDependencies.parity.test.mjs.
func TestDataSourceDependencyParityFixtures(t *testing.T) {
	raw, err := os.ReadFile("testdata/data_source_dependencies.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name                                           string
		Descriptor                                     json.RawMessage
		Values, Filter, ExpectedValues, ExpectedFilter map[string]any
		Ready, Error                                   bool
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err = decoder.Decode(&cases); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range cases {
		t.Run(fixture.Name, func(t *testing.T) {
			ready, err := ResolveDataSourceDependencies(fixture.Descriptor, fixture.Values, fixture.Filter)
			if (err != nil) != fixture.Error {
				t.Fatalf("error=%v expectedError=%v", err, fixture.Error)
			}
			if ready != fixture.Ready {
				t.Fatalf("ready=%v expected=%v", ready, fixture.Ready)
			}
			if !reflect.DeepEqual(fixture.Values, fixture.ExpectedValues) {
				t.Fatalf("values=%#v expected=%#v", fixture.Values, fixture.ExpectedValues)
			}
			if !reflect.DeepEqual(fixture.Filter, fixture.ExpectedFilter) {
				t.Fatalf("filter=%#v expected=%#v", fixture.Filter, fixture.ExpectedFilter)
			}
		})
	}
}
