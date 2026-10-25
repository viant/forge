// Package materializer lowers pinned authored reports with the bundled official
// Forge lowerer. Input strings are data; no metadata-provided JavaScript runs.
package materializer

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

//go:embed lowerer.bundle.js
var bundle string
var programOnce sync.Once
var program *goja.Program
var programError error

// Lower accepts the exact envelope verified by the host resource resolver. The
// resulting spec is still subject to the host's compiler and datasource gates.
func Lower(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	return LowerWithRequestBase(ctx, raw, nil)
}

// LowerWithRequestBase validates the original fingerprinted envelope before
// applying host-bound predicate values to an invocation-local builder copy.
func LowerWithRequestBase(ctx context.Context, raw json.RawMessage, requestBase map[string]interface{}) (json.RawMessage, error) {
	return lowerWithSourceKind(ctx, raw, requestBase, "report")
}

// LowerWindowBuilderWithRequestBase is restricted to a host-derived envelope.
// The engine retains and revalidates the original window pin independently.
func LowerWindowBuilderWithRequestBase(ctx context.Context, raw json.RawMessage, requestBase map[string]interface{}) (json.RawMessage, error) {
	return lowerWithSourceKind(ctx, raw, requestBase, "window")
}

func lowerWithSourceKind(ctx context.Context, raw json.RawMessage, requestBase map[string]interface{}, sourceKind string) (json.RawMessage, error) {
	if ctx == nil {
		return nil, fmt.Errorf("materializer context required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if len(raw) > 8<<20 {
		return nil, fmt.Errorf("authored report exceeds materializer limit")
	}
	if err := validateUniqueJSON(raw); err != nil {
		return nil, fmt.Errorf("invalid authored report JSON: %w", err)
	}
	var envelope registry.ReportEnvelope
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&envelope) != nil || decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("invalid authored report envelope")
	}
	if err := validateEnvelopeSourceKind(envelope, sourceKind); err != nil {
		return nil, err
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return nil, fmt.Errorf("trusted lowerer bundle invalid: %w", programError)
	}
	entry, input := "lower", raw
	if requestBase != nil {
		var err error
		input, err = json.Marshal(map[string]interface{}{"envelope": json.RawMessage(raw), "requestBaseParameters": requestBase})
		if err != nil || len(input) > 8<<20 {
			return nil, fmt.Errorf("invalid bound report request")
		}
		entry = "lowerWithRequestBase"
	}
	lowerTiming := observe.Start(ctx, "report.materializer.lower.run", observe.Labels{Kind: "report"})
	result, err := runTrustedEntry(ctx, program, entry, input)
	lowerTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	output := json.RawMessage(result)
	if len(output) > 16<<20 || !json.Valid(output) {
		return nil, fmt.Errorf("trusted lowerer returned invalid spec")
	}
	var spec struct {
		Kind   string `json:"kind"`
		Source struct {
			DataSourceRef string `json:"dataSourceRef"`
		} `json:"source"`
		Datasets []struct {
			DataSourceRef string          `json:"dataSourceRef"`
			Rows          json.RawMessage `json:"rows"`
		} `json:"datasets"`
	}
	if json.Unmarshal(output, &spec) != nil || spec.Kind != "reportSpec" || envelope.DataSources[spec.Source.DataSourceRef] == nil {
		return nil, fmt.Errorf("authored report primary datasource unresolved")
	}
	for _, dataset := range spec.Datasets {
		if dataset.DataSourceRef != "" && envelope.DataSources[dataset.DataSourceRef] == nil {
			return nil, fmt.Errorf("authored report datasource unresolved")
		}
	}
	return output, nil
}
func loweringError(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	return fmt.Errorf("authored report lowering failed: %w", err)
}
func validateEnvelope(e registry.ReportEnvelope) error {
	return validateEnvelopeSourceKind(e, "report")
}

func validateEnvelopeSourceKind(e registry.ReportEnvelope, sourceKind string) error {
	if sourceKind != "report" && sourceKind != "window" {
		return identity.ErrResourceDenied
	}
	if e.SchemaVersion != 1 || e.Format != registry.AuthoredReportFormat || len(e.ReportSpec) != 0 || e.BuilderRef == "" || len(e.ReportDocument) == 0 || len(e.BuilderDefinition) == 0 || len(e.DataSources) == 0 {
		return fmt.Errorf("incomplete authored report envelope")
	}
	var document, state map[string]any
	if json.Unmarshal(e.ReportDocument, &document) != nil || len(document) == 0 || json.Unmarshal(e.State, &state) != nil || state == nil {
		return fmt.Errorf("invalid authored report document or state")
	}
	var builder struct {
		ID            string         `json:"id"`
		ReportBuilder map[string]any `json:"reportBuilder"`
	}
	if json.Unmarshal(e.BuilderDefinition, &builder) != nil || builder.ID != e.BuilderRef || len(builder.ReportBuilder) == 0 {
		return fmt.Errorf("authored report builder mismatch")
	}
	seen := map[string]bool{}
	builderCount, reportCount := 0, 0
	ds := map[string]bool{}
	for _, dep := range e.Dependencies {
		key := dep.Kind + ":" + dep.ID
		if dep.ID == "" || seen[key] || !(identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: dep.ContentFingerprint}).Valid() {
			return fmt.Errorf("invalid authored report dependency")
		}
		seen[key] = true
		switch dep.Kind {
		case "builder":
			builderCount++
			if dep.ID != e.BuilderRef {
				return fmt.Errorf("authored builder fingerprint mismatch")
			}
			if dep.ContentFingerprint != identity.ContentFingerprint(e.BuilderDefinition) {
				return &AuthoredDependencyFingerprintError{kind: "builder"}
			}
		case "datasource":
			descriptor := e.DataSources[dep.ID]
			var object map[string]any
			if len(descriptor) == 0 || json.Unmarshal(descriptor, &object) != nil || len(object) == 0 {
				return fmt.Errorf("authored datasource fingerprint mismatch")
			}
			if dep.ContentFingerprint != identity.ContentFingerprint(descriptor) {
				return &AuthoredDependencyFingerprintError{kind: "datasource"}
			}
			ds[dep.ID] = true
		case "report", "window":
			reportCount++
			uri, err := identity.ParseResourceURI(dep.ID)
			if err != nil || dep.Kind != sourceKind || uri.Kind != sourceKind {
				return fmt.Errorf("invalid authored report dependency identity")
			}
		default:
			return fmt.Errorf("unsupported authored report dependency")
		}
	}
	if builderCount != 1 || reportCount != 1 || len(ds) != len(e.DataSources) {
		return fmt.Errorf("incomplete authored report dependency closure")
	}
	return nil
}

