// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"sync"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

func (s *Service) runMCPTools(ctx context.Context, backend *dsproto.Backend, inputs map[string]interface{}) (interface{}, error) {
	if s.executor == nil {
		return nil, fmt.Errorf("mcp_tools backend but no executor configured")
	}
	results := make([][]map[string]interface{}, len(backend.Calls))
	errs := make([]error, len(backend.Calls))
	var wg sync.WaitGroup
	for index := range backend.Calls {
		index := index
		wg.Add(1)
		go func() {
			defer wg.Done()
			call := backend.Calls[index]
			payload, err := s.executeCompositeCall(ctx, call, compositeCallArgs(call, inputs, nil, nil, nil), backend.RequestMetadata)
			if err != nil {
				if call.IgnoreNotFound && isCompositeNotFound(err) {
					results[index] = []map[string]interface{}{}
					return
				}
				errs[index] = fmt.Errorf("call %q: %w", firstNonEmpty(call.ID, call.Method), err)
				return
			}
			rows := compositeRows(payload)
			mapped := make([]map[string]interface{}, 0, len(rows))
			for _, row := range rows {
				mapped = append(mapped, mapCompositeRow(call.FieldMap, call.Constants, nil, row, nil, nil))
			}
			results[index] = mapped
		}()
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			return nil, err
		}
	}
	var rows []map[string]interface{}
	for _, part := range results {
		rows = append(rows, part...)
	}
	sortCompositeRows(rows, backend.Sort)
	return rows, nil
}

func isCompositeNotFound(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "not found or access denied") || strings.Contains(message, "not found/access denied")
}

func (s *Service) runMCPFanout(ctx context.Context, backend *dsproto.Backend, inputs map[string]interface{}) (interface{}, error) {
	if s.executor == nil {
		return nil, fmt.Errorf("mcp_fanout backend but no executor configured")
	}
	if backend.Fanout == nil {
		return nil, fmt.Errorf("mcp_fanout backend missing fanout")
	}
	fanout := backend.Fanout
	seedPayload, err := s.executeCompositeCall(ctx, fanout.Seed, compositeCallArgs(fanout.Seed, inputs, nil, nil, nil), backend.RequestMetadata)
	if err != nil {
		return nil, fmt.Errorf("seed %q: %w", fanout.Seed.Method, err)
	}
	selectedItems := selectPath(fanout.ItemsSelector, seedPayload)
	if selectedItems == nil && strings.TrimSpace(fanout.ItemsSelector) != "" {
		return nil, fmt.Errorf("seed items selector %q did not resolve", fanout.ItemsSelector)
	}
	items := coerceRows(selectedItems)
	results := make([][]map[string]interface{}, len(items))
	errs := make([]error, len(items))
	var wg sync.WaitGroup
	for index := range items {
		index := index
		wg.Add(1)
		go func() {
			defer wg.Done()
			item := items[index]
			selections := expandFanoutSelections(item, fanout.ValueSets)
			if len(selections) == 0 {
				return
			}
			if fanout.UnmappedAsUnresolved && compositeCallHasUnmappedValue(fanout.Call, inputs, item) {
				mapped := make([]map[string]interface{}, 0, len(selections))
				for _, selection := range selections {
					mapped = append(mapped, mapCompositeRow(fanout.FieldMap, nil, inputs, item, selection, nil))
				}
				results[index] = mapped
				return
			}
			args := expandNestedArgs(compositeCallArgs(fanout.Call, inputs, item, nil, nil))
			if fanout.ListArgument != nil && strings.TrimSpace(fanout.ListArgument.Target) != "" {
				list := make([]map[string]interface{}, 0, len(selections))
				for _, selection := range selections {
					entry := map[string]interface{}{}
					for field, selector := range fanout.ListArgument.Fields {
						entry[field] = resolveCompositeSelector(selector, inputs, item, selection, nil)
					}
					list = append(list, entry)
				}
				assignNestedArg(args, fanout.ListArgument.Target, list)
			}
			payload, callErr := s.executeCompositeCall(ctx, fanout.Call, args, backend.RequestMetadata)
			if callErr != nil {
				errs[index] = fmt.Errorf("fanout item %d: %w", index, callErr)
				return
			}
			resultMap, _ := selectPath(fanout.ResultMap, payload).(map[string]interface{})
			mapped := make([]map[string]interface{}, 0, len(selections))
			for _, selection := range selections {
				key := fmt.Sprint(resolveCompositeSelector(fanout.ResultKey, inputs, item, selection, nil))
				resolved, found := resultMap[key]
				if !found && !fanout.IncludeUnresolved {
					continue
				}
				result, _ := resolved.(map[string]interface{})
				mapped = append(mapped, mapCompositeRow(fanout.FieldMap, nil, inputs, item, selection, result))
			}
			results[index] = mapped
		}()
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			return nil, err
		}
	}
	// Preserve a completed empty fanout as [] rather than nil. Downstream UI
	// runtimes use the collection envelope to distinguish "loaded with no
	// rows" from an unresolved/null result and must still run onFetch handlers.
	rows := make([]map[string]interface{}, 0)
	for _, part := range results {
		rows = append(rows, part...)
	}
	sortCompositeRows(rows, backend.Sort)
	return rows, nil
}

