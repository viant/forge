package resource

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

// Result delivers a typed definition alongside the unchanged original provider
// identity, pin and execution provenance. T has no effect on routing or admission.
type Result[T any] struct {
	primitive.GetResult
	Definition      T `json:"-"`
	definitionCache *definitionCacheReference
}

// Located is provider metadata with an optional typed inline definition. Lists
// that carry metadata only leave Definition at its zero value.
type Located[T any] struct {
	LocatedResource
	Definition T `json:"-"`
}

// List federates the same Gateway and per-actor capability cache for every
// primitive kind. Optional provider pagination remains an ordinary wire detail.
func List[T any](ctx context.Context, g *Gateway, kind, namespace string) ([]Located[T], error) {
	return list[T](ctx, g, kind, namespace, "")
}

// Get reads one exact provider locator through the shared validation pipeline.
// Menus use their separately verified visibility projection as the definition.
type DefinitionDecoder[T any] func(json.RawMessage) (T, error)

func Get[T any](ctx context.Context, g *Gateway, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource, decoder ...DefinitionDecoder[T]) (*Result[T], error) {
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil {
		poisonReadSequence(ctx, identity.ErrResource)
		return nil, identity.ErrResource
	}
	if uri.Kind == "navigation" {
		return get[T](ctx, g, connection, ref, pin, true, true, decoder...)
	}
	return get[T](ctx, g, connection, ref, pin, false, false, decoder...)
}

func decodeDefinition[T any](raw json.RawMessage) (T, error) {
	var result T
	if len(raw) == 0 {
		return result, nil
	}
	// Raw consumers keep exact bytes without an extra JSON parse or copy.
	if target, ok := any(&result).(*json.RawMessage); ok {
		*target = raw
		return result, nil
	}
	err := json.Unmarshal(raw, &result)
	return result, err
}

func untypedLocations[T any](rows []Located[T]) []LocatedResource {
	if rows == nil {
		return nil
	}
	out := make([]LocatedResource, len(rows))
	for i := range rows {
		out[i] = rows[i].LocatedResource
	}
	return out
}

// DefinitionCodec parses a target-independent immutable representation. Its
// identifier names the trusted schema; callers never supply it on the wire.
type DefinitionCodec[T any] struct {
	ID    string
	Parse DefinitionDecoder[T]
}

func GetWithCodec[T any](ctx context.Context, g *Gateway, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource, codec DefinitionCodec[T]) (*Result[T], error) {
	if codec.ID == "" || codec.Parse == nil {
		return nil, identity.ErrResource
	}
	raw, err := Get[json.RawMessage](ctx, g, connection, ref, pin)
	if err != nil {
		return nil, err
	}
	decodeTiming := observe.Start(ctx, observe.GatewayDefinitionDecode, observe.Labels{})
	parsed := false
	parse := func(data json.RawMessage) (T, error) { parsed = true; return codec.Parse(data) }
	var definition T
	// Navigation projections are computed for the current reader. They are not
	// the immutable definition stored in the representation cache.
	if raw.definitionCache == nil || raw.MenuProjection != nil {
		definition, err = parse(raw.Definition)
	} else {
		reference := raw.definitionCache
		value, parseErr := g.Manager.VisibleCatalogRepresentation(ctx, reference.key, reference.entry, codec.ID, func(stored json.RawMessage) (any, error) {
			var result primitive.GetResult
			if err := json.Unmarshal(stored, &result); err != nil {
				return nil, err
			}
			definition := result.Resource.DefinitionBytes
			if len(definition) == 0 {
				definition = result.Resource.Definition
			}
			return parse(definition)
		})
		err = parseErr
		if err == nil {
			var ok bool
			definition, ok = value.(T)
			if !ok {
				return nil, identity.ErrResource
			}
		}
	}
	cacheStatus := observe.CacheHit
	if parsed {
		cacheStatus = observe.CacheMiss
	}
	decodeTiming.End(observe.OutcomeFor(err), cacheStatus)
	if err != nil {
		return nil, err
	}
	if raw.ResolvedResource == nil || !identity.MetadataExpiryValid(raw.ResolvedResource.ValidUntil, g.now()) {
		return nil, identity.ErrResourceDenied
	}
	if g.generation(connection.Name) != connection.Generation {
		return nil, identity.ErrResourceStale
	}
	return &Result[T]{GetResult: raw.GetResult, Definition: definition, definitionCache: raw.definitionCache}, nil
}
