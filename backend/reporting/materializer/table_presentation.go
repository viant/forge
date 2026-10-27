package materializer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/viant/forge/backend/reporting/tablemeta"
)

var ErrTablePresentation = errors.New("invalid report table presentation")

// TablePresentations contains advisory display choices, never rows or scope.
// The trusted materializer validates table/column IDs against the report fill.
type TablePresentations map[string]TablePresentation

type TablePresentation struct {
	ExpandedKeys []string   `json:"expandedKeys,omitempty"`
	Filter       string     `json:"filter,omitempty"`
	Sort         *TableSort `json:"sort,omitempty"`
}

type TableSort struct {
	Key       string `json:"key"`
	Direction string `json:"direction"`
}

// MaterializePresented applies table choices to freshly executed complete data.
// Existing callers without presentation choices retain their original behavior.
func MaterializePresented(ctx context.Context, spec json.RawMessage, datasets map[string]json.RawMessage, presentations TablePresentations, fillOnly bool) (*Artifacts, error) {
	if err := ValidateTablePresentations(spec, presentations); err != nil {
		return nil, err
	}
	return materialize(ctx, spec, datasets, fillOnly, presentations)
}

func ValidateTablePresentations(spec json.RawMessage, presentations TablePresentations) error {
	if len(presentations) == 0 {
		return nil
	}
	if len(presentations) > 128 {
		return fmt.Errorf("%w: too many table choices", ErrTablePresentation)
	}
	var document struct {
		Blocks []struct {
			ID        string               `json:"id"`
			Hierarchy *tablemeta.Hierarchy `json:"hierarchy,omitempty"`
			Pivot     *tablemeta.Pivot     `json:"pivot,omitempty"`
			Kind      string               `json:"kind"`
			Columns   []struct {
				Key string `json:"key"`
			} `json:"columns"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(spec, &document); err != nil {
		return err
	}
	tables := make(map[string]map[string]bool)
	for _, block := range document.Blocks {
		if block.Kind != "tableBlock" {
			continue
		}
		columns := make(map[string]bool)
		for _, column := range block.Columns {
			columns[column.Key] = true
		}
		if block.Pivot != nil {
			columns = make(map[string]bool)
			for _, field := range block.Pivot.RowFields {
				columns[field] = true
			}
			for c := range block.Pivot.ColumnCategories {
				for m := range block.Pivot.Values {
					columns[fmt.Sprintf("__forge_pivot_%d_%d", c, m)] = true
				}
			}
		}
		tables[block.ID] = columns
	}
	for id, state := range presentations {
		columns, exists := tables[id]
		if !exists {
			return fmt.Errorf("%w: unknown table %q", ErrTablePresentation, id)
		}
		if len(state.Filter) > 4096 {
			return fmt.Errorf("%w: filter exceeds limit for table %q", ErrTablePresentation, id)
		}
		if state.Sort != nil && (!columns[state.Sort.Key] || (state.Sort.Direction != "asc" && state.Sort.Direction != "desc")) {
			return fmt.Errorf("%w: sort column or direction is invalid for table %q", ErrTablePresentation, id)
		}
	}
	return nil
}
