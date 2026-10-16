package reporting

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"reflect"
)

// ResourceReader preserves the original provider pin and lease across report
// retrieval, compilation, execution and export. Concrete ResourceResolver still
// implements this contract; alternate carriers must retain operation admission.
type ResourceReader interface {
	Resolve(context.Context, identity.ResourceRef) (*identity.ResolvedResource, error)
	ReadResolved(context.Context, identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error)
}

// ResourceDefinitionReader returns the managing provider's complete get result,
// keeping header metadata and definition on the same delivery path.
type ResourceDefinitionReader interface {
	ReadDefinition(context.Context, identity.ResourceRef, *identity.ResolvedResource) (*primitive.GetResult, error)
}

// ProviderResourceReader refreshes a durable bookmark only at its stored provider.
type ProviderResourceReader interface {
	ResourceReader
	ResolveForProvider(context.Context, identity.ResourceRef, string) (*identity.ResolvedResource, error)
}
type ResourceReaderFactory func(context.Context, string) (ResourceReader, error)

// SetResourceReaderFactory is a pre-serving host composition seam. It overrides
// only resource delivery; metadata scopes remain intact.
func (s *Service) SetResourceReaderFactory(factory ResourceReaderFactory) {
	if s != nil {
		s.resourceReaderFactory = factory
	}
}
func (s *Service) hasResourceReader() bool {
	return s != nil && (s.resourceReaderFactory != nil || s.resourceResolver != nil)
}
func (s *Service) resourceReaderFor(ctx context.Context, operation string) (ResourceReader, error) {
	if s == nil || ctx == nil || ctx.Err() != nil {
		return nil, identity.ErrResourceDenied
	}
	if s.resourceReaderFactory != nil {
		return checkedResourceReader(s.resourceReaderFactory(ctx, operation))
	}
	if s.resourceResolver == nil {
		return nil, identity.ErrResourceDenied
	}
	return checkedResourceReader(s.resourceResolver(ctx, operation))
}

func checkedResourceReader(reader ResourceReader, err error) (ResourceReader, error) {
	if err != nil {
		return nil, err
	}
	if reader == nil {
		return nil, identity.ErrResourceDenied
	}
	// A factory may accidentally return a typed nil pointer as an interface.
	value := reflect.ValueOf(reader)
	if value.Kind() == reflect.Pointer && value.IsNil() {
		return nil, identity.ErrResourceDenied
	}
	return reader, nil
}

// ResourceSelectionReader combines selection and delivery without discarding
// the definition returned by selection. Existing readers retain their contract.
type ResourceSelectionReader interface {
	ReadResource(context.Context, identity.ResourceRef, *identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error)
}

func selectResourceRead(ctx context.Context, reader ResourceReader, ref identity.ResourceRef, pin *identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	if reader == nil || pin != nil && (pin.URI != ref.URI || ref.Revision != "" && ref.Revision != pin.Selector()) {
		return nil, nil, identity.ErrResourceDenied
	}
	if combined, ok := reader.(ResourceSelectionReader); ok {
		return combined.ReadResource(ctx, ref, pin)
	}
	if pin == nil {
		var err error
		pin, err = reader.Resolve(ctx, ref)
		if err != nil {
			return nil, nil, err
		}
	}
	return reader.ReadResolved(ctx, *pin)
}

// FreshResourceReader explicitly ends reuse before an export state mutation.
type FreshResourceReader interface {
	ReadResolvedFresh(context.Context, identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error)
}

func readResourceFresh(ctx context.Context, reader ResourceReader, pin identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	if fresh, ok := reader.(FreshResourceReader); ok {
		return fresh.ReadResolvedFresh(ctx, pin)
	}
	return reader.ReadResolved(ctx, pin)
}
func (s *Service) beginReportOperation(ctx context.Context) (context.Context, func() error, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if s == nil || s.reportCatalog == nil || !s.hasResourceReader() {
		return ctx, func() error { return ctx.Err() }, nil
	}
	return s.reportCatalog.MetadataRead(ctx)
}
