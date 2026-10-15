// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"strings"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"gopkg.in/yaml.v3"
)

// ToolfeedDirectory maps an operator-selected local folder to an explicit
// logical namespace. The recursive filename path determines canonical identity;
// the authored ID continues to identify runtime feed activity.
func ToolfeedDirectory(namespace, directory string) ExtensionDirectory {
	return ExtensionDirectory{Kind: primitive.ToolfeedKind, Namespace: namespace, Directory: directory, FormatVersion: primitive.ToolfeedFormatVersion, Suffixes: []string{".yaml", ".yml"}, Load: NativeToolfeedLoader}
}

// NativeToolfeedLoader retains the existing FeedSpec YAML vocabulary and ID.
// A missing ID follows the legacy filename fallback. It emits only definitions;
// no invocation, activation, conversation state or authority is materialized.
func NativeToolfeedLoader(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
	data, err := reader.ReadFile(ctx, file)
	if err != nil {
		return nil, err
	}
	var fields map[string]interface{}
	decoder := yaml.NewDecoder(bytes.NewReader(data))
	if err := decoder.Decode(&fields); err != nil {
		return nil, err
	}
	if fields == nil || decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("invalid toolfeed YAML document")
	}
	id, present := fields["id"]
	if !present || id == "" {
		fields["id"] = strings.TrimSuffix(path.Base(file), path.Ext(file))
	}
	raw, err := json.Marshal(fields)
	if err != nil {
		return nil, err
	}
	if err := ValidateToolfeedDefinition(primitive.ToolfeedFormatVersion, raw); err != nil {
		return nil, err
	}
	return raw, nil
}
func ValidateToolfeedDefinition(version int64, raw json.RawMessage) error {
	_, err := primitive.DecodeToolfeedDefinition(version, raw)
	return err
}

// SnapshotToolfeedDefinitions reuses the same confined startup inventory. These
// static loaders grant no authority; the existing provider supplies its policy.
func SnapshotToolfeedDefinitions(ctx context.Context, root string, directories []ExtensionDirectory) ([]NativeSnapshotDefinition, error) {
	for _, directory := range directories {
		if directory.Kind != primitive.ToolfeedKind || directory.FormatVersion != primitive.ToolfeedFormatVersion {
			return nil, identity.ErrResource
		}
	}
	return SnapshotExtensionDefinitions(ctx, root, directories)
}
