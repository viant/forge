package datasource

import (
	"context"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
)

type operationExecution struct {
	name   string
	result interface{}
}

// Operate runs only a declared action through ordinary datasource admission.
// It never reads, populates, invalidates, or refreshes the datasource row cache.
func (s *Service) Operate(ctx context.Context, id, operation string, inputs map[string]interface{}, opts FetchOptions) (*dsproto.OperateResult, error) {
	if strings.TrimSpace(operation) == "" || strings.TrimSpace(operation) != operation {
		return nil, identity.ErrResourceDenied
	}
	action := &operationExecution{name: operation}
	if _, err := s.executeDatasource(ctx, id, inputs, opts, action); err != nil {
		return nil, err
	}
	return &dsproto.OperateResult{Result: action.result}, nil
}

func (s *Service) operateDeclared(ctx context.Context, ds *dsproto.DataSource, name string, inputs map[string]interface{}) (interface{}, error) {
	if ds == nil || strings.TrimSpace(name) == "" || strings.TrimSpace(name) != name {
		return nil, identity.ErrResourceDenied
	}
	operation, declared := ds.Operations[name]
	if !declared || operation == nil || operation.Backend == nil {
		return nil, identity.ErrResourceDenied
	}
	backend := *operation.Backend
	// Actions use a fixed backend and never inherit read-only denial fallbacks.
	if len(backend.MethodVariants) != 0 || backend.EmptyOnForbidden {
		return nil, identity.ErrResourceDenied
	}
	switch backend.Kind {
	case dsproto.BackendMCPTool:
		if backend.Service == "" || backend.Method == "" {
			return nil, identity.ErrResourceDenied
		}
	default:
		return nil, identity.ErrResourceDenied
	}
	if err := backend.ValidateArgumentProjection(); err != nil {
		return nil, err
	}
	selected := *ds
	selected.Backend = &backend
	// Read selectors, paging and filters cannot change an action payload.
	selected.DataSource = types.DataSource{}
	selected.ResponseAliases = nil
	if err := s.validateComponentSource(ctx, &selected); err != nil {
		return nil, err
	}
	if s.authorize != nil {
		if err := s.authorize(ctx, ds.ID, inputs); err != nil {
			return nil, err
		}
	}
	args := expandNestedArgs(mergeArgs(inputs, backend.Pinned))
	value, err := s.runBackend(ctx, &selected, args)
	if err != nil {
		return nil, err
	}
	if err := s.validateComponentSource(ctx, &selected); err != nil {
		return nil, err
	}
	return value, nil
}
