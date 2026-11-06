// SPDX-License-Identifier: Apache-2.0
package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
	"sort"
)

// MenuRowFields declares the columns used by ProjectMenuRows. For example, a
// producer can map GroupID to "group_id" and ItemLabel to "item_label".
// Orders accept finite numbers or numeric strings; IDs accept strings or numbers.
type MenuRowFields struct {
	GroupID, GroupLabel, GroupOrder string
	ItemID, ItemLabel, ItemOrder    string
}

// MenuRowIdentity keeps identity independent of display labels. Item IDs are
// scoped to their group, so identically named groups and items remain distinct.
type MenuRowIdentity struct {
	GroupID string
	ItemID  string
}

// MenuRowBinding supplies an authored action, never an action inferred from a
// datasource column. Disabled has the existing menu presentation semantics:
// it permits an actionless label but does not bypass action authorization.
type MenuRowBinding struct {
	Action   json.RawMessage
	Disabled bool
}

// ProjectMenuRows groups producer-selected rows into one authored application
// and returns the existing schemaVersion:1 applications/menus envelope. The
// application's menus are replaced; its other authored fields are preserved.
// Rows supply only identity, title and ordering. Actions come exclusively from
// bindings keyed by group and item identity. Producers select visible rows and
// supply any disabled presentation before calling; this utility makes no access
// decisions, executes no queries and performs no I/O. Use the normal menu
// publication and visibility path on the resulting definition.
//
// Groups and items sort by their declared order, preserving input order on ties.
// A group's first row supplies its title and order. Each item identity must
// occur once and have a binding, including explicitly disabled labels.
func ProjectMenuRows(ctx context.Context, rows []map[string]any, fields MenuRowFields, application json.RawMessage, bindings map[MenuRowIdentity]MenuRowBinding) (json.RawMessage, error) {
	if ctx == nil {
		return nil, fmt.Errorf("menu rows require a context")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	for _, field := range []string{fields.GroupID, fields.GroupLabel, fields.GroupOrder, fields.ItemID, fields.ItemLabel, fields.ItemOrder} {
		if field == "" {
			return nil, fmt.Errorf("menu row field mapping is incomplete")
		}
	}
	var app map[string]json.RawMessage
	if json.Unmarshal(application, &app) != nil || app == nil {
		return nil, fmt.Errorf("menu rows require an authored application object")
	}
	type item struct {
		ID       string          `json:"id"`
		Title    string          `json:"title"`
		Action   json.RawMessage `json:"action,omitempty"`
		Disabled bool            `json:"disabled,omitempty"`
		order    *big.Rat
	}
	type group struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		Menus []item `json:"menus"`
		order *big.Rat
	}
	groups := make([]*group, 0)
	byGroup := make(map[string]*group)
	seen := make(map[MenuRowIdentity]bool)
	for i, row := range rows {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		values := make([]string, 6)
		for j, field := range []string{fields.GroupID, fields.GroupLabel, fields.GroupOrder, fields.ItemID, fields.ItemLabel, fields.ItemOrder} {
			value, err := menuRowScalar(row[field])
			if err != nil {
				return nil, fmt.Errorf("menu row %d field %q: %w", i, field, err)
			}
			values[j] = value
		}
		groupOrder, err := menuRowOrder(values[2])
		if err != nil {
			return nil, fmt.Errorf("menu row %d group order: %w", i, err)
		}
		itemOrder, err := menuRowOrder(values[5])
		if err != nil {
			return nil, fmt.Errorf("menu row %d item order: %w", i, err)
		}
		key := MenuRowIdentity{GroupID: values[0], ItemID: values[3]}
		if seen[key] {
			return nil, fmt.Errorf("menu row %d repeats an item identity", i)
		}
		seen[key] = true
		binding, ok := bindings[key]
		if !ok {
			return nil, fmt.Errorf("menu row %d has no authored binding", i)
		}
		g := byGroup[key.GroupID]
		if g == nil {
			g = &group{ID: key.GroupID, Title: values[1], Menus: make([]item, 0), order: groupOrder}
			byGroup[key.GroupID] = g
			groups = append(groups, g)
		}
		g.Menus = append(g.Menus, item{ID: key.ItemID, Title: values[4], Action: binding.Action, Disabled: binding.Disabled, order: itemOrder})
	}
	sort.SliceStable(groups, func(i, j int) bool { return groups[i].order.Cmp(groups[j].order) < 0 })
	for _, g := range groups {
		sort.SliceStable(g.Menus, func(i, j int) bool { return g.Menus[i].order.Cmp(g.Menus[j].order) < 0 })
	}
	menus, err := json.Marshal(groups)
	if err != nil {
		return nil, err
	}
	app["menus"] = menus
	// An empty datasource produces no applications, rather than an empty group.
	applications := make([]map[string]json.RawMessage, 0, 1)
	if len(groups) > 0 {
		applications = append(applications, app)
	}
	raw, err := json.Marshal(struct {
		SchemaVersion int                          `json:"schemaVersion"`
		Applications  []map[string]json.RawMessage `json:"applications"`
	}{SchemaVersion: 1, Applications: applications})
	if err != nil {
		return nil, err
	}
	if err := ValidateMenu(1, raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func menuRowScalar(value any) (string, error) {
	switch v := value.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	case json.Number:
		return string(v), nil
	}
	if value != nil {
		switch reflect.TypeOf(value).Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
			reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
			reflect.Float32, reflect.Float64:
			return fmt.Sprint(value), nil
		}
	}
	return "", fmt.Errorf("expected a string or number")
}

func menuRowOrder(value string) (*big.Rat, error) {
	order, ok := new(big.Rat).SetString(value)
	if !ok {
		return nil, fmt.Errorf("expected a finite numeric order")
	}
	return order, nil
}
