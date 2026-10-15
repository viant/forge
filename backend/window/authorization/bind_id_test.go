// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"math"
	"reflect"
	"testing"
	"time"
)

type v2SnapshotResolver func(context.Context, *Request) (*Snapshot, error)

func (f v2SnapshotResolver) Resolve(ctx context.Context, request *Request) (*Snapshot, error) {
	return f(ctx, request)
}

func TestV1IntegerIDsRejectLossyValues(t *testing.T) {
	for _, value := range []any{1.5, math.NaN(), math.Inf(1), float64(1<<53) + 2, int64(1 << 53), "9007199254740993", jsonNumber("9007199254740993"), json.Number("9007199254740993"), json.Number("1.5"), json.Number("9007199254740992.0"), json.Number("9223372036854775808"), json.Number("1.0000000000000000001"), json.Number("1e1000000000"), json.Number("1e-1000000000")} {
		if _, err := intValue(value); err == nil {
			t.Errorf("accepted lossy ID %v (%T)", value, value)
		}
	}
	for _, value := range []any{float64(123), int64(123), "123", jsonNumber("123"), json.Number("123")} {
		if got, err := intValue(value); err != nil || got != 123 {
			t.Errorf("ID %v: got %d, %v", value, got, err)
		}
	}
}

func TestV2StringIDBindingAndSnapshot(t *testing.T) {
	window := testWindow(t)
	field := reflect.ValueOf(window.Authorization).Elem().FieldByName("SchemaVersion")
	if !field.IsValid() {
		t.Skip("pinned Forge module predates authorization schemaVersion; run in local multi-module workspace")
	}
	field.SetInt(2)
	id := "9007199254740993"
	bound, err := Bind(window, "window", "conversation", map[string]any{"AdvertiserId": []any{id}})
	if err != nil || bound.ResourceIDString != id || bound.ResourceID != 0 {
		t.Fatalf("binding: %+v %v", bound, err)
	}
	request, err := ResolveRequest(bound)
	if err != nil || request.SchemaVersion != 2 || len(request.ResourceIDs) != 0 || len(request.StringResourceIDs) != 1 || request.StringResourceIDs[0] != id {
		t.Fatalf("request: %+v %v", request, err)
	}
	if _, err := Bind(window, "window", "conversation", map[string]any{"AdvertiserId": []any{float64(9007199254740993)}}); err == nil {
		t.Fatal("rounded numeric ID accepted in v2")
	}
	snapshot := &Snapshot{SchemaVersion: 2, AuthorizationVersion: "v2", ExpiresAt: time.Now().Add(time.Minute), Resources: map[string]*Resource{id: {Type: "advertiser", IDString: id, Capabilities: map[string]bool{"read": true}}}}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	var decoded Snapshot
	if err := json.Unmarshal(raw, &decoded); err != nil || decoded.Resources[id].IDString != id {
		t.Fatalf("v2 wire lost exact ID: %s %v", raw, err)
	}
	runtime := NewRuntime(v2SnapshotResolver(func(context.Context, *Request) (*Snapshot, error) { return snapshot, nil }))
	result, err := runtime.Apply(context.Background(), bound)
	if err != nil || result.Denied || result.Resource.IDString != id {
		t.Fatalf("v2 apply: %+v %v", result, err)
	}
	snapshot.Resources[id].IDString = "other"
	if _, err := runtime.Apply(context.Background(), bound); err == nil {
		t.Fatal("mismatched v2 snapshot accepted")
	}
}

func TestV1JSONIntegralFormsRemainCompatible(t *testing.T) {
	for _, number := range []json.Number{"1", "1.0", "1e0", "10e-1", "0.1e1", "1.0000000000000000000000000000000"} {
		if got, err := intValue(number); err != nil || got != 1 {
			t.Fatalf("integral JSON form %q: %d %v", number, got, err)
		}
	}
	if got, err := intValue(json.Number("1e3")); err != nil || got != 1000 {
		t.Fatalf("integral exponent: %d %v", got, err)
	}
}
