package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/dop251/goja"
)

// WindowBuilderPreparation is assembled only by the host from its admitted
// selected window. Selection is untrusted presentation state; configuration,
// current definition and attached binding IDs are never taken from the client.
type WindowBuilderPreparation struct {
	Container             json.RawMessage        `json:"container"`
	Config                json.RawMessage        `json:"config"`
	Selection             json.RawMessage        `json:"selection"`
	Definition            json.RawMessage        `json:"definition,omitempty"`
	WindowParameters      map[string]interface{} `json:"windowParameters,omitempty"`
	AttachedDataSourceIDs []string               `json:"attachedDataSourceIds"`
}

type PreparedWindowBuilder struct {
	Config         json.RawMessage `json:"config"`
	State          json.RawMessage `json:"state"`
	ReportDocument json.RawMessage `json:"reportDocument"`
	ReportSpec     json.RawMessage `json:"reportSpec"`
}

// PrepareWindowBuilder uses the same official state adapter as the UI. It does
// not evaluate any metadata hook or establish datasource authority itself.
func PrepareWindowBuilder(ctx context.Context, input WindowBuilderPreparation) (*PreparedWindowBuilder, error) {
	result, err := callWindowBuilderEntry(ctx, "prepareWindowBuilder", input)
	if err != nil {
		return nil, err
	}
	var output PreparedWindowBuilder
	if json.Unmarshal(result, &output) != nil || len(output.Config) == 0 || len(output.State) == 0 || len(output.ReportDocument) == 0 || len(output.ReportSpec) == 0 {
		return nil, fmt.Errorf("trusted lowerer returned invalid window builder")
	}
	return &output, nil
}

func callWindowBuilderEntry(ctx context.Context, entry string, input interface{}) (json.RawMessage, error) {
	if ctx == nil {
		return nil, fmt.Errorf("materializer context required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	raw, err := json.Marshal(input)
	if err != nil || len(raw) > 8<<20 {
		return nil, fmt.Errorf("invalid window builder preparation")
	}
	if err = validateUniqueJSON(raw); err != nil {
		return nil, fmt.Errorf("invalid window builder JSON")
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return nil, fmt.Errorf("trusted lowerer bundle invalid")
	}
	result, err := runTrustedEntry(ctx, program, entry, raw)
	if err != nil {
		return nil, err
	}
	if len(result) > 16<<20 {
		return nil, fmt.Errorf("prepared window builder exceeds materializer limit")
	}
	if !json.Valid([]byte(result)) {
		return nil, fmt.Errorf("trusted window builder returned invalid JSON")
	}
	return json.RawMessage(result), nil
}

// ValidateWindowBuilderIdentity runs before any metadata/business producer call.
// It validates declared input types; matching returned identity happens later.
func ValidateWindowBuilderIdentity(ctx context.Context, config json.RawMessage, parameters map[string]interface{}) error {
	_, err := callWindowBuilderEntry(ctx, "reportWindowIdentity", map[string]interface{}{"config": config, "windowParameters": parameters})
	return err
}

// MapBuilderRequest applies the shared official mapper after query overrides.
// Only the host-admitted builder definition supplies configuration/context.
func MapBuilderRequest(ctx context.Context, builderRaw json.RawMessage, query map[string]interface{}, datasetID string) (map[string]interface{}, error) {
	var builder struct {
		ReportBuilder struct {
			Request struct {
				Envelope json.RawMessage `json:"envelope"`
			} `json:"request"`
		} `json:"reportBuilder"`
	}
	if len(builderRaw) == 0 {
		return query, nil
	}
	if json.Unmarshal(builderRaw, &builder) != nil {
		return nil, fmt.Errorf("invalid report builder request definition")
	}
	if len(builder.ReportBuilder.Request.Envelope) == 0 || string(builder.ReportBuilder.Request.Envelope) == "null" {
		return query, nil
	}
	var raw struct {
		ReportBuilder json.RawMessage `json:"reportBuilder"`
	}
	if json.Unmarshal(builderRaw, &raw) != nil {
		return nil, fmt.Errorf("invalid report builder request definition")
	}
	result, err := callWindowBuilderEntry(ctx, "mapReportRequest", map[string]interface{}{"config": raw.ReportBuilder, "query": query, "datasetId": datasetID})
	if err != nil {
		return nil, err
	}
	var output map[string]interface{}
	decoder := json.NewDecoder(bytes.NewReader(result))
	decoder.UseNumber()
	if decoder.Decode(&output) != nil || output == nil {
		return nil, fmt.Errorf("trusted report request mapper returned invalid arguments")
	}
	return output, nil
}
