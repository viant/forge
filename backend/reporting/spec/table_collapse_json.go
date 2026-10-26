package reportspec

// Use the same kind-aware decoder for direct Go JSON clients and report
// decoding, retaining both table defaults and the kind-specific columns.
func (b *Block) UnmarshalJSON(data []byte) error {
	value, err := decodeBlock(data, 0)
	if err != nil {
		return err
	}
	*b = value
	return nil
}

func tableDefaultCollapsed(collapsible bool, value *bool) bool {
	if value != nil {
		return *value
	}
	return collapsible
}
