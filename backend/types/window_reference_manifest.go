package types

import (
	"encoding/json"
	"fmt"
	primitive "github.com/viant/forge/backend/provider/contract"
)

// WindowReferenceSchemaVersion identifies independently delivered datasource
// definitions. Formats 2 and 3 retain their complete-bundle contract.
const WindowReferenceSchemaVersion = 4
const WindowDeliveryExtension = "io.viant/window/delivery"

func validateWindowReferenceManifest(v WindowResourceVariant) error {
	if v.Window == nil || v.Window.View.Content == nil || v.Window.Resource != nil || v.Window.ResourceTarget != nil || v.Window.SelectionBinding != nil {
		return fmt.Errorf("invalid window reference manifest")
	}
	if err := ValidateResourceModelStructure(v.Window); err != nil {
		return err
	}
	if len(v.DataSources)+len(v.DataSourceResources) != len(v.Window.DataSource) {
		return fmt.Errorf("incomplete window reference manifest")
	}
	for id := range v.Window.DataSource {
		if id == "" {
			return fmt.Errorf("missing datasource identity")
		}
		ref, remote := v.DataSourceResources[id]
		raw, inline := v.DataSources[id]
		if remote == inline {
			return fmt.Errorf("datasource must be inline or referenced: %s", id)
		}
		if remote {
			if err := ref.Validate(false); err != nil {
				return err
			}
			continue
		}
		var descriptor struct {
			ID string `json:"id"`
		}
		fingerprint, err := WindowDescriptorFingerprint(raw)
		if err != nil || json.Unmarshal(raw, &descriptor) != nil || descriptor.ID != id || fingerprint != v.Window.ResourceDependencies[id] {
			return fmt.Errorf("invalid inline datasource: %s", id)
		}
	}
	return nil
}

// MaterializeWindowReferences assembles a detached runtime variant from exact
// independently fetched datasource resource bytes keyed by local binding ID.
// It does not fetch data or authorize reads. The caller owns those operations.
// Local window bindings and the original manifest fingerprint are preserved.
func MaterializeWindowReferences(manifest WindowResourceVariant, definitions map[string]json.RawMessage) (*WindowResourceVariant, error) {
	if err := validateWindowReferenceManifest(manifest); err != nil {
		return nil, err
	}
	if len(definitions) != len(manifest.DataSourceResources) {
		return nil, fmt.Errorf("incomplete datasource definitions")
	}
	encoded, err := json.Marshal(manifest)
	if err != nil {
		return nil, err
	}
	var result WindowResourceVariant
	if err = json.Unmarshal(encoded, &result); err != nil {
		return nil, err
	}
	result.Fingerprint = manifest.Fingerprint
	if result.DataSources == nil {
		result.DataSources = map[string]json.RawMessage{}
	}
	for id := range manifest.DataSourceResources {
		raw, ok := definitions[id]
		if !ok {
			return nil, fmt.Errorf("missing datasource resource: %s", id)
		}
		var envelope struct {
			SchemaVersion int             `json:"schemaVersion"`
			DataSource    json.RawMessage `json:"dataSource"`
		}
		if json.Unmarshal(raw, &envelope) != nil || envelope.SchemaVersion != 1 {
			return nil, fmt.Errorf("invalid datasource resource: %s", id)
		}
		var descriptor map[string]json.RawMessage
		if json.Unmarshal(envelope.DataSource, &descriptor) != nil || descriptor == nil {
			return nil, fmt.Errorf("invalid datasource descriptor: %s", id)
		}
		var originalID string
		if json.Unmarshal(descriptor["id"], &originalID) != nil || originalID == "" {
			return nil, fmt.Errorf("missing datasource identity: %s", id)
		}
		descriptor["id"], _ = json.Marshal(id)
		bytes, err := json.Marshal(descriptor)
		if err != nil {
			return nil, err
		}
		result.DataSources[id], err = CanonicalWindowDescriptor(bytes)
		if err != nil {
			return nil, err
		}
	}
	return &result, nil
}

// MaterializeWindowDatasource resolves one local binding without waiting for
// any sibling definition. The returned descriptor is detached from its inputs.
func MaterializeWindowDatasource(manifest WindowResourceVariant, id string, raw json.RawMessage) (json.RawMessage, error) {
	ref, ok := manifest.DataSourceResources[id]
	if !ok || manifest.Window == nil {
		return nil, fmt.Errorf("unknown datasource: %s", id)
	}
	binding, ok := manifest.Window.DataSource[id]
	if !ok {
		return nil, fmt.Errorf("missing local binding: %s", id)
	}
	window := *manifest.Window
	window.Resource, window.ResourceTarget, window.SelectionBinding = nil, nil, nil
	window.DataSource = map[string]DataSource{id: binding}
	window.ResourceDependencies = map[string]string{id: manifest.Window.ResourceDependencies[id]}
	subset := WindowResourceVariant{Window: &window, DataSourceResources: map[string]primitive.DataSourceReference{id: ref}}
	result, err := MaterializeWindowReferences(subset, map[string]json.RawMessage{id: raw})
	if err != nil {
		return nil, err
	}
	return result.DataSources[id], nil
}
