package reporting

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/materializer"
)

var reportSortField = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// Resolve viewer choices against admitted columns. No request paths or producer
// field names are accepted from the viewer. Complete output sorts after fetch.
func reportDatasetSorts(spec json.RawMessage, choices materializer.TablePresentations) (map[string]string, error) {
	result := map[string]string{}
	var document struct {
		CalculatedFields []struct {
			ID         string `json:"id"`
			Key        string `json:"key"`
			DatasetRef string `json:"datasetRef"`
		} `json:"calculatedFields"`
		Blocks []struct {
			ID         string `json:"id"`
			DatasetRef string `json:"datasetRef"`
			Kind       string `json:"kind"`
			Hierarchy  any    `json:"hierarchy"`
			Pivot      any    `json:"pivot"`
			Columns    []struct {
				DataType        string         `json:"dataType"`
				Kind            string         `json:"kind"`
				Key             string         `json:"key"`
				SourceKey       string         `json:"sourceKey"`
				DisplayKey      string         `json:"displayKey"`
				DisplayValueMap map[string]any `json:"displayValueMap"`
			} `json:"columns"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(spec, &document); err != nil {
		return nil, err
	}
	if err := materializer.ValidateTablePresentations(spec, choices); err != nil {
		return nil, err
	}
	for _, block := range document.Blocks {
		choice := choices[block.ID]
		if choice.Sort == nil {
			continue
		}
		if block.Hierarchy != nil || block.Pivot != nil {
			return nil, fmt.Errorf("analytical tables require complete data for sorting")
		}
		for _, column := range block.Columns {
			if column.Key != choice.Sort.Key {
				continue
			}
			field := column.SourceKey
			if field == "" {
				field = column.Key
			}
			if !reportSortField.MatchString(field) || (column.DisplayKey != "" && column.DisplayKey != field) || len(column.DisplayValueMap) > 0 || column.DataType == "object" || column.DataType == "array" || column.Kind == "object" || column.Kind == "array" {
				return nil, fmt.Errorf("table column does not support producer sorting")
			}
			dataset := block.DatasetRef
			if dataset == "" {
				dataset = "primary"
			}
			for _, calculation := range document.CalculatedFields {
				if (calculation.DatasetRef == "" || calculation.DatasetRef == dataset) && (calculation.ID == field || calculation.Key == field || calculation.ID == column.Key || calculation.Key == column.Key) {
					return nil, fmt.Errorf("local calculated columns require complete data for sorting")
				}
			}
			order := field + " " + choice.Sort.Direction
			if old, ok := result[dataset]; ok && old != order {
				return nil, fmt.Errorf("conflicting table sorts for dataset")
			}
			result[dataset] = order
		}
	}
	return result, nil
}

func applyReportDatasetSort(descriptor *dsproto.DataSource, args map[string]any, order string) error {
	if descriptor == nil || descriptor.Backend == nil {
		return fmt.Errorf("report sort datasource unavailable")
	}
	if _, pinned := descriptor.Backend.Pinned["orderBy"]; pinned {
		return fmt.Errorf("report sort cannot replace pinned input")
	}
	_, admitted := args["orderBy"]
	for _, parameter := range descriptor.Parameters {
		if parameter.Name == "orderBy" {
			admitted = true
		}
	}
	if !admitted {
		return fmt.Errorf("report datasource does not admit orderBy")
	}
	// Preserve the approved/current secondary order unchanged. Native orderBy
	// is a string list; this only identifies the existing simple field token.
	previous := []string{}
	switch entries := args["orderBy"].(type) {
	case []string:
		previous = entries
	case []any:
		for _, entry := range entries {
			text, ok := entry.(string)
			if !ok {
				return fmt.Errorf("invalid authored report order")
			}
			previous = append(previous, text)
		}
	case nil:
	default:
		return fmt.Errorf("invalid authored report order")
	}
	field := strings.Fields(order)[0]
	next := []string{order}
	for _, entry := range previous {
		tokens := strings.Fields(entry)
		if len(tokens) > 0 && tokens[0] != field {
			next = append(next, entry)
		}
	}
	args["orderBy"] = next
	return nil
}

// A producer-consumed page sort must never be reinterpreted by the local display
// comparator. Copy only affected choices; retain filter/expansion and full-data
// presentation behavior without mutating the invocation's export snapshot.
func reportPageTablePresentations(spec json.RawMessage, choices materializer.TablePresentations, consumed map[string]string) materializer.TablePresentations {
	if len(consumed) == 0 {
		return choices
	}
	var document struct {
		Blocks []struct {
			ID         string `json:"id"`
			DatasetRef string `json:"datasetRef"`
		} `json:"blocks"`
	}
	_ = json.Unmarshal(spec, &document)
	result := make(materializer.TablePresentations, len(choices))
	for id, choice := range choices {
		result[id] = choice
	}
	for _, block := range document.Blocks {
		dataset := block.DatasetRef
		if dataset == "" {
			dataset = "primary"
		}
		if _, ok := consumed[dataset]; ok {
			if choice, exists := result[block.ID]; exists {
				choice.Sort = nil
				result[block.ID] = choice
			}
		}
	}
	return result
}