func compositeCallHasUnmappedValue(call dsproto.MCPCall, inputs, item map[string]interface{}) bool {
	for target, values := range call.ValueMaps {
		selector, ok := call.Args[target]
		if !ok {
			continue
		}
		raw := fmt.Sprint(resolveCompositeSelector(selector, inputs, item, nil, nil))
		if _, ok := values[raw]; !ok {
			return true
		}
	}
	return false
}

func (s *Service) executeCompositeCall(ctx context.Context, call dsproto.MCPCall, args map[string]interface{}, metadata []string) (interface{}, error) {
	if strings.TrimSpace(call.Service) == "" || strings.TrimSpace(call.Method) == "" {
		return nil, fmt.Errorf("service and method are required")
	}
	raw, err := s.executeManagingTool(ctx, call.Service+":"+call.Method, transportArguments(expandNestedArgs(args), metadata))
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(raw) == "" {
		return map[string]interface{}{}, nil
	}
	var payload interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, fmt.Errorf("decode result: %w", err)
	}
	return payload, nil
}

func compositeCallArgs(call dsproto.MCPCall, inputs, item, selection, result map[string]interface{}) map[string]interface{} {
	args := map[string]interface{}{}
	for target, selector := range call.Args {
		args[target] = resolveCompositeSelector(selector, inputs, item, selection, result)
	}
	for target, value := range call.Pinned {
		args[target] = value
	}
	for target, values := range call.ValueMaps {
		current := args[target]
		if mapped, ok := values[fmt.Sprint(current)]; ok {
			args[target] = mapped
		}
	}
	return args
}

func compositeRows(payload interface{}) []map[string]interface{} {
	if selected := selectPath("data", payload); selected != nil {
		return coerceRows(selected)
	}
	return coerceRows(payload)
}

func expandFanoutSelections(item map[string]interface{}, specs []dsproto.ValueSet) []map[string]interface{} {
	if len(specs) == 0 {
		return []map[string]interface{}{{}}
	}
	var result []map[string]interface{}
	for _, spec := range specs {
		for _, value := range interfaceSlice(selectPath(spec.Selector, item)) {
			selection := map[string]interface{}{"value": value}
			for key, constant := range spec.Constants {
				selection[key] = constant
			}
			result = append(result, selection)
		}
	}
	return result
}

func interfaceSlice(value interface{}) []interface{} {
	if value == nil {
		return nil
	}
	if values, ok := value.([]interface{}); ok {
		return values
	}
	rv := reflect.ValueOf(value)
	if rv.Kind() != reflect.Array && rv.Kind() != reflect.Slice {
		return []interface{}{value}
	}
	result := make([]interface{}, rv.Len())
	for i := 0; i < rv.Len(); i++ {
		result[i] = rv.Index(i).Interface()
	}
	return result
}

func mapCompositeRow(fieldMap map[string]string, constants map[string]interface{}, inputs, item, selection, result map[string]interface{}) map[string]interface{} {
	row := map[string]interface{}{}
	if len(fieldMap) == 0 && item != nil {
		for key, value := range item {
			row[key] = value
		}
	}
	for target, selector := range fieldMap {
		row[target] = resolveCompositeSelector(selector, inputs, item, selection, result)
	}
	for key, value := range constants {
		row[key] = value
	}
	return row
}

func resolveCompositeSelector(selector string, inputs, item, selection, result map[string]interface{}) interface{} {
	selector = strings.TrimSpace(selector)
	if selector == "" {
		return nil
	}
	root := interface{}(inputs)
	if item != nil {
		root = item
	}
	path := selector
	for prefix, candidate := range map[string]map[string]interface{}{
		"inputs.":    inputs,
		"item.":      item,
		"selection.": selection,
		"result.":    result,
	} {
		if strings.HasPrefix(selector, prefix) {
			root = candidate
			path = strings.TrimPrefix(selector, prefix)
			break
		}
	}
	return selectPath(path, root)
}

func sortCompositeRows(rows []map[string]interface{}, specs []dsproto.SortField) {
	if len(rows) < 2 || len(specs) == 0 {
		return
	}
	sort.SliceStable(rows, func(i, j int) bool {
		for _, spec := range specs {
			left := fmt.Sprint(selectPath(spec.Field, rows[i]))
			right := fmt.Sprint(selectPath(spec.Field, rows[j]))
			if left == right {
				continue
			}
			less := strings.Compare(strings.ToLower(left), strings.ToLower(right)) < 0
			if strings.EqualFold(spec.Direction, "desc") {
				return !less
			}
			return less
		}
		return false
	})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
