package reportspec

import (
	"encoding/json"
	"reflect"
	"testing"
)

// Synthetic requests exercise the fields already admitted by reportSpecSchema.
func TestRequestPayloadRoundTripPreservesResultSelection(t *testing.T) {
	for _, input := range []string{
		`{"resultSet":"detailRows","summary":false,"measures":{"amount":true},"limit":10,"offset":0}`,
		`{"resultSet":"totals","summary":true,"limit":10,"offset":0}`,
		`{"limit":10,"offset":0}`,
		`{"kind":"staticJson","format":"json","rowCount":0,"columnKeys":[],"limit":null,"offset":null}`,
	} {
		t.Run(input, func(t *testing.T) {
			var request RequestPayload
			if err := json.Unmarshal([]byte(input), &request); err != nil {
				t.Fatal(err)
			}
			output, err := json.Marshal(request)
			if err != nil {
				t.Fatal(err)
			}
			var want, got map[string]any
			if err := json.Unmarshal([]byte(input), &want); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(output, &got); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("request changed across typed serialization: got %s want %s", output, input)
			}
		})
	}
}
