package reporting

import (
	"encoding/json"

	identity "github.com/viant/forge/backend/resource"
)

// tableExecutionProjection narrows presentation only after the complete report
// has been compiled and admitted. The original spec and resource pin stay intact.
type tableExecutionProjection struct {
	id       string
	datasets map[string]bool
}

func planTableExecution(raw json.RawMessage, requested string) (*tableExecutionProjection, error) {
	var root struct {
		Blocks           []map[string]interface{} `json:"blocks"`
		Datasets         []map[string]interface{} `json:"datasets"`
		CalculatedFields []map[string]interface{} `json:"calculatedFields"`
	}
	if decodeReportPagingJSON(raw, &root) != nil {
		return nil, identity.ErrResourceDenied
	}
	name := func(value interface{}) string { result, _ := value.(string); return result }
	var table map[string]interface{}
	for _, block := range root.Blocks {
		if name(block["kind"]) != "tableBlock" || requested != "" && name(block["id"]) != requested {
			continue
		}
		if table != nil || name(block["datasetRef"]) == "" {
			return nil, identity.ErrResourceDenied
		}
		table = block
	}
	if table == nil {
		return nil, identity.ErrResourceDenied
	}
	known := map[string]map[string]interface{}{}
	for _, dataset := range root.Datasets {
		known[name(dataset["id"])] = dataset
	}
	plan := &tableExecutionProjection{id: name(table["id"]), datasets: map[string]bool{}}
	var collect func(interface{}) error
	collect = func(value interface{}) error {
		switch item := value.(type) {
		case map[string]interface{}:
			for key, value := range item {
				switch key {
				case "datasetRef", "secondaryDatasetRef", "comparisonDatasetRef":
					if id := name(value); id != "" {
						if known[id] == nil {
							return identity.ErrResourceDenied
						}
						plan.datasets[id] = true
					}
				case "datasetRefs":
					values, _ := value.([]interface{})
					for _, value := range values {
						id := name(value)
						if known[id] == nil {
							return identity.ErrResourceDenied
						}
						plan.datasets[id] = true
					}
				default:
					if err := collect(value); err != nil {
						return err
					}
				}
			}
		case []interface{}:
			for _, value := range item {
				if err := collect(value); err != nil {
					return err
				}
			}
		}
		return nil
	}
	if err := collect(table); err != nil {
		return nil, err
	}
	// Retain the declared dependency closure, including dependencies in a selected
	// dataset's calculation/source metadata, rather than assuming one dataset.
	for {
		before := len(plan.datasets)
		for id := range plan.datasets {
			if err := collect(known[id]); err != nil {
				return nil, err
			}
		}
		for _, field := range root.CalculatedFields {
			if scope := name(field["datasetRef"]); scope == "" || plan.datasets[scope] {
				if err := collect(field); err != nil {
					return nil, err
				}
			}
		}
		if len(plan.datasets) == before {
			break
		}
	}
	return plan, nil
}

func (p *tableExecutionProjection) materializationSpec(raw json.RawMessage) (json.RawMessage, error) {
	var root map[string]json.RawMessage
	if err := decodeReportPagingJSON(raw, &root); err != nil {
		return nil, err
	}
	for _, member := range []string{"blocks", "datasets", "calculatedFields"} {
		var entries []json.RawMessage
		if len(root[member]) == 0 {
			continue
		}
		if err := json.Unmarshal(root[member], &entries); err != nil {
			return nil, err
		}
		selected := make([]json.RawMessage, 0, len(entries))
		for _, entry := range entries {
			var selector struct {
				ID         string `json:"id"`
				DatasetRef string `json:"datasetRef"`
			}
			if err := json.Unmarshal(entry, &selector); err != nil {
				return nil, err
			}
			keep := member == "blocks" && selector.ID == p.id || member == "datasets" && p.datasets[selector.ID] || member == "calculatedFields" && (selector.DatasetRef == "" || p.datasets[selector.DatasetRef])
			if keep {
				selected = append(selected, entry)
			}
		}
		var err error
		root[member], err = json.Marshal(selected)
		if err != nil {
			return nil, err
		}
	}
	// A selected table has no dashboard parent/container ordering. Retain raw
	// authored values so projection never changes wide integers or other metadata.
	var layout map[string]json.RawMessage
	if json.Unmarshal(root["layoutIntent"], &layout) != nil || layout == nil {
		layout = map[string]json.RawMessage{}
	}
	layout["kind"] = json.RawMessage(`"stack"`)
	layout["blockOrder"], _ = json.Marshal([]string{p.id})
	delete(layout, "items")
	root["layoutIntent"], _ = json.Marshal(layout)
	return json.Marshal(root)
}
