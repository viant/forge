package reporting

import (
	"context"
	dssvc "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
)

// Prepared definitions retain the exact original published selection. Neither
// reports nor derived window builders may outlive its local session/root grant.
func (s *Service) preparedPublishedVerifier(ctx context.Context, pin identity.ResolvedResource) (PublishedResourceVerifier, error) {
	if pin.Kind != identity.PublishedCandidate {
		return nil, nil
	}
	reader, err := s.resourceReaderFor(ctx, "report.execute")
	if err != nil {
		return nil, err
	}
	verifier, ok := reader.(PublishedResourceVerifier)
	if !ok {
		return nil, identity.ErrResourceDenied
	}
	if err = verifier.VerifyPublishedResource(ctx, pin); err != nil {
		return nil, err
	}
	return verifier, nil
}

// A derived report keeps its original window identity. Its invocation-private
// admitted envelope already owns the exact embedded descriptor; the ordinary
// datasource service still performs definition admission and tool dispatch.
func publishedWindowReportResolver(ctx context.Context, pin identity.ResolvedResource, descriptor *dsproto.DataSource) dssvc.ResourceDefinitionResolver {
	if pin.Kind != identity.PublishedCandidate || !strings.HasPrefix(pin.URI, "window://") || descriptor == nil {
		return nil
	}
	admitted, ok := ctx.Value(admittedReportDefinitionKey{}).(admittedReportDefinition)
	if !ok || admitted.service == nil || admitted.pin != pin {
		return nil
	}
	return func(current context.Context, parent identity.ResolvedResource, _ *types.WindowTarget, id string) (*dsproto.DataSource, error) {
		selected, ok := current.Value(admittedReportDefinitionKey{}).(admittedReportDefinition)
		if !ok || selected.service != admitted.service || selected.pin != pin || parent != pin || id != descriptor.ID || current.Err() != nil {
			return nil, identity.ErrResourceDenied
		}
		return descriptor, nil
	}
}
