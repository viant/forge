// Package tablemeta defines explicit, producer-neutral table presentation metadata.
package tablemeta

import (
	"fmt"
	"strings"
)

type Totals struct {
	Mode   string   `json:"mode"`
	Fields []string `json:"fields,omitempty"`
}
type Hierarchy struct {
	KeyField            string   `json:"keyField"`
	ParentField         string   `json:"parentField"`
	LabelField          string   `json:"labelField"`
	DefaultExpandedKeys []string `json:"defaultExpandedKeys,omitempty"`
	Totals              Totals   `json:"totals"`
}
type PivotValue struct {
	Field     string `json:"field"`
	Label     string `json:"label"`
	Aggregate string `json:"aggregate"`
	Format    string `json:"format,omitempty"`
}
type Pivot struct {
	RowFields        []string     `json:"rowFields"`
	ColumnField      string       `json:"columnField"`
	ColumnCategories []string     `json:"columnCategories"`
	Values           []PivotValue `json:"values"`
}
type ColumnGroup struct {
	Label   string   `json:"label"`
	Columns []string `json:"columns"`
}

func Header(label, key string, groups []ColumnGroup) string {
	if label == "" {
		label = key
	}
	for _, group := range groups {
		for _, field := range group.Columns {
			if field == key {
				return group.Label + " / " + label
			}
		}
	}
	return label
}
func unique(values []string) bool {
	seen := map[string]bool{}
	for _, value := range values {
		if strings.TrimSpace(value) == "" || seen[value] {
			return false
		}
		seen[value] = true
	}
	return true
}
func Validate(hierarchy *Hierarchy, pivot *Pivot, groups []ColumnGroup, columns []string) error {
	known := map[string]int{}
	for i, column := range columns {
		known[column] = i
	}
	if hierarchy != nil && pivot != nil {
		return fmt.Errorf("table hierarchy and pivot require separate blocks")
	}
	if hierarchy != nil {
		if !unique([]string{hierarchy.KeyField, hierarchy.ParentField, hierarchy.LabelField}) || !unique(hierarchy.DefaultExpandedKeys) {
			return fmt.Errorf("invalid hierarchy keys")
		}
		if _, ok := known[hierarchy.LabelField]; !ok {
			return fmt.Errorf("hierarchy labelField must be displayed")
		}
		if hierarchy.Totals.Mode != "producer" && hierarchy.Totals.Mode != "sum-leaves" {
			return fmt.Errorf("hierarchy totals require producer or sum-leaves mode")
		}
		if hierarchy.Totals.Mode == "producer" && len(hierarchy.Totals.Fields) > 0 {
			return fmt.Errorf("producer totals cannot declare computed fields")
		}
		if hierarchy.Totals.Mode == "sum-leaves" {
			if len(hierarchy.Totals.Fields) == 0 || !unique(hierarchy.Totals.Fields) {
				return fmt.Errorf("sum-leaves requires unique fields")
			}
			for _, field := range hierarchy.Totals.Fields {
				if _, ok := known[field]; !ok {
					return fmt.Errorf("unknown hierarchy sum field")
				}
			}
		}
	}
	if pivot != nil {
		if len(groups) > 0 {
			return fmt.Errorf("pivot column groups are generated from categories")
		}
		if len(pivot.RowFields) == 0 || len(pivot.ColumnCategories) == 0 || len(pivot.Values) == 0 || !unique(pivot.ColumnCategories) {
			return fmt.Errorf("pivot requires row fields, categories and values")
		}
		fields := append(append([]string{}, pivot.RowFields...), pivot.ColumnField)
		for _, value := range pivot.Values {
			if strings.TrimSpace(value.Label) == "" || (value.Aggregate != "none" && value.Aggregate != "sum") {
				return fmt.Errorf("pivot values require label and explicit aggregation")
			}
			fields = append(fields, value.Field)
		}
		if !unique(fields) {
			return fmt.Errorf("pivot fields must be distinct")
		}
		for _, field := range fields {
			if _, ok := known[field]; !ok {
				return fmt.Errorf("pivot fields must be source columns")
			}
		}
	}
	used := map[string]bool{}
	for _, group := range groups {
		if strings.TrimSpace(group.Label) == "" || len(group.Columns) == 0 {
			return fmt.Errorf("column groups require label and columns")
		}
		prior := -1
		for i, field := range group.Columns {
			position, ok := known[field]
			if !ok || used[field] || (i > 0 && position != prior+1) {
				return fmt.Errorf("column groups must be disjoint contiguous columns")
			}
			used[field] = true
			prior = position
		}
	}
	return nil
}
