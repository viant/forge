package reportfill

import (
	"encoding/json"
	"fmt"

	reportspec "github.com/viant/forge/backend/reporting/spec"
)

// BuildTableSnapshot prepares one explicitly selected table block for CSV or
// XLSX rendering. The caller supplies already-authorized, bounded rows; Forge
// owns presentation/provenance validation and includes only displayed fields.
// It never fetches data or decides access.
func BuildTableSnapshot(specJSON json.RawMessage, blockID string, rows []map[string]any, effectiveLimit int, truncated bool) (*ReportFill, error) {
	specification, err := reportspec.DecodeJSON(specJSON)
	if err != nil {
		return nil, fmt.Errorf("table snapshot spec: %w", err)
	}
	var selected *reportspec.Block
	for i := range specification.Blocks {
		if specification.Blocks[i].ID == blockID {
			selected = &specification.Blocks[i]
			break
		}
	}
	if selected == nil || selected.Kind != "tableBlock" {
		return nil, fmt.Errorf("table snapshot requires an explicit tableBlock ID")
	}
	var dataset *reportspec.Dataset
	for i := range specification.Datasets {
		if specification.Datasets[i].ID == selected.DatasetRef {
			dataset = &specification.Datasets[i]
			break
		}
	}
	if dataset == nil {
		return nil, fmt.Errorf("table snapshot dataset is absent")
	}
	if effectiveLimit < 1 || len(rows) > effectiveLimit {
		return nil, fmt.Errorf("table snapshot requires a positive enforced row limit")
	}
	request := dataset.Request
	if request.Kind != "staticCsv" && request.Kind != "staticJson" {
		if request.Limit == nil || effectiveLimit > *request.Limit {
			return nil, fmt.Errorf("table snapshot limit exceeds the authored request")
		}
		request.Limit = &effectiveLimit
	}
	specHash, err := computeJSONFNV1aRawHash(specJSON)
	if err != nil {
		return nil, err
	}
	requestHash, err := computeJSONFNV1aHash(request)
	if err != nil {
		return nil, err
	}
	columns := make([]TableColumn, 0, len(selected.Columns))
	for _, source := range selected.Columns {
		columns = append(columns, TableColumn{Key: source.Key, SourceKey: source.SourceKey, DisplayKey: source.DisplayKey,
			Label: source.Label, Kind: source.Kind, Format: source.Format, Align: source.Align, CellVisual: source.CellVisual,
			Link: source.Link, RuntimeFilterable: source.RuntimeFilterable})
	}
	contents := make([]ResolvedTableRow, 0, len(rows))
	filteredRows := make([]map[string]any, 0, len(rows))
	for index, row := range rows {
		if row == nil {
			return nil, fmt.Errorf("table snapshot row %d is nil", index)
		}
		cells := make([]ResolvedTableCell, 0, len(columns))
		filtered := make(map[string]any, len(columns))
		for _, column := range columns {
			sourceKey := column.SourceKey
			if sourceKey == "" {
				sourceKey = column.Key
			}
			value, ok := row[sourceKey]
			if !ok {
				return nil, fmt.Errorf("table snapshot row %d lacks column %q", index, sourceKey)
			}
			displayKey := column.DisplayKey
			if displayKey == "" {
				displayKey = sourceKey
			}
			displayValue := value
			if displayKey != sourceKey {
				var exists bool
				displayValue, exists = row[displayKey]
				if !exists {
					return nil, fmt.Errorf("table snapshot row %d lacks display column %q", index, displayKey)
				}
				filtered[displayKey] = displayValue
			}
			filtered[sourceKey] = value
			cells = append(cells, ResolvedTableCell{Key: column.Key, SourceKey: sourceKey, DisplayKey: displayKey, Value: value, DisplayValue: displayValue})
		}
		contents = append(contents, ResolvedTableRow{RowIndex: index, Cells: cells})
		filteredRows = append(filteredRows, filtered)
	}
	fill := &ReportFill{
		Version: 1, Kind: "reportFill", SpecVersion: specification.Version, SpecHash: specHash,
		Source: Source{Kind: specification.Source.Kind, ContainerID: specification.Source.ContainerID,
			StateKey: specification.Source.StateKey, DataSourceRef: specification.Source.DataSourceRef},
		Parameters: map[string]any{}, Refinements: []map[string]any{}, CalculatedFields: []map[string]any{},
		Datasets: []Dataset{{ID: dataset.ID, DataSourceRef: dataset.DataSourceRef, Request: request,
			Provenance: Provenance{RequestHash: requestHash, RowCount: len(filteredRows), Truncated: truncated,
				HasMore: false, Diagnostics: []Diagnostic{}}, Rows: filteredRows}},
		Blocks: []Block{{ID: selected.ID, Kind: "tableBlock", Title: selected.Title, DatasetRef: selected.DatasetRef,
			Columns: columns, Content: &TableContent{Columns: append([]TableColumn(nil), columns...), RowCount: len(rows), ResolvedRows: contents}}},
		Diagnostics: []Diagnostic{},
	}
	if err := fill.Validate(); err != nil {
		return nil, fmt.Errorf("table snapshot fill: %w", err)
	}
	return fill, nil
}
