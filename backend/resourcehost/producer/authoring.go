// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"encoding/json"
	"strings"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

// These flat MCP envelopes add only the URI omitted by lifecycle method DTOs.
// Definition and concurrency fields retain their existing protocol meanings.
type UpdateResourceRequest struct {
	URI string `json:"uri"`
	primitive.UpdateDraftInput
}
type StampResourceRequest struct {
	URI string `json:"uri"`
	primitive.StampResourceInput
}
type ArchiveResourceRequest struct {
	URI string `json:"uri"`
	primitive.ArchiveResourceInput
}

func authoringOperation(operation string) bool {
	switch operation {
	case "create", "update", "archive", "clone", "stamp":
		return true
	}
	return false
}
func authoringSample(method string) any {
	operation := method[strings.LastIndex(method, "/")+1:]
	switch operation {
	case "create":
		return primitive.CreateResourceInput{}
	case "update":
		return UpdateResourceRequest{}
	case "archive":
		return ArchiveResourceRequest{}
	case "clone":
		return primitive.CloneResourceInput{}
	case "stamp":
		return StampResourceRequest{}
	}
	return nil
}
func (p *LocalProvider) canAuthor(kind, namespace, operation string) bool {
	return p.authoring != nil && authoringOperation(operation) && p.catalogOperations[namespace][kind][operation]
}
func (p *LocalProvider) hasAuthoring(kind, namespace string) bool {
	for operation := range p.catalogOperations[namespace][kind] {
		if p.canAuthor(kind, namespace, operation) {
			return true
		}
	}
	return false
}
func (p *LocalProvider) authoringTarget(kind, operation, value string) (identity.ResourceURI, error) {
	uri, err := identity.ParseResourceURI(value)
	if err != nil || uri.Kind != kind || !p.canAuthor(kind, uri.Namespace, operation) {
		return identity.ResourceURI{}, identity.ErrResource
	}
	return uri, nil
}
func (p *LocalProvider) callAuthoring(ctx context.Context, kind, operation string, raw json.RawMessage) (timingValue any, timingErr error) {
	if observe.Enabled(ctx) {
		span := p.timing(ctx, observe.ProviderWrite, kind, "")
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheUnknown) }()
	}
	if p.authoring == nil || !authoringOperation(operation) {
		return nil, identity.ErrResource
	}
	var uriText string
	var definition json.RawMessage
	var version int64
	var dispatch func() (*primitive.ResourceResult, error)
	switch operation {
	case "create":
		var in primitive.CreateResourceInput
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		uriText, definition, version = in.URI, in.Definition, in.FormatVersion
		dispatch = func() (*primitive.ResourceResult, error) { return p.authoring.CreateResource(ctx, in) }
	case "update":
		var in UpdateResourceRequest
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		uriText, definition, version = in.URI, in.Definition, in.FormatVersion
		dispatch = func() (*primitive.ResourceResult, error) {
			return p.authoring.UpdateDraft(ctx, in.URI, in.UpdateDraftInput)
		}
	case "archive":
		var in ArchiveResourceRequest
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		uriText = in.URI
		dispatch = func() (*primitive.ResourceResult, error) {
			return p.authoring.ArchiveResource(ctx, in.URI, in.ArchiveResourceInput)
		}
	case "clone":
		var in primitive.CloneResourceInput
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		uriText = in.TargetURI
		source, err := identity.ParseResourceURI(in.Source.URI)
		if err != nil || source.Kind != kind {
			return nil, identity.ErrResource
		}
		dispatch = func() (*primitive.ResourceResult, error) { return p.authoring.CloneResource(ctx, in) }
	case "stamp":
		var in StampResourceRequest
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		uriText = in.URI
		dispatch = func() (*primitive.ResourceResult, error) {
			return p.authoring.StampResource(ctx, in.URI, in.StampResourceInput)
		}
	}
	uri, err := p.authoringTarget(kind, operation, uriText)
	if err != nil {
		return nil, err
	}
	if operation == "create" || operation == "update" {
		if !p.catalogKinds[uri.Namespace][kind][version] || len(definition) == 0 {
			return nil, identity.ErrResource
		}
		validationSpan := p.timing(ctx, observe.Validation, kind, uri.Namespace)
		err := p.validators[kind](version, definition)
		validationSpan.End(observe.OutcomeFor(err), observe.CacheBypass)
		if err != nil {
			return nil, err
		}
	}
	actor, err := p.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	if err = p.authorize(ctx, actor, uri, "resource."+operation); err != nil {
		return nil, err
	}
	writeSpan := p.timing(ctx, observe.SourceWrite, kind, uri.Namespace)
	result, err := dispatch()
	writeSpan.End(observe.OutcomeFor(err), observe.CacheBypass)
	if err != nil {
		return nil, err
	}
	if result == nil || result.URI != uri.String() {
		return nil, identity.ErrResource
	}
	if err = p.finishActor(ctx, actor); err != nil {
		return nil, err
	}
	return result, nil
}

func (p *LocalProvider) mergeAuthoringMetadata(ctx context.Context, actor identity.VerifiedActor, result *primitive.GetResult) error {
	resource := result.Resource
	if !p.hasAuthoring(resource.Kind, resource.Namespace) {
		return nil
	}
	metadataSpan := p.timing(ctx, observe.SourceMetadata, resource.Kind, resource.Namespace)
	descriptor, err := p.authoring.GetResource(ctx, resource.URI)
	metadataSpan.End(observe.OutcomeFor(err), observe.CacheBypass)
	if err != nil {
		return err
	}
	if descriptor == nil || descriptor.URI != resource.URI || descriptor.ResourceKind != "" && descriptor.ResourceKind != resource.Kind || descriptor.Namespace != "" && descriptor.Namespace != resource.Namespace || descriptor.Name != "" && descriptor.Name != resource.Name || descriptor.OwnerID != "" && resource.OwnerID != "" && descriptor.OwnerID != resource.OwnerID || descriptor.ContentFingerprint != "" && descriptor.ContentFingerprint != resource.ContentFingerprint {
		return identity.ErrResource
	}
	resource.WorkspaceID = descriptor.WorkspaceID
	if descriptor.OwnerID != "" {
		resource.OwnerID = descriptor.OwnerID
	}
	if descriptor.Title != "" {
		resource.Title = descriptor.Title
	}
	if descriptor.Lifecycle != "" {
		resource.Lifecycle = descriptor.Lifecycle
	}
	resource.RowEtag, resource.DraftRevision, resource.LatestStamp = descriptor.RowEtag, descriptor.DraftRevision, descriptor.LatestStamp
	if err = p.finishActor(ctx, actor); err != nil {
		return err
	}
	if !identity.MetadataExpiryValid(result.ResolvedResource.ValidUntil, p.nowTime()) {
		return identity.ErrResourceDenied
	}
	return nil
}
