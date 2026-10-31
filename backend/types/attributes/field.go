// Package attributes adapts native Go tags to Forge's transport-neutral schema
// during source preparation. Browser validation does not depend on this package.
package attributes

import (
	"fmt"
	"github.com/viant/forge/backend/types"
	"github.com/viant/govalidator"
	tagformat "github.com/viant/tagly/format"
	"reflect"
	"time"
)

// ResourceFieldSchemaFromTags is an opt-in compile/preparation-time adapter.
// The caller explicitly selects presence-marker semantics. It does not validate
// edits, generate executable code, perform transport calls or install a cache.
func ResourceFieldSchemaFromTags(field reflect.StructField, presenceOnly bool) (types.ResourceFieldSchema, error) {
	result := types.ResourceFieldSchema{}
	fieldType := field.Type
	pointer := fieldType.Kind() == reflect.Ptr
	if pointer {
		fieldType = fieldType.Elem()
		result.Nullable = true
	}
	switch fieldType.Kind() {
	case reflect.String:
		result.Type = "string"
	case reflect.Bool:
		result.Type = "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		result.Type = "integer"
	case reflect.Float32, reflect.Float64:
		result.Type = "number"
	default:
		if fieldType == reflect.TypeOf(time.Time{}) {
			result.Type = "string"
		} else {
			return result, fmt.Errorf("unsupported resource attribute type %s", fieldType)
		}
	}
	if raw := field.Tag.Get("validate"); raw != "" {
		if fieldType == reflect.TypeOf(time.Time{}) {
			return result, fmt.Errorf("native time validation requires an explicit hook")
		}
		tag := govalidator.ParseTag(raw)
		result.Validation = &types.ResourceFieldValidation{Pointer: pointer, PresenceOnly: presenceOnly, OmitEmpty: tag.Omitempty}
		for _, check := range tag.Checks {
			result.Validation.Checks = append(result.Validation.Checks, types.ResourceValidationCheck{Name: check.Name, Parameters: append([]string(nil), check.Parameters...), Message: check.Message})
		}
	}
	if field.Tag.Get("format") != "" {
		tag, err := tagformat.Parse(field.Tag)
		if err != nil {
			return result, err
		}
		if tag.TimeLayout != "" || tag.Timezone != "" || fieldType == reflect.TypeOf(time.Time{}) {
			result.TimeFormat = &types.ResourceTimeFormat{TimeLayout: tag.TimeLayout, TimeZone: tag.Timezone, Nullable: tag.Nullable, OmitEmpty: tag.Omitempty}
		}
		if tag.Nullable != nil {
			result.Nullable = *tag.Nullable
		}
	}
	return result, nil
}
