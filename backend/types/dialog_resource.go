package types

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DecodeDialogResource uses the same dialog model as embedded windows. Callers
// retain the original bytes for resource identity; decoding never rewrites them.
func DecodeDialogResource(version int64, raw json.RawMessage) (*Dialog, error) {
	if version != 1 {
		return nil, fmt.Errorf("unsupported dialog resource version")
	}
	var dialog Dialog
	if err := json.Unmarshal(raw, &dialog); err != nil {
		return nil, err
	}
	if strings.TrimSpace(dialog.Id) == "" || dialog.Content == nil {
		return nil, fmt.Errorf("dialog id and content required")
	}
	return &dialog, nil
}
