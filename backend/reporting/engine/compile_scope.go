package reporting

import (
	"context"
	"errors"
	identity "github.com/viant/forge/backend/resource"
)

// Compile is a metadata-only phase. Its explicit host scope ends before the
// original execution context proceeds to datasource admission or dispatch.
func (s *Service) Compile(ctx context.Context, request *CompileRequest) (out *CompileResult, resultErr error) {
	if s.reportCatalog != nil && s.hasResourceReader() {
		scoped, finish, err := s.reportCatalog.MetadataRead(ctx)
		if err != nil {
			if finish != nil {
				err = errors.Join(err, finish())
			}
			return nil, err
		}
		if finish == nil {
			return nil, identity.ErrResourceDenied
		}
		defer func() {
			if err := finish(); err != nil {
				out = nil
				resultErr = errors.Join(resultErr, err)
			}
		}()
		if scoped == nil {
			return nil, identity.ErrResourceDenied
		}
		ctx = scoped
	}
	return s.compileUnscoped(ctx, request)
}
