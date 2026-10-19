package datasource

import "encoding/json"

// MarshalJSON preserves an explicitly authored empty rows array. An empty
// inline source is a valid producer; omitting its rows changes that contract.
func (b Backend) MarshalJSON() ([]byte, error) {
	type wire Backend
	var rows *[]map[string]interface{}
	if b.Rows != nil {
		rows = &b.Rows
	}
	return json.Marshal(struct {
		*wire
		Rows *[]map[string]interface{} `json:"rows,omitempty"`
	}{wire: (*wire)(&b), Rows: rows})
}
