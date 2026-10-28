package reporting

import (
	"context"
	"encoding/json"
	"errors"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/reporting/registry"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
)

// FetchResourceDatasource uses the same admitted definition and dataset executor
// as report execution. The caller supplies a logical owner and attached source ID;
// neither a datasource descriptor nor a revision is accepted from the caller.
func (s *Service) FetchResourceDatasource(ctx context.Context, owner identity.ResourceRef, id string, inputs map[string]interface{}) (out *dsproto.FetchResult, failure error) {
	if s == nil || s.resourceDatasetExecutor == nil || owner.Revision != "" || id == "" {
		return nil, identity.ErrResourceDenied
	}
	uri, err := identity.ParseResourceURI(owner.URI)
	if err != nil || uri.Kind != "report" {
		return nil, identity.ErrResourceDenied
	}
	if s.reportCatalog != nil {
		scoped, finish, err := s.reportCatalog.MetadataRead(ctx)
		if err != nil {
			return nil, err
		}
		if scoped == nil || finish == nil {
			return nil, identity.ErrResourceDenied
		}
		defer func() {
			if err := finish(); err != nil {
				out = nil
				failure = errors.Join(failure, err)
			}
		}()
		ctx = scoped
	}
	reader, err := s.resourceReaderFor(ctx, "report.execute")
	if err != nil {
		return nil, err
	}
	raw, pin, err := selectResourceRead(ctx, reader, owner, nil)
	if err != nil {
		return nil, err
	}
	if pin == nil || !identity.MetadataExpiryValid(pin.ValidUntil, s.now()) {
		return nil, identity.ErrResourceDenied
	}
	var published PublishedResourceVerifier
	if pin.Kind == identity.PublishedCandidate {
		var ok bool
		published, ok = reader.(PublishedResourceVerifier)
		if !ok {
			return nil, identity.ErrResourceDenied
		}
	}
	var envelope registry.ReportEnvelope
	if json.Unmarshal(raw, &envelope) != nil || !(envelope.SchemaVersion == 1 || published != nil && envelope.SchemaVersion == 2 && envelope.Format == registry.ResourceReportFormat) {
		return nil, identity.ErrResourceDenied
	}
	var descriptor dsproto.DataSource
	if decodeReportDatasource(envelope.DataSources[id], &descriptor) != nil || descriptor.ID != id {
		return nil, identity.ErrResourceDenied
	}
	// Only the selected source's dependencies participate in this operation.
	selected := envelope
	selected.DataSourceResources = nil
	if dependency, ok := envelope.DataSourceResources[id]; ok {
		selected.DataSourceResources = map[string]primitive.DataSourceReference{id: dependency}
	}
	dependencies, _, err := s.bindDependencies(ctx, pin, selected, nil, "")
	if err != nil {
		return nil, err
	}
	admitted := context.WithValue(ctx, admittedReportDefinitionKey{}, admittedReportDefinition{service: s, pin: *pin, definition: envelope})
	admitted = requestctx.WithResourceDependencies(requestctx.WithResolvedResource(admitted, *pin), *pin, dependencies)
	out, err = s.resourceDatasetExecutor(admitted, *pin, &descriptor, inputs)
	if err != nil {
		return nil, err
	}
	if !identity.MetadataExpiryValid(pin.ValidUntil, s.now()) {
		return nil, identity.ErrResourceDenied
	}
	if published != nil {
		if err := published.VerifyPublishedResource(ctx, *pin); err != nil {
			return nil, err
		}
		return out, nil
	}
	_, fresh, err := reader.ReadResolved(ctx, *pin)
	if err != nil {
		return nil, err
	}
	if fresh == nil || *fresh != *pin {
		return nil, identity.ErrResourceDenied
	}
	return out, nil
}