func runLowerer(ctx context.Context, program *goja.Program, raw json.RawMessage) (goja.Value, error) {
	return runEntry(ctx, program, "lower", raw)
}
func runEntry(ctx context.Context, program *goja.Program, entry string, raw json.RawMessage) (goja.Value, error) {
	return runEntryWithTimeSource(ctx, program, entry, raw, nil)
}

func runEntryWithTimeSource(ctx context.Context, program *goja.Program, entry string, raw json.RawMessage, now goja.Now) (goja.Value, error) {
	// The bundled lowerer is trusted and its input/output sizes are bounded above.
	// Large report documents can exceed five seconds under a loaded host; retain
	// a finite limit while honoring an earlier caller deadline.
	return runEntryWithTimeSourceTimeout(ctx, program, entry, raw, now, 15*time.Second)
}

func runEntryWithTimeSourceTimeout(ctx context.Context, program *goja.Program, entry string, raw json.RawMessage, now goja.Now, timeout time.Duration) (goja.Value, error) {
	bootstrapTiming := observe.Start(ctx, "report.materializer.runtime.bootstrap", observe.Labels{Kind: "report"})
	runtime := goja.New()
	if now != nil {
		runtime.SetTimeSource(now)
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	bounded, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		select {
		case <-bounded.Done():
			runtime.Interrupt(bounded.Err())
		case <-stop:
		}
	}()
	if _, err := runtime.RunProgram(program); err != nil {
		bootstrapTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
		return nil, loweringError(bounded, err)
	}
	bootstrapTiming.End(observe.OK, observe.CacheUnknown)
	api := runtime.Get("ForgeAuthoredLowerer").ToObject(runtime)
	lower, ok := goja.AssertFunction(api.Get(entry))
	if !ok {
		return nil, fmt.Errorf("trusted lowerer entry missing")
	}
	invokeTiming := observe.Start(ctx, "report.materializer.runtime.invoke", observe.Labels{Kind: "report"})
	result, err := lower(goja.Undefined(), runtime.ToValue(string(raw)))
	invokeTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, loweringError(bounded, err)
	}
	if err := bounded.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

// Artifacts contains server-materialized data and print models from the trusted official bundle.
type Artifacts struct {
	ReportFill  json.RawMessage `json:"reportFill"`
	ReportPrint json.RawMessage `json:"reportPrint"`
}

func Materialize(ctx context.Context, spec json.RawMessage, datasets map[string]json.RawMessage) (*Artifacts, error) {
	return materialize(ctx, spec, datasets, false, nil)
}

// MaterializeFill computes the validated report fill without constructing a
// print model. Complete execution and export retain Materialize by default.
func MaterializeFill(ctx context.Context, spec json.RawMessage, datasets map[string]json.RawMessage) (*Artifacts, error) {
	return materialize(ctx, spec, datasets, true, nil)
}

func materialize(ctx context.Context, spec json.RawMessage, datasets map[string]json.RawMessage, fillOnly bool, presentations TablePresentations) (*Artifacts, error) {
	if ctx == nil {
		return nil, fmt.Errorf("materializer context required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	size := len(spec)
	for _, raw := range datasets {
		size += len(raw)
	}
	if size > 16<<20 {
		return nil, fmt.Errorf("report materialization input limit")
	}
	normalizeTiming := observe.Start(ctx, "report.materializer.normalize", observe.Labels{Kind: "report"})
	normalized, err := normalizeDatasetResults(spec, datasets)
	normalizeTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(struct {
		Spec               json.RawMessage            `json:"reportSpec"`
		Datasets           map[string]json.RawMessage `json:"datasets"`
		TablePresentations TablePresentations         `json:"tablePresentations,omitempty"`
	}{spec, normalized, presentations})
	if err != nil {
		return nil, err
	}
	if len(raw) > 16<<20 {
		return nil, fmt.Errorf("report materialization input limit")
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return nil, programError
	}
	runTiming := observe.Start(ctx, "report.materializer.run", observe.Labels{Kind: "report"})
	entry := "materialize"
	if fillOnly {
		entry = "materializeFill"
	}
	result, err := runTrustedEntry(ctx, program, entry, raw)
	runTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	if len(result) > 32<<20 {
		return nil, fmt.Errorf("report materialization output limit")
	}
	var output Artifacts
	if json.Unmarshal([]byte(result), &output) != nil || len(output.ReportFill) == 0 || !fillOnly && len(output.ReportPrint) == 0 || fillOnly && len(output.ReportPrint) != 0 {
		return nil, fmt.Errorf("report materialization invalid")
	}
	return &output, nil
}
