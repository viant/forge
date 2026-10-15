// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import "reflect"

// transportArguments isolates executor mutation from logical request/cache state.
// Exclusions are exact top-level keys: dots, wildcards and whitespace are literal.
func transportArguments(args map[string]interface{}, metadata []string) map[string]interface{} {
	if args == nil {
		return nil
	}
	result := cloneTransportValue(reflect.ValueOf(args)).Interface().(map[string]interface{})
	for _, key := range metadata {
		delete(result, key)
	}
	return result
}

// Datasource inputs are JSON-shaped maps and slices. Reflection preserves their
// concrete scalar/container types (including integer IDs and json.Number).
func cloneTransportValue(value reflect.Value) reflect.Value {
	switch value.Kind() {
	case reflect.Interface:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		result := reflect.New(value.Type()).Elem()
		result.Set(cloneTransportValue(value.Elem()))
		return result
	case reflect.Map:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		result := reflect.MakeMapWithSize(value.Type(), value.Len())
		iter := value.MapRange()
		for iter.Next() {
			result.SetMapIndex(iter.Key(), cloneTransportValue(iter.Value()))
		}
		return result
	case reflect.Slice:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		result := reflect.MakeSlice(value.Type(), value.Len(), value.Len())
		for i := 0; i < value.Len(); i++ {
			result.Index(i).Set(cloneTransportValue(value.Index(i)))
		}
		return result
	case reflect.Array:
		result := reflect.New(value.Type()).Elem()
		for i := 0; i < value.Len(); i++ {
			result.Index(i).Set(cloneTransportValue(value.Index(i)))
		}
		return result
	default:
		return value
	}
}
