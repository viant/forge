package registry

import (
	"encoding/json"
	"fmt"
)

// ReportInclude selects authored definition sections, never live UI state or data.
// A nil selection is handled by callers as their existing complete response.
type ReportInclude struct {
	Description         bool `json:"description,omitempty"`
	Request             bool `json:"request,omitempty"`
	Result              bool `json:"result,omitempty"`
	ResultContract      bool `json:"resultContract,omitempty"`
	DrillMetadata       bool `json:"drillMetadata,omitempty"`
	Inputs              bool `json:"inputs,omitempty"`
	DataSources         bool `json:"dataSources,omitempty"`
	DataSourceResources bool `json:"dataSourceResources,omitempty"`
	Datasets            bool `json:"datasets,omitempty"`
	Dimensions          bool `json:"dimensions,omitempty"`
	Measures            bool `json:"measures,omitempty"`
	CalculatedFields    bool `json:"calculatedFields,omitempty"`
	Refinements         bool `json:"refinements,omitempty"`
	Blocks              bool `json:"blocks,omitempty"`
	Tabs                bool `json:"tabs,omitempty"`
	Layout              bool `json:"layout,omitempty"`
	Presentation        bool `json:"presentation,omitempty"`
	Source              bool `json:"source,omitempty"`
	Binding             bool `json:"binding,omitempty"`
	SemanticSummary     bool `json:"semanticSummary,omitempty"`
	Dependencies        bool `json:"dependencies,omitempty"`
	Metadata            bool `json:"metadata,omitempty"`
	BuilderDefinition   bool `json:"builderDefinition,omitempty"`
	State               bool `json:"state,omitempty"`
	Fill                bool `json:"fill,omitempty"`
	Print               bool `json:"print,omitempty"`
	CompileState        bool `json:"compileState,omitempty"`
	Raw                 bool `json:"raw,omitempty"` // Exact stored JSON envelope, not reconstructed authoring source.
}

