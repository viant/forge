package materializer

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// NormalizeDatasetResult applies the same approved result contract used by
// Materialize to one producer page, before a host counts/aggregates its rows.
// It preserves numeric JSON values and does not dispatch a datasource.
func NormalizeDatasetResult(contract, payload json.RawMessage) (json.RawMessage, error) {
	spec, err := json.Marshal(map[string]interface{}{"datasets": []map[string]interface{}{{"id": "result", "resultContract": contract}}})
	if err != nil {
		return nil, err
	}
	results, err := normalizeDatasetResults(spec, map[string]json.RawMessage{"result": payload})
	if err != nil {
		return nil, err
	}
	return results["result"], nil
}

// normalizeDatasetResults applies declarative result contracts before the
// official fill/print builder consumes rows. RawMessage preserves numeric values.
func normalizeDatasetResults(spec json.RawMessage, payloads map[string]json.RawMessage) (map[string]json.RawMessage, error) {
	var definition struct {
		Datasets []struct {
			ID       string `json:"id"`
			Contract *struct {
				Shape       string `json:"shape"`
				RowPath     string `json:"rowPath"`
				HasMorePath string `json:"hasMorePath"`
			} `json:"resultContract"`
		} `json:"datasets"`
	}
	if err := json.Unmarshal(spec, &definition); err != nil {
		return nil, err
	}
	out := make(map[string]json.RawMessage, len(payloads))
	for id, raw := range payloads {
		out[id] = raw
	}
	for _, dataset := range definition.Datasets {
		c := dataset.Contract
		if c == nil || c.RowPath == "" && c.HasMorePath == "" {
			continue
		}
		raw, ok := payloads[dataset.ID]
		if !ok {
			continue
		}
		if err := validateUniqueJSON(raw); err != nil {
			return nil, err
		}
		var body map[string]json.RawMessage
		if err := json.Unmarshal(raw, &body); err != nil || body == nil {
			return nil, fmt.Errorf("dataset %s requires an object payload", dataset.ID)
		}
		if c.RowPath != "" {
			selected, found := resultPath(raw, c.RowPath)
			if found {
				var rows []json.RawMessage
				if strings.EqualFold(c.Shape, "tabular") {
					var table struct {
						Columns []struct {
							Name string `json:"name"`
							Key  string `json:"key"`
							ID   string `json:"id"`
						} `json:"columns"`
						Rows []json.RawMessage `json:"rows"`
					}
					if err := json.Unmarshal(selected, &table); err != nil || table.Columns == nil || table.Rows == nil {
						return nil, fmt.Errorf("dataset %s has invalid tabular result", dataset.ID)
					}
					names := make([]string, len(table.Columns))
					seen := map[string]bool{}
					for i, col := range table.Columns {
						name := col.Name
						if name == "" {
							name = col.Key
						}
						if name == "" {
							name = col.ID
						}
						name = strings.TrimSpace(name)
						if name == "" || seen[name] {
							return nil, fmt.Errorf("dataset %s has ambiguous tabular columns", dataset.ID)
						}
						seen[name] = true
						names[i] = name
					}
					rows = make([]json.RawMessage, 0, len(table.Rows))
					for _, row := range table.Rows {
						if strings.HasPrefix(strings.TrimSpace(string(row)), "{") {
							rows = append(rows, row)
							continue
						}
						var values []json.RawMessage
						if err := json.Unmarshal(row, &values); err != nil {
							return nil, fmt.Errorf("dataset %s has invalid tabular row", dataset.ID)
						}
						record := map[string]json.RawMessage{}
						for i, name := range names {
							record[name] = json.RawMessage("null")
							if i < len(values) {
								record[name] = values[i]
							}
						}
						encoded, err := json.Marshal(record)
						if err != nil {
							return nil, err
						}
						rows = append(rows, encoded)
					}
				} else if string(selected) == "null" {
					rows = []json.RawMessage{}
				} else if err := json.Unmarshal(selected, &rows); err != nil {
					var record map[string]json.RawMessage
					if json.Unmarshal(selected, &record) != nil || record == nil {
						return nil, fmt.Errorf("dataset %s has invalid row result", dataset.ID)
					}
					rows = []json.RawMessage{selected}
				}
				encoded, err := json.Marshal(rows)
				if err != nil {
					return nil, err
				}
				body["rows"] = encoded
			}
		}
		if c.HasMorePath != "" {
			if value, found := resultPath(raw, c.HasMorePath); found {
				body["hasMore"] = json.RawMessage("false")
				if string(value) == "true" {
					body["hasMore"] = json.RawMessage("true")
				}
			}
		}
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		out[dataset.ID] = encoded
	}
	return out, nil
}
func resultPath(raw json.RawMessage, path string) (json.RawMessage, bool) {
	if path == "." {
		return raw, true
	}
	for _, part := range strings.Split(path, ".") {
		var object map[string]json.RawMessage
		if json.Unmarshal(raw, &object) == nil && object != nil {
			value, ok := object[part]
			if !ok {
				return nil, false
			}
			raw = value
			continue
		}
		var list []json.RawMessage
		index, err := strconv.Atoi(part)
		if err != nil || json.Unmarshal(raw, &list) != nil || index < 0 || index >= len(list) {
			return nil, false
		}
		raw = list[index]
	}
	return raw, true
}
