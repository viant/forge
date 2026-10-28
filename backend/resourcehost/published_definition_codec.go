package resource

import (
	"bytes"
	"context"
	"encoding/json"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type publishedCodecValue[T any] struct {
	definition T
	raw        json.RawMessage
}

// DefinitionCodec already promises an immutable parsed representation. Keep
// that contract on the shared loader; mutable RawMessage results are detached.
func getPublishedWithCodec[T any](ctx context.Context, g *Gateway, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource, codec DefinitionCodec[T]) (*Result[T], error) {
	if ref.Revision != "" || pin != nil && freshMetadataSelection(ctx) {
		return nil, identity.ErrResourceDenied
	}
	loaded, err := Load[*publishedCodecValue[T]](ctx, g, ref.URI, PublishedCodec[*publishedCodecValue[T]]{ID: "definition:" + codec.ID, Immutable: true, Decode: func(_ context.Context, _ string, raw json.RawMessage) (*publishedCodecValue[T], error) {
		value, err := codec.Parse(bytes.Clone(raw))
		if err != nil {
			return nil, err
		}
		return &publishedCodecValue[T]{definition: value, raw: raw}, nil
	}})
	if err != nil {
		return nil, err
	}
	selected := *loaded.Resource
	if pin != nil {
		if pin.URI != selected.URI || pin.ProviderIdentity != selected.ProviderIdentity || pin.ResourceCandidate != selected.ResourceCandidate || pin.AuthorityBinding != selected.AuthorityBinding {
			return nil, identity.ErrResourceDenied
		}
		selected = *pin
	}
	definition := loaded.Value.definition
	if raw, ok := any(definition).(json.RawMessage); ok {
		definition = any(json.RawMessage(bytes.Clone(raw))).(T)
	}
	state := loaded.Metadata
	if state == nil {
		return nil, identity.ErrResourceDenied
	}
	state.Definition = bytes.Clone(loaded.Value.raw)
	state.DefinitionBytes = state.Definition
	if err = g.verifyPublishedPin(ctx, connection, selected); err != nil {
		return nil, err
	}
	return &Result[T]{GetResult: primitive.GetResult{Resource: state, ResolvedResource: &selected}, Definition: definition}, nil
}

// VerifyPublishedMetadata fences an exact previously selected root without
// loading its body, renewing its deadline, or consulting a remote transport.
func (g *Gateway) VerifyPublishedMetadata(ctx context.Context, pin identity.ResolvedResource) error {
	if g == nil || ctx == nil {
		return identity.ErrResourceDenied
	}
	uri, err := identity.ParseResourceURI(pin.URI)
	if err != nil {
		return err
	}
	source, claimed := g.publishedNamespace(uri.Namespace)
	if !claimed || source.connection.ProviderIdentity != pin.ProviderIdentity {
		return identity.ErrResourceDenied
	}
	connection := source.connection
	connection.Generation = g.generation(connection.Name)
	return g.verifyPublishedPin(ctx, connection, pin)
}
