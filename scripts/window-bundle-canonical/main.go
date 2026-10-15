//go:build js && wasm

// Browser bridge to canonical backend fingerprints; no service or alternate model.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/types"
	"github.com/viant/forge/scripts/internal/windowyaml"
	"syscall/js"
)

func canonicalize(input string) (string, error) {
	return compile(input, nil, "")
}
func compile(input string, descriptors map[string]map[string]json.RawMessage, baseline string) (string, error) {
	var jsonSource []byte
	var err error
	if json.Valid([]byte(input)) {
		// Strict duplicate/depth/precision checking remains canonical backend code.
		jsonSource, err = types.CanonicalWindowDescriptor([]byte(input))
	} else {
		jsonSource, err = windowyaml.JSON([]byte(input))
	}
	if err != nil {
		return "", err
	}
	var envelope types.WindowResourceEnvelope
	decoder := json.NewDecoder(bytes.NewReader(jsonSource))
	decoder.UseNumber()
	if err := decoder.Decode(&envelope); err != nil {
		return "", err
	}
	var original types.WindowResourceEnvelope
	if baseline != "" {
		var raw []byte
		var e error
		if json.Valid([]byte(baseline)) {
			raw = []byte(baseline)
		} else {
			raw, e = windowyaml.JSON([]byte(baseline))
			if e != nil {
				return "", e
			}
		}
		if json.Unmarshal(raw, &original) != nil {
			return "", fmt.Errorf("invalid original authoring sidecar")
		}
	}
	normalized := map[string]types.WindowResourceVariant{}
	keys := map[string]string{}
	dependencies := map[string]map[string]string{}
	runtime := map[string]map[string]json.RawMessage{}
	for old, variant := range envelope.Variants {
		if variant.Window == nil {
			return "", fmt.Errorf("variant %s requires window", old)
		}
		for id, descriptor := range descriptors[old] {
			if len(descriptor) > 0 && descriptor[0] == '"' {
				var text string
				if err := json.Unmarshal(descriptor, &text); err != nil {
					return "", err
				}
				if json.Valid([]byte(text)) {
					descriptor = []byte(text)
				} else {
					var err error
					descriptor, err = windowyaml.JSON([]byte(text))
					if err != nil {
						return "", err
					}
				}
			}

			if _, pinned := variant.DataSourceResources[id]; pinned {
				return "", fmt.Errorf("referenced datasource %s must be edited through its datasource resource", id)
			}
			previous, err := json.Marshal(variant.Window.DataSource[id])
			if err != nil {
				return "", err
			}
			projected, err := types.CompileWindowDataSourceAgainst(id, descriptor, original.Variants[old].DataSources[id], previous)
			if err != nil {
				return "", err
			}
			var value types.DataSource
			d := json.NewDecoder(bytes.NewReader(projected))
			d.UseNumber()
			if err = d.Decode(&value); err != nil {
				return "", err
			}
			if variant.Window.DataSource == nil {
				variant.Window.DataSource = map[string]types.DataSource{}
			}
			variant.Window.DataSource[id] = value
			if runtime[old] == nil {
				runtime[old] = map[string]json.RawMessage{}
			}
			runtime[old][id] = projected
		}
		for id := range variant.Window.ResourceDependencies {
			if _, ok := variant.DataSources[id]; !ok {
				return "", fmt.Errorf("orphan datasource dependency %s", id)
			}
		}
		deps := map[string]string{}
		for id, descriptor := range variant.DataSources {
			hash, err := types.WindowDescriptorFingerprint(descriptor)
			if err != nil {
				return "", err
			}
			deps[id] = hash
		}
		variant.Window.ResourceDependencies = deps
		hash, err := types.WindowVariantFingerprint(variant)
		if err != nil {
			return "", err
		}
		keys[old] = hash
		dependencies[old] = deps
		normalized[hash] = variant
	}
	envelope.Variants = normalized
	for i := range envelope.Targets {
		if key, ok := keys[envelope.Targets[i].Variant]; ok {
			envelope.Targets[i].Variant = key
		}
	}
	if err := envelope.Validate(); err != nil {
		return "", err
	}
	result, err := json.Marshal(map[string]interface{}{"keys": keys, "dependencies": dependencies, "runtime": runtime})
	return string(result), err
}
func main() {
	js.Global().Set("forgeWindowCanonicalize", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		result, err := canonicalize(args[0].String())
		if err != nil {
			return map[string]interface{}{"error": err.Error()}
		}
		return map[string]interface{}{"result": result}
	}))
	js.Global().Set("forgeWindowCompile", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		var request struct {
			Baseline    string                                `json:"baseline"`
			Source      string                                `json:"source"`
			Descriptors map[string]map[string]json.RawMessage `json:"descriptors"`
		}
		if len(args) != 1 || json.Unmarshal([]byte(args[0].String()), &request) != nil {
			return map[string]interface{}{"error": "invalid authoring compilation request"}
		}
		result, err := compile(request.Source, request.Descriptors, request.Baseline)
		if err != nil {
			return map[string]interface{}{"error": err.Error()}
		}
		return map[string]interface{}{"result": result}
	}))
	select {}
}
