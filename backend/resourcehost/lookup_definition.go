package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"strings"

	lookup "github.com/viant/forge/backend/lookup/contract"
	identity "github.com/viant/forge/backend/resource"
	"gopkg.in/yaml.v3"
)

// LookupDirectory publishes the original Overlay authoring model unchanged.
func LookupDirectory(namespace, directory string) ExtensionDirectory {
	return ExtensionDirectory{Kind: "lookup", Namespace: namespace, Directory: directory, FormatVersion: 1, Suffixes: []string{".yaml", ".yml"}, Load: NativeLookupLoader}
}
func NativeLookupLoader(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
	raw, err := reader.ReadFile(ctx, file)
	if err != nil {
		return nil, err
	}
	var definition lookup.Overlay
	decoder := yaml.NewDecoder(bytes.NewReader(raw))
	decoder.KnownFields(true)
	if err = decoder.Decode(&definition); err != nil {
		return nil, err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("lookup must be one YAML document")
	}
	if definition.ID == "" {
		definition.ID = strings.TrimSuffix(path.Base(file), path.Ext(file))
	}
	encoded, err := json.Marshal(&definition)
	if err != nil {
		return nil, err
	}
	if err = ValidateLookupDefinition(1, encoded); err != nil {
		return nil, err
	}
	return encoded, nil
}
func DecodeLookupDefinition(version int64, raw json.RawMessage) (*lookup.Overlay, error) {
	if version != 1 {
		return nil, identity.ErrResource
	}
	var definition lookup.Overlay
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&definition); err != nil {
		return nil, err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return nil, identity.ErrResource
	}
	if strings.TrimSpace(definition.ID) == "" {
		return nil, fmt.Errorf("lookup id required")
	}
	switch definition.Mode {
	case "", lookup.ModePartial, lookup.ModeStrict, lookup.ModeThreshold:
	default:
		return nil, fmt.Errorf("unsupported lookup matching mode")
	}
	if definition.Threshold < 0 {
		return nil, fmt.Errorf("invalid lookup threshold")
	}
	return &definition, nil
}
func ValidateLookupDefinition(version int64, raw json.RawMessage) error {
	_, err := DecodeLookupDefinition(version, raw)
	return err
}
