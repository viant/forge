package primitive

import (
	"encoding/json"
	"fmt"
)

// DocumentCarrier reads the two existing document representations without
// guessing whether an arbitrary text string resembles base64. Supporting files
// need not be decoded when only the document's declared header is needed.
type DocumentCarrier struct {
	SchemaVersion int64           `json:"schemaVersion"`
	Document      json.RawMessage `json:"document"`
}

func (c DocumentCarrier) Bytes() ([]byte, error) {
	switch c.SchemaVersion {
	case 0:
		var value []byte
		err := json.Unmarshal(c.Document, &value)
		return value, err
	case AIEnvelopeVersion:
		var value string
		err := json.Unmarshal(c.Document, &value)
		return []byte(value), err
	default:
		return nil, fmt.Errorf("unsupported document envelope version %d", c.SchemaVersion)
	}
}
