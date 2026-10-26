package reporting

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

// PreparedReport is an immutable server-owned definition and its dependency
// selection. Prepare it when accepting a publication or pushed draft; replace
// it when that input signature changes. It contains no evaluated data or dates.
// Its fields are private so wire requests cannot manufacture prepared state.
type PreparedReport struct {
	window       bool
	raw          json.RawMessage
	pin          identity.ResolvedResource
	dependencies map[string]identity.ResolvedResource
	token        string
}
type preparedReportKey struct{}

// PrepareReport runs the normal definition/dependency validation once, before
// accepting the artifact into the host's synchronized runtime cache.
func (s *Service) PrepareReport(ctx context.Context, request *CompileRequest) (*PreparedReport, error) {
	compiled, err := s.Compile(ctx, request)
	if err != nil {
		return nil, err
	}
	if compiled == nil || compiled.Resource == nil {
		return nil, fmt.Errorf("report preparation requires a selected definition")
	}
	reader, err := s.resourceReaderFor(ctx, "report.compile")
	if err != nil {
		return nil, err
	}
	raw, pin, err := reader.ReadResolved(ctx, *compiled.Resource)
	if err != nil {
		return nil, err
	}
	if pin == nil {
		return nil, fmt.Errorf("report preparation requires a selected definition")
	}
	return &PreparedReport{raw: cloneJSON(raw), pin: *pin, dependencies: cloneDependencyPins(compiled.DependencyPins), token: compiled.DependencyToken}, nil
}

// ExecutePreparedReport reuses accepted metadata. All request-specific maps and
// the effective specification are fresh per invocation. The producer authorizes
// actual data access; this path performs no catalog or dependency revalidation.
func (s *Service) ExecutePreparedReport(ctx context.Context, prepared *PreparedReport, request *ExecuteResourceRequest) (*ExecuteResourceResult, error) {
	if prepared == nil || request == nil {
		return nil, fmt.Errorf("prepared report unavailable")
	}
	if ctx == nil {
		return nil, fmt.Errorf("report context required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	copy := *request
	copy.Resource = nil
	copy.ResolvedResource = cloneResolvedResource(&prepared.pin)
	copy.DependencyPins = cloneDependencyPins(prepared.dependencies)
	copy.DependencyToken = prepared.token
	return s.executeResourceDefinition(context.WithValue(ctx, preparedReportKey{}, prepared), &copy, nil)
}

func preparedReportFromContext(ctx context.Context) *PreparedReport {
	prepared, _ := ctx.Value(preparedReportKey{}).(*PreparedReport)
	return prepared
}

func (s *Service) compilePreparedReport(ctx context.Context, prepared *PreparedReport, parameters map[string]interface{}) (*CompileResult, error) {
	var definition registry.ReportEnvelope
	// Decoding allocates invocation-owned maps; validity was established on prepare.
	if err := json.Unmarshal(prepared.raw, &definition); err != nil {
		return nil, err
	}
	raw := cloneJSON(prepared.raw)
	if definition.Format == registry.ResourceReportFormat {
		definition.SchemaVersion, definition.Format, definition.SourceFormat = 1, definition.SourceFormat, ""
		definition.DataSourceResources = nil
		var err error
		raw, err = json.Marshal(definition)
		if err != nil {
			return nil, err
		}
	}
	spec := cloneJSON(definition.ReportSpec)
	if definition.Format == registry.AuthoredReportFormat {
		base, err := bindAuthoredCompileParameters(raw, parameters)
		if err != nil {
			return nil, compileStageError(CompileStageBind, err)
		}
		if prepared.window {
			spec, err = materializer.LowerWindowBuilderWithRequestBase(ctx, raw, base)
		} else {
			spec, err = materializer.LowerWithRequestBase(ctx, raw, base)
		}
		if err != nil {
			return nil, compileStageError(CompileStageLower, err)
		}
	}
	// Relative dates are evaluated for this call, never frozen in PreparedReport.
	expanded, err := expandReportSpecTimeSemantics(spec, s.now())
	if err != nil {
		return nil, err
	}
	return &CompileResult{Resource: cloneResolvedResource(&prepared.pin), DependencyPins: cloneDependencyPins(prepared.dependencies), DependencyToken: prepared.token, ArtifactRef: prepared.pin.URI, ReportSpec: expanded, CompiledAt: s.now().UTC()}, nil
}
