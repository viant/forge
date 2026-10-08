package forgeui

import (
	"encoding/json"
	"fmt"

	reportspec "github.com/viant/forge/backend/reporting/spec"
)

// ValidateReport uses Forge's authoritative native report schema and checks
// that every datasource/dataset reference is closed over the published
// definition. Consumers must never resolve report references from a different
// workspace, connection alias or newer publication by accident.
func ValidateReport(report *reportspec.ReportSpec, sourceIDs map[string]bool) error {
	if err := report.Validate(); err != nil {
		return err
	}
	datasets := map[string]bool{}
	for _, dataset := range report.Datasets {
		if datasets[dataset.ID] {
			return fmt.Errorf("duplicate report dataset %q", dataset.ID)
		}
		datasets[dataset.ID] = true
	}
	blocks := map[string]bool{}
	for _, block := range report.Blocks {
		if blocks[block.ID] {
			return fmt.Errorf("duplicate report block %q", block.ID)
		}
		blocks[block.ID] = true
	}
	for _, id := range report.LayoutIntent.BlockOrder {
		if !blocks[id] {
			return fmt.Errorf("unknown report layout block %q", id)
		}
	}
	data, err := json.Marshal(report)
	if err != nil {
		return err
	}
	var document any
	if err = json.Unmarshal(data, &document); err != nil {
		return err
	}
	var validate func(any) error
	validate = func(value any) error {
		switch node := value.(type) {
		case map[string]any:
			for key, value := range node {
				if ref, ok := value.(string); ok && ref != "" {
					if key == "dataSourceRef" && !sourceIDs[ref] {
						return fmt.Errorf("report datasource %q is not published", ref)
					}
					if key == "datasetRef" && !datasets[ref] {
						return fmt.Errorf("report dataset %q is not declared", ref)
					}
				}
				if err := validate(value); err != nil {
					return err
				}
			}
		case []any:
			for _, value := range node {
				if err := validate(value); err != nil {
					return err
				}
			}
		}
		return nil
	}
	return validate(document)
}
