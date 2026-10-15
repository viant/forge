// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/viant/authz"
)

type selectionPathStep struct {
	field string
	array bool
}

var selectionPathField = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func parseSelectionPath(path string) ([]selectionPathStep, error) {
	if path == "" || len(path) > 512 || strings.TrimSpace(path) != path {
		return nil, ErrDenied
	}
	parts := strings.Split(path, ".")
	if len(parts) > 32 {
		return nil, ErrDenied
	}
	steps := make([]selectionPathStep, len(parts))
	for i, part := range parts {
		array := strings.HasSuffix(part, "[]")
		field := strings.TrimSuffix(part, "[]")
		if !selectionPathField.MatchString(field) {
			return nil, ErrDenied
		}
		steps[i] = selectionPathStep{field: field, array: array}
	}
	return steps, nil
}

func resolveSelectionPath(inputs map[string]interface{}, binding BackendBinding) ([]authz.Entity, error) {
	steps, err := parseSelectionPath(binding.SelectionPath)
	if err != nil {
		return nil, err
	}
	values := []any{inputs}
	for _, step := range steps {
		next := []any{}
		for _, node := range values {
			object, ok := node.(map[string]interface{})
			if !ok {
				return nil, ErrDenied
			}
			value, found := object[step.field]
			if !found || value == nil {
				return nil, ErrDenied
			}
			if !step.array {
				next = append(next, value)
				continue
			}
			array := reflect.ValueOf(value)
			if array.Kind() != reflect.Slice || array.IsNil() || array.Len() == 0 {
				return nil, ErrDenied
			}
			for i := 0; i < array.Len(); i++ {
				item := array.Index(i).Interface()
				if item == nil {
					return nil, ErrDenied
				}
				next = append(next, item)
			}
		}
		if len(next) > 500 {
			return nil, ErrDenied
		}
		values = next
	}
	if len(values) == 0 || binding.SelectionMode == "single" && len(values) != 1 {
		return nil, ErrDenied
	}
	seen := map[string]bool{}
	ids := []string{}
	representation := ""
	for _, value := range values {
		kind := "number"
		if _, ok := value.(string); ok {
			kind = "string"
		}
		if representation != "" && representation != kind {
			return nil, ErrDenied
		}
		representation = kind
		var id string
		if binding.SelectionIDFormat == "opaque" {
			stringID, ok := value.(string)
			if !ok || stringID == "" || strings.TrimSpace(stringID) != stringID {
				return nil, ErrDenied
			}
			id = stringID
		} else {
			id, err = exactBackendID(value)
			if err != nil {
				return nil, err
			}
			number, err := strconv.ParseInt(id, 10, 64)
			if err != nil || number < 1 || strconv.FormatInt(number, 10) != id {
				return nil, ErrDenied
			}
			if kind == "number" && number > 1<<53-1 {
				return nil, ErrDenied
			}
		}
		if seen[id] {
			return nil, fmt.Errorf("%w: duplicate selected ID", ErrDenied)
		}
		seen[id] = true
		ids = append(ids, id)
	}
	sort.Strings(ids)
	selected := make([]authz.Entity, len(ids))
	for i, id := range ids {
		selected[i] = authz.Entity{Type: binding.EntityType, ID: id}
	}
	return selected, nil
}
