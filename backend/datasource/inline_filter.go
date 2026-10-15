// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"fmt"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"reflect"
	"strconv"
	"strings"
	"time"
)

func filterInlineRows(rows []map[string]interface{}, filters []dsproto.InlineFilter, args map[string]interface{}) ([]map[string]interface{}, error) {
	for _, filter := range filters {
		if filter.Field == "" || filter.Input == "" {
			return nil, fmt.Errorf("inline filter requires field and input")
		}
		if filter.Operator != "eq" && filter.Operator != "gte" && filter.Operator != "lte" {
			return nil, fmt.Errorf("unsupported inline filter operator %q", filter.Operator)
		}
		if filter.Type != "" && filter.Type != "number" && filter.Type != "date" {
			return nil, fmt.Errorf("unsupported inline filter type %q", filter.Type)
		}
		value := selectPath(filter.Input, args)
		if value == nil {
			value = args[filter.Input]
		}
		if value == nil || fmt.Sprint(value) == "" {
			continue
		}
		values := []interface{}{value}
		rv := reflect.ValueOf(value)
		if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
			values = nil
			for i := 0; i < rv.Len(); i++ {
				values = append(values, rv.Index(i).Interface())
			}
		}
		if len(values) == 0 {
			continue
		}
		if filter.Operator != "eq" && len(values) != 1 {
			return nil, fmt.Errorf("range inline filter requires one value")
		}
		wantedValues := make([]float64, 0, len(values))
		for _, v := range values {
			wanted, err := inlineComparable(v, filter.Type)
			if err != nil {
				return nil, err
			}
			wantedValues = append(wantedValues, wanted)
		}
		selected := make([]map[string]interface{}, 0, len(rows))
		for _, row := range rows {
			if row[filter.Field] == nil {
				continue
			}
			actual, err := inlineComparable(row[filter.Field], filter.Type)
			if err != nil {
				return nil, err
			}
			match := false
			for _, wanted := range wantedValues {
				if filter.Operator == "eq" && actual == wanted || filter.Operator == "gte" && actual >= wanted || filter.Operator == "lte" && actual <= wanted {
					match = true
					break
				}
			}
			if match {
				selected = append(selected, row)
			}
		}
		rows = selected
	}
	return rows, nil
}

func inlineComparable(value interface{}, kind string) (float64, error) {
	text := strings.TrimSpace(fmt.Sprint(value))
	if kind == "date" {
		if len(text) >= 10 {
			text = text[:10]
		}
		date, err := time.Parse("2006-01-02", text)
		if err != nil {
			return 0, fmt.Errorf("invalid inline filter date: %w", err)
		}
		return float64(date.Unix()), nil
	}
	number, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid inline filter number: %w", err)
	}
	return number, nil
}
