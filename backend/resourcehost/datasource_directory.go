package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"path"
	"reflect"
	"strings"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"gopkg.in/yaml.v3"
)

// DatasourceDirectory publishes existing Forge datasource YAML through the
// same confined snapshot inventory used for the other native definitions.
func DatasourceDirectory(namespace, directory string) ExtensionDirectory {
	return ExtensionDirectory{Kind: "datasource", Namespace: namespace, Directory: directory, FormatVersion: 1, Suffixes: []string{".yaml", ".yml"}, Load: NativeDatasourceLoader}
}

func NativeDatasourceLoader(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
	data, err := reader.ReadFile(ctx, file)
	if err != nil {
		return nil, err
	}
	// Resolve the same authoring imports/parameters as the workspace repository,
	// through the snapshot reader so dependencies remain confined and captured.
	var node yaml.Node
	if err = strictAuthoredYAML(data, &node); err != nil {
		return nil, err
	}
	if err = resolveNativeAuthoredImports(ctx, reader, file, &node); err != nil {
		return nil, err
	}
	var authored map[string]any
	if err = node.Decode(&authored); err != nil {
		return nil, err
	}
	if authored == nil {
		return nil, identity.ErrResourceDenied
	}
	// The existing datasource authoring format exports a reusable template
	// alongside the merged executable descriptor. It is not a runtime field.
	if declaration, ok := authored["template"]; ok {
		if _, valid := declaration.(map[string]any); !valid {
			return nil, identity.ErrResourceDenied
		}
		delete(authored, "template")
	}
	// Legacy datasource authoring also accepted fixed arguments at the root.
	// Normalize them into the single existing runtime backend path.
	if legacy, present := authored["pinned"]; present {
		fixed, ok := legacy.(map[string]any)
		backend, backendOK := authored["backend"].(map[string]any)
		if !ok || !backendOK {
			return nil, identity.ErrResourceDenied
		}
		pinned := map[string]any{}
		if nested, present := backend["pinned"]; present {
			values, ok := nested.(map[string]any)
			if !ok {
				return nil, identity.ErrResourceDenied
			}
			for key, value := range values {
				pinned[key] = value
			}
		}
		for key, value := range fixed {
			if current, found := pinned[key]; found && !reflect.DeepEqual(current, value) {
				return nil, identity.ErrResourceDenied
			}
			pinned[key] = value
		}
		backend["pinned"] = pinned
		delete(authored, "pinned")
	}
	resolved, err := yaml.Marshal(authored)
	if err != nil {
		return nil, err
	}
	var descriptor dsproto.DataSource
	decoder := yaml.NewDecoder(bytes.NewReader(resolved))
	decoder.KnownFields(true)
	if err = decoder.Decode(&descriptor); err != nil {
		return nil, err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return nil, identity.ErrResourceDenied
	}
	descriptor.ID = strings.TrimSpace(descriptor.ID)
	if descriptor.ID == "" {
		descriptor.ID = strings.TrimSuffix(path.Base(file), path.Ext(file))
	}
	raw, err := json.Marshal(struct {
		SchemaVersion int64               `json:"schemaVersion"`
		DataSource    *dsproto.DataSource `json:"dataSource"`
	}{1, &descriptor})
	if err != nil {
		return nil, err
	}
	if err = ValidateDatasourceDefinition(1, raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func ValidateDatasourceDefinition(version int64, raw json.RawMessage) error {
	if version != 1 {
		return identity.ErrResourceDenied
	}
	_, err := DecodeDatasourceDefinition(raw)
	return err
}
