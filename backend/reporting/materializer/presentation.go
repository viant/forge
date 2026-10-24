package materializer

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/dop251/goja"
)

// ChartMetricSelection is presentation state, never a replacement query or spec.
type ChartMetricSelection struct {
	PrimaryField   string `json:"primaryField"`
	SecondaryField string `json:"secondaryField"`
}

// Present applies field choices through the bundled canonical chart model.
// The host must first resolve and approve the source report and must retain its
// ordinary datasource admission and resource revalidation during execution.
func Present(ctx context.Context, spec json.RawMessage, selections map[string]ChartMetricSelection) (json.RawMessage, error) {
	if ctx == nil {
		return nil, fmt.Errorf("presentation context required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if len(spec) > 8<<20 {
		return nil, fmt.Errorf("report presentation input limit")
	}
	if err := validateUniqueJSON(spec); err != nil {
		return nil, err
	}
	if len(selections) == 0 {
		return append(json.RawMessage(nil), spec...), nil
	}
	raw, err := json.Marshal(struct {
		Spec       json.RawMessage                 `json:"reportSpec"`
		Selections map[string]ChartMetricSelection `json:"chartMetricSelections"`
	}{spec, selections})
	if err != nil {
		return nil, err
	}
	if len(raw) > 8<<20 {
		return nil, fmt.Errorf("report presentation input limit")
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return nil, programError
	}
	value, err := runTrustedEntry(ctx, program, "present", raw)
	if err != nil {
		return nil, err
	}
	result := json.RawMessage(value)
	if len(result) > 16<<20 || !json.Valid(result) {
		return nil, fmt.Errorf("report presentation output invalid")
	}
	return result, nil
}
