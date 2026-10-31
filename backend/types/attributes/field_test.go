package attributes

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/viant/forge/backend/types"
	"github.com/viant/govalidator"
	tagformat "github.com/viant/tagly/format"
)

// These neutral fixtures were invented independently; both native and browser
// tests consume them so a frontend expectation cannot substitute for Go parity.
func readCases(t *testing.T, name string, target interface{}) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "src", "validation", "testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(raw, target); err != nil {
		t.Fatal(err)
	}
}
func TestNativeRuleParityCorpus(t *testing.T) {
	var cases []struct {
		Name, Type, Tag string
		Schema          types.ResourceFieldSchema
		Value           interface{}
		Valid, Missing  bool
	}
	readCases(t, "native-rules.json", &cases)
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			kind := map[string]reflect.Type{"string": reflect.TypeOf(""), "integer": reflect.TypeOf(int(0)), "number": reflect.TypeOf(float64(0)), "boolean": reflect.TypeOf(false)}[c.Type]
			if c.Schema.Validation.Pointer {
				kind = reflect.PointerTo(kind)
			}
			field := reflect.StructField{Name: "Value", Type: kind, Tag: reflect.StructTag(fmt.Sprintf("validate:%q", c.Tag))}
			schema, err := ResourceFieldSchemaFromTags(field, false)
			if err != nil {
				t.Fatal(err)
			}
			a, _ := json.Marshal(schema)
			b, _ := json.Marshal(c.Schema)
			if string(a) != string(b) {
				t.Fatalf("normalization differs: %s != %s", a, b)
			}
			instance := reflect.New(reflect.StructOf([]reflect.StructField{field, {Name: "Padding", Type: reflect.TypeOf(int(0))}}))
			if !c.Missing {
				raw, _ := json.Marshal(map[string]interface{}{"Value": c.Value})
				if err = json.Unmarshal(raw, instance.Interface()); err != nil {
					t.Fatal(err)
				}
			}
			result, err := govalidator.New().Validate(context.Background(), instance.Interface())
			if err != nil {
				t.Fatal(err)
			}
			if !result.Failed != c.Valid {
				t.Fatalf("native valid=%v, expected=%v", !result.Failed, c.Valid)
			}
		})
	}
}
func TestNativeTimeFormatParityCorpus(t *testing.T) {
	var cases []struct{ Tag, Instant, Layout, Zone, Expected string }
	readCases(t, "native-time-format.json", &cases)
	for _, c := range cases {
		field := reflect.StructField{Name: "Time", Type: reflect.TypeOf(time.Time{}), Tag: reflect.StructTag(fmt.Sprintf("format:%q", c.Tag))}
		schema, err := ResourceFieldSchemaFromTags(field, false)
		if err != nil {
			t.Fatal(err)
		}
		if schema.TimeFormat.TimeLayout != c.Layout || schema.TimeFormat.TimeZone != c.Zone {
			t.Fatalf("lost metadata: %#v", schema.TimeFormat)
		}
		native, err := tagformat.Parse(field.Tag)
		if err != nil {
			t.Fatal(err)
		}
		ts, err := time.Parse(time.RFC3339, c.Instant)
		if err != nil {
			t.Fatal(err)
		}
		if got := native.FormatTime(&ts); got != c.Expected {
			t.Fatalf("native format %s != %s", got, c.Expected)
		}
	}
	// Tagly parsing deliberately ignores its presentation timezone.
	tag, err := tagformat.Parse(reflect.StructTag(`format:"timeLayout=2006-01-02 15:04:05,tz=America/Los_Angeles"`))
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := tag.ParseTime("2026-03-08 02:30:00")
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Format(time.RFC3339) != "2026-03-08T02:30:00Z" {
		t.Fatal("native parse unexpectedly applied display timezone")
	}
}
func TestUnknownRulesRemainExplicit(t *testing.T) {
	schema, err := ResourceFieldSchemaFromTags(reflect.StructField{Name: "Value", Type: reflect.TypeOf(""), Tag: `validate:"customRule"`}, true)
	if err != nil {
		t.Fatal(err)
	}
	if !schema.Validation.PresenceOnly || schema.Validation.Checks[0].Name != "customRule" {
		t.Fatal("unsupported rule or explicit marker mode lost")
	}
	raw, err := json.Marshal(schema)
	if err != nil {
		t.Fatal(err)
	}
	var roundTrip types.ResourceFieldSchema
	if err = json.Unmarshal(raw, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(schema, roundTrip) {
		t.Fatal("attribute contract lost in JSON round trip")
	}
}

func TestPresenceMarkerIsExplicit(t *testing.T) {
	type marker struct{ Value bool }
	type record struct {
		Value int     `validate:"required"`
		Has   *marker `setMarker:"true"`
	}
	for _, present := range []bool{false, true} {
		result, err := govalidator.New().Validate(context.Background(), &record{Has: &marker{Value: present}}, govalidator.WithSetMarker())
		if err != nil {
			t.Fatal(err)
		}
		if result.Failed != present {
			t.Fatalf("native marker failed=%v present=%v", result.Failed, present)
		}
	}
	field, _ := reflect.TypeOf(record{}).FieldByName("Value")
	schema, err := ResourceFieldSchemaFromTags(field, true)
	if err != nil || !schema.Validation.PresenceOnly {
		t.Fatal("explicit marker mode lost")
	}
}

func TestFormatAttributeAliasesAndRoundTrip(t *testing.T) {
	field := reflect.StructField{Name: "Value", Type: reflect.TypeOf(""), Tag: `format:"dateFormat=YYYY-MM-DD,timezone=UTC,nullable=true,omitempty"`}
	schema, err := ResourceFieldSchemaFromTags(field, false)
	if err != nil {
		t.Fatal(err)
	}
	if !schema.Nullable || schema.TimeFormat.TimeLayout != "2006-01-02" || schema.TimeFormat.TimeZone != "UTC" || !schema.TimeFormat.OmitEmpty || schema.TimeFormat.Nullable == nil || !*schema.TimeFormat.Nullable {
		t.Fatalf("format fields lost: %#v", schema)
	}
	raw, _ := json.Marshal(schema)
	var roundTrip types.ResourceFieldSchema
	if err = json.Unmarshal(raw, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(schema, roundTrip) {
		t.Fatal("format attributes lost in round trip")
	}
}
