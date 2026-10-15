package resource

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

// Authoring routes lifecycle operations to one configured managing provider.
// It has no storage or resource policy; the provider owns writes and exposes
// the supported operations through ordinary namespace discovery.
type Authoring struct {
	gateway *Gateway
	owner   string
}

func NewAuthoring(gateway *Gateway, owner string) (*Authoring, error) {
	if gateway == nil || owner == "" {
		return nil, fmt.Errorf("resource authoring requires a gateway and provider")
	}
	return &Authoring{gateway: gateway, owner: owner}, nil
}

func (a *Authoring) connection(ctx context.Context) (Connection, error) {
	connection, found, err := a.gateway.configuredOwnerConnection(ctx, a.owner)
	if err != nil || found {
		return connection, err
	}
	return a.gateway.ConnectionForProvider(ctx, a.owner)
}

func invokeAuthoring[T any](ctx context.Context, a *Authoring, value, operation string, input any) (T, error) {
	var zero T
	if a == nil {
		return zero, ErrUnavailable
	}
	uri, err := identity.ParseResourceURI(value)
	if err != nil {
		return zero, err
	}
	connection, err := a.connection(ctx)
	if err != nil {
		return zero, err
	}
	return Invoke[T](ctx, a.gateway, connection, uri, operation, input)
}

// lifecycleArguments adds the URI to an owned encoding of the existing DTO.
// The caller's definition, concurrency fields and original object are untouched.
func lifecycleArguments(uri string, input any) (map[string]json.RawMessage, error) {
	raw, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	var args map[string]json.RawMessage
	if err = json.Unmarshal(raw, &args); err != nil || args == nil {
		return nil, identity.ErrResource
	}
	args["uri"], err = json.Marshal(uri)
	return args, err
}

func (a *Authoring) CreateResource(ctx context.Context, input primitive.CreateResourceInput) (*primitive.ResourceResult, error) {
	return invokeAuthoring[*primitive.ResourceResult](ctx, a, input.URI, "create", input)
}

func (a *Authoring) UpdateDraft(ctx context.Context, uri string, input primitive.UpdateDraftInput) (*primitive.ResourceResult, error) {
	args, err := lifecycleArguments(uri, input)
	if err != nil {
		return nil, err
	}
	return invokeAuthoring[*primitive.ResourceResult](ctx, a, uri, "update", args)
}

func (a *Authoring) StampResource(ctx context.Context, uri string, input primitive.StampResourceInput) (*primitive.ResourceResult, error) {
	args, err := lifecycleArguments(uri, input)
	if err != nil {
		return nil, err
	}
	return invokeAuthoring[*primitive.ResourceResult](ctx, a, uri, "stamp", args)
}

func (a *Authoring) CloneResource(ctx context.Context, input primitive.CloneResourceInput) (*primitive.ResourceResult, error) {
	return invokeAuthoring[*primitive.ResourceResult](ctx, a, input.TargetURI, "clone", input)
}

func (a *Authoring) ArchiveResource(ctx context.Context, uri string, input primitive.ArchiveResourceInput) (*primitive.ResourceResult, error) {
	args, err := lifecycleArguments(uri, input)
	if err != nil {
		return nil, err
	}
	return invokeAuthoring[*primitive.ResourceResult](ctx, a, uri, "archive", args)
}

func (a *Authoring) GetResource(ctx context.Context, uri string) (*primitive.ResourceDescriptor, error) {
	if a == nil {
		return nil, ErrUnavailable
	}
	connection, err := a.connection(ctx)
	if err != nil {
		return nil, err
	}
	got, err := Get[json.RawMessage](ctx, a.gateway, connection, identity.ResourceRef{URI: uri}, nil)
	if err != nil {
		return nil, err
	}
	if got == nil || got.Resource == nil {
		return nil, identity.ErrResource
	}
	state := got.Resource
	return &primitive.ResourceDescriptor{
		ResourceResult: primitive.ResourceResult{URI: state.URI, RowEtag: state.RowEtag, DraftRevision: state.DraftRevision, LatestStamp: state.LatestStamp, Stamp: state.Stamp, ContentFingerprint: state.ContentFingerprint, Replay: state.Replay},
		WorkspaceID:    state.WorkspaceID, ResourceKind: state.Kind, Namespace: state.Namespace,
		Name: state.Name, OwnerID: state.OwnerID, Title: state.Title, Lifecycle: state.Lifecycle,
	}, nil
}

var _ primitive.ResourceAuthoring = (*Authoring)(nil)
