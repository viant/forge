package reportspec

import "encoding/json"

// MarshalJSON retains the required empty columnKeys array for static
// datasets. Non-static request encoding is unchanged because its canonical
// bytes are used by ReportFill provenance hashes.
func (r RequestPayload) MarshalJSON() ([]byte, error) {
	type plain RequestPayload
	payload, err := json.Marshal(plain(r))
	if err != nil || !r.isStatic() || r.ColumnKeys == nil || len(r.ColumnKeys) > 0 {
		return payload, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(payload, &fields); err != nil {
		return nil, err
	}
	columns, err := json.Marshal(r.ColumnKeys)
	if err != nil {
		return nil, err
	}
	fields["columnKeys"] = columns
	return json.Marshal(fields)
}

// MarshalJSON preserves the kind-specific columns field. Block stores table,
// kanban and collection columns in separate Go fields, but all three use the
// same JSON key. Encoding the struct directly makes encoding/json discard the
// ambiguous key altogether.
func (b Block) MarshalJSON() ([]byte, error) {
	type plain Block
	payload, err := json.Marshal(plain(b))
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(payload, &fields); err != nil {
		return nil, err
	}
	var columns any
	switch b.Kind {
	case "tableBlock":
		columns = b.Columns
	case "kanbanBlock":
		columns = b.ColumnsLayout
	case "collectionBlock":
		columns = b.CollectionCols
	default:
		return json.Marshal(fields)
	}
	encoded, err := json.Marshal(columns)
	if err != nil {
		return nil, err
	}
	fields["columns"] = encoded
	return json.Marshal(fields)
}