// SelectReportDefinition projects existing fields without executing or compiling a report.
// Nested field names remain explicit when different report formats store distinct contracts.
func SelectReportDefinition(raw json.RawMessage, include ReportInclude) (map[string]json.RawMessage, error) {
	var envelope ReportEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	if include.Raw {
		data, err := json.Marshal(map[string]string{"mediaType": "application/json", "content": string(raw)})
		if err != nil {
			return nil, err
		}
		return map[string]json.RawMessage{"raw": data}, nil
	}
	var projectionErr error
	object := func(raw json.RawMessage) map[string]json.RawMessage {
		var v map[string]json.RawMessage
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &v); err != nil && projectionErr == nil {
				projectionErr = fmt.Errorf("report projection: %w", err)
			}
		}
		return v
	}
	spec, document, builder := object(envelope.ReportSpec), object(envelope.ReportDocument), object(envelope.BuilderDefinition)
	builderSource := builder
	builder = object(builder["reportBuilder"])
	semantic := object(spec["semanticSummary"])
	if projectionErr != nil {
		return nil, projectionErr
	}
	out := map[string]json.RawMessage{}
	put := func(key string, value any) {
		if value == nil {
			return
		}
		data, err := json.Marshal(value)
		if err != nil {
			if projectionErr == nil {
				projectionErr = err
			}
			return
		}
		if string(data) != "null" {
			out[key] = data
		}
	}
	fields := func(key string, enabled bool, entries map[string]json.RawMessage) {
		if !enabled {
			return
		}
		selected := map[string]json.RawMessage{}
		for k, v := range entries {
			if len(v) > 0 {
				selected[k] = v
			}
		}
		if len(selected) > 0 {
			put(key, selected)
		}
	}
	fields("description", include.Description, map[string]json.RawMessage{"description": document["description"], "subtitle": document["subtitle"], "specSubtitle": spec["subtitle"]})
	fields("request", include.Request, map[string]json.RawMessage{"request": builder["request"]})
	fields("result", include.Result, map[string]json.RawMessage{"result": builder["result"]})
	fields("resultContract", include.ResultContract, map[string]json.RawMessage{"resultContract": builder["resultContract"]})
	fields("drillMetadata", include.DrillMetadata, map[string]json.RawMessage{"drillMetadata": spec["drillMetadata"]})
	fields("inputs", include.Inputs, map[string]json.RawMessage{"scope": spec["scope"], "parameters": spec["parameters"], "predicates": builder["predicates"]})
	fields("datasets", include.Datasets, map[string]json.RawMessage{"datasets": spec["datasets"], "dataSources": builder["dataSources"]})
	fields("dimensions", include.Dimensions, map[string]json.RawMessage{"dimensions": builder["dimensions"], "selectedDimensions": semantic["selectedDimensions"]})
	fields("measures", include.Measures, map[string]json.RawMessage{"measures": builder["measures"], "selectedMeasures": semantic["selectedMeasures"]})
	fields("calculatedFields", include.CalculatedFields, map[string]json.RawMessage{"spec": spec["calculatedFields"], "builder": builder["calculatedFields"]})
	fields("refinements", include.Refinements, map[string]json.RawMessage{"spec": spec["refinements"], "builder": builder["refinements"]})
	fields("blocks", include.Blocks, map[string]json.RawMessage{"document": document["blocks"], "spec": spec["blocks"]})
	fields("layout", include.Layout, map[string]json.RawMessage{"layout": document["layout"], "layoutIntent": spec["layoutIntent"]})
	fields("presentation", include.Presentation, map[string]json.RawMessage{"viewer": spec["viewer"], "theme": spec["theme"], "documentViewer": document["viewer"], "filterPresentation": builder["filterPresentation"], "showFilterCategoryBar": builder["showFilterCategoryBar"], "showResultHeader": builder["showResultHeader"]})
	fields("source", include.Source, map[string]json.RawMessage{"source": spec["source"], "dataSourceRef": builderSource["dataSourceRef"]})
	fields("binding", include.Binding, map[string]json.RawMessage{"binding": spec["binding"]})
	fields("semanticSummary", include.SemanticSummary, map[string]json.RawMessage{"semanticSummary": spec["semanticSummary"]})
	for _, entry := range []struct {
		key     string
		enabled bool
		value   any
	}{
		{"dataSources", include.DataSources, envelope.DataSources}, {"dataSourceResources", include.DataSourceResources, envelope.DataSourceResources},
		{"dependencies", include.Dependencies, envelope.Dependencies}, {"metadata", include.Metadata, envelope.Metadata},
		{"builderDefinition", include.BuilderDefinition, envelope.BuilderDefinition}, {"state", include.State, envelope.State},
		{"fill", include.Fill, envelope.ReportFill}, {"print", include.Print, envelope.ReportPrint}, {"compileState", include.CompileState, envelope.CompileState},
	} {
		if entry.enabled {
			put(entry.key, entry.value)
		}
	}
	if include.Tabs {
		blocks := document["blocks"]
		if len(blocks) == 0 {
			blocks = spec["blocks"]
		}
		var all []map[string]json.RawMessage
		if err := json.Unmarshal(blocks, &all); err != nil && len(blocks) > 0 {
			return nil, err
		}
		tabs := []map[string]json.RawMessage{}
		for _, block := range all {
			var kind string
			_ = json.Unmarshal(block["kind"], &kind)
			if kind != "tabGroupBlock" && kind != "sectionBlock" {
				continue
			}
			item := map[string]json.RawMessage{}
			for _, key := range []string{"id", "kind", "title", "navigationLabel", "sectionIds", "defaultSectionId", "includeUnlistedSections"} {
				if value := block[key]; len(value) > 0 {
					item[key] = value
				}
			}
			tabs = append(tabs, item)
		}
		put("tabs", tabs)
	}
	return out, projectionErr
}
