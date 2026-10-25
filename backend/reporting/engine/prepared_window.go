package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	identity "github.com/viant/forge/backend/resource"
)

// PrepareWindowBuilderRuntime captures a producer-validated window and its
// selected dependencies at synchronization/draft push. Runtime builder state is
// intentionally absent: user selection and producer-returned definitions vary
// per invocation. Only trusted host code can create this opaque handle.
func PrepareWindowBuilderRuntime(ctx context.Context, pin identity.ResolvedResource, definition json.RawMessage, dependencies map[string]identity.ResolvedResource) (*PreparedReport, error) {
	if ctx == nil {
		return nil, fmt.Errorf("window preparation context required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	uri, err := identity.ParseResourceURI(pin.URI)
	if err != nil || uri.Kind != "window" || len(definition) == 0 || !json.Valid(definition) {
		return nil, fmt.Errorf("invalid prepared window source")
	}
	return &PreparedReport{window: true, raw: cloneJSON(definition), pin: pin, dependencies: cloneDependencyPins(dependencies)}, nil
}

func (s *Service) ExecutePreparedWindowBuilder(ctx context.Context, prepared *PreparedReport, request *ExecuteResourceRequest, derive WindowBuilderDeriver) (*ExecuteResourceResult, error) {
	if prepared == nil || !prepared.window || request == nil || derive == nil || ctx == nil {
		return nil, fmt.Errorf("prepared window builder unavailable")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	copy := *request
	copy.Resource = nil
	copy.ResolvedResource = cloneResolvedResource(&prepared.pin)
	copy.DependencyPins = cloneDependencyPins(prepared.dependencies)
	return s.executeResourceDefinition(context.WithValue(ctx, preparedReportKey{}, prepared), &copy, derive)
}
