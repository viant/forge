package reporting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

// ResourceResolver supplies the trusted source and policy for a reporting
// operation. The source must serve Forge working/stamped report definitions.
type ResourceResolver func(context.Context, string) (*identity.ResourceResolver, error)

// admittedCompileDefinition is a private, invocation-local delivery from
// ExecuteResource's selected read. It never crosses a request or enters the
// public CompileRequest.
type admittedCompileDefinition struct {
	raw json.RawMessage
	pin identity.ResolvedResource
}

// compileResolved consumes the shared Forge report envelope, not a second
// client-supplied definition. It preserves the selected identity through compile.
func (s *Service) compileResolved(ctx context.Context, request *CompileRequest, admitted *admittedCompileDefinition) (*CompileRequest, *identity.ResolvedResource, ResourceReader, error) {
	if !s.hasResourceReader() {
		return nil, nil, nil, identity.ErrResourceDenied
	}
	var ref identity.ResourceRef
	if request.Resource != nil {
		ref = *request.Resource
	} else if request.ResolvedResource != nil {
		ref.URI = request.ResolvedResource.URI
		ref.Revision = request.ResolvedResource.Selector()
	} else {
		ref.URI = request.ArtifactRef
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "report" {
		return nil, nil, nil, identity.ErrResourceDenied
	}
	resolver, err := s.resourceReaderFor(ctx, "report.compile")
	if err != nil {
		return nil, nil, nil, err
	}
	if resolver == nil {
		return nil, nil, nil, identity.ErrResourceDenied
	}
	var pin *identity.ResolvedResource
	if request.ResolvedResource != nil {
		pin = cloneResolvedResource(request.ResolvedResource)
	}
	readTiming := observe.Start(ctx, "report.compile.read", observe.Labels{Kind: "report"})
	var raw json.RawMessage
	if admitted != nil {
		if pin == nil || !identity.SameResolvedResource(*pin, admitted.pin) ||
			!identity.MetadataExpiryValid(pin.ValidUntil, s.now()) || ctx.Err() != nil ||
			identity.ContentFingerprint(admitted.raw) != pin.ContentFingerprint {
			err = identity.ErrResourceDenied
		} else {
			raw = append(json.RawMessage(nil), admitted.raw...)
		}
	} else {
		raw, pin, err = selectResourceRead(ctx, resolver, ref, pin)
	}
	readTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, nil, nil, err
	}
	var definition registry.ReportEnvelope
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&definition); err != nil {
		return nil, nil, nil, compileStageError(CompileStageEnvelope, fmt.Errorf("invalid resolved report envelope"))
	}
	if decoder.Decode(new(any)) != io.EOF || (len(definition.ReportDocument) == 0 && len(definition.ReportSpec) == 0) || !(definition.SchemaVersion == 1 && definition.Format != registry.ResourceReportFormat && len(definition.DataSourceResources) == 0 && definition.SourceFormat == "" || definition.SchemaVersion == 2 && definition.Format == registry.ResourceReportFormat && len(definition.DataSourceResources) > 0) {
		return nil, nil, nil, compileStageError(CompileStageEnvelope, fmt.Errorf("invalid resolved report definition"))
	}
	bindTiming := observe.Start(ctx, "report.compile.bind", observe.Labels{Kind: "report"})
	dependencyPins, dependencyToken, err := s.bindOperationDependencies(ctx, request.ResolvedResource, pin, definition, request.DependencyPins, request.DependencyToken)
	bindTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, nil, nil, err
	}
	if definition.Format == registry.ResourceReportFormat {
		if definition.SourceFormat != "" && definition.SourceFormat != registry.AuthoredReportFormat {
			return nil, nil, nil, identity.ErrResourceDenied
		}
		definition.SchemaVersion, definition.Format, definition.SourceFormat = 1, definition.SourceFormat, ""
		definition.DataSourceResources = nil
		raw, err = json.Marshal(definition)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	var spec json.RawMessage
	switch definition.Format {
	case "":
		if len(definition.ReportSpec) == 0 || len(definition.BuilderDefinition) != 0 || len(definition.Dependencies) != 0 {
			return nil, nil, nil, compileStageError(CompileStageEnvelope, fmt.Errorf("invalid native report definition"))
		}
		spec = definition.ReportSpec
	case registry.AuthoredReportFormat:
		for _, dependency := range definition.Dependencies {
			if dependency.Kind == "report" && dependency.ID != pin.URI {
				return nil, nil, nil, identity.ErrResourceDenied
			}
		}
		requestBase, bindErr := bindAuthoredCompileParameters(raw, request.Parameters)
		if bindErr != nil {
			return nil, nil, nil, compileStageError(CompileStageBind, bindErr)
		}
		lowerTiming := observe.Start(ctx, "report.compile.lower", observe.Labels{Kind: "report"})
		spec, err = materializer.LowerWithRequestBase(ctx, raw, requestBase)
		lowerTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
		if err != nil {
			return nil, nil, nil, compileStageError(CompileStageLower, err)
		}
	default:
		return nil, nil, nil, compileStageError(CompileStageEnvelope, fmt.Errorf("unsupported resolved report format"))
	}
	boundRef := identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}
	return &CompileRequest{DependencyPins: dependencyPins, DependencyToken: dependencyToken, ResolvedResource: cloneResolvedResource(pin), Resource: &boundRef, ArtifactRef: pin.URI, SourceKind: SourceKindReportSpec, Document: append(json.RawMessage(nil), spec...)}, pin, resolver, nil
}

func (s *Service) SetResourceResolver(resolve ResourceResolver) {
	if s != nil {
		s.resourceResolver = resolve
	}
}

func cloneResourceRef(value *identity.ResourceRef) *identity.ResourceRef {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
func cloneResolvedResource(value *identity.ResolvedResource) *identity.ResolvedResource {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

// UsesResourceResolution identifies explicitly configured unified report mode.
func (s *Service) UsesResourceResolution() bool { return s != nil && s.hasResourceReader() }
