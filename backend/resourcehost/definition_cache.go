// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	cfg "github.com/viant/mcp/client/config"
)

type definitionCacheReference struct{ key, entry string }

func (g *Gateway) cachedDefinitionGet(ctx context.Context, actor identity.VerifiedActor, binding *resourceReadBinding, caps capabilities, uri identity.ResourceURI, ref identity.ResourceRef, load func(context.Context) (primitive.GetResult, error)) (primitive.GetResult, *definitionCacheReference, error) {
	scope, err := binding.options.ResourceCacheScope(uri.Namespace, uri.Kind)
	if err != nil {
		return primitive.GetResult{}, nil, err
	}
	if binding.options.IsBrowserExecution() {
		scope = cfg.ResourceCacheConversation
	}
	public := scope == cfg.ResourceCachePublic
	// Mutable/default definitions require an explicit host cache declaration.
	// Otherwise preserve the managing server's existing fresh-read behavior.
	declared := binding.options.ResourceCacheScopes[uri.Namespace+"/"+uri.Kind] != "" || binding.options.ResourceCacheScopes[uri.Namespace] != "" || binding.options.ResourceCacheScopes["*"] != ""
	if !declared && (ref.Revision == "" || ref.Revision == identity.WorkingCandidate) {
		result, err := load(ctx)
		return result, nil, err
	}
	// Scope, source expiry, credential generations and resource notifications
	// govern reuse for explicitly cached working/default definitions.
	partition := g.Manager.CatalogPartition(ctx, catalogPrincipalScope(actor), uri.Kind)
	var scopeKey string
	if public {
		partition = g.Manager.PublicCatalogPartition(uri.Kind)
		raw, marshalErr := json.Marshal(binding.options)
		if marshalErr != nil {
			return primitive.GetResult{}, nil, marshalErr
		}
		versions := g.Manager.ResourceCatalogGeneration(ctx, binding.name)
		scopeKey = fmt.Sprintf("public:%x:%d:%d", sha256.Sum256(raw), g.generation(binding.name), versions[0])
	} else {
		var cacheable bool
		scopeKey, cacheable, err = g.Manager.CatalogScopeForResources(definitionCacheScopeContext(ctx, binding.options, scope), "", []string{binding.name}, []string{binding.name})
		if err != nil {
			return primitive.GetResult{}, nil, err
		}
		if !cacheable {
			result, err := load(ctx)
			return result, nil, err
		}
		// Private definitions are isolated by current account and identity
		// revision as well as transport credentials. A role/account change must
		// never reuse metadata captured under an earlier authority context.
		actorScope := sha256.Sum256([]byte(actorKey(actor, "", 0)))
		scopeKey = fmt.Sprintf("%x:%s", actorScope, scopeKey)
	}
	partition = g.Manager.WithCatalogSources(ctx, partition, []string{binding.name})
	// A namespace slot holds sorted URI/selector entries, not one cache slot per
	// resource. Private keys retain the existing credential/conversation scope.
	key := fmt.Sprintf("primitive-definitions:%p:%s:%d:%s:%s:%s", g, binding.name, g.generation(binding.name), uri.Namespace, uri.Kind, scopeKey)
	entry := ref.URI + "\x00" + ref.Revision
	value, err := g.Manager.VisibleCatalogEntryInPartition(ctx, key, partition, entry, func(ctx context.Context) (json.RawMessage, time.Time, error) {
		result, err := load(ctx)
		if err != nil {
			return nil, time.Time{}, err
		}
		if result.Resource == nil || result.ResolvedResource == nil {
			return nil, time.Time{}, identity.ErrResourceDenied
		}
		pin := result.ResolvedResource
		if pin.ProviderIdentity != caps.connection.ProviderIdentity || pin.URI != ref.URI || result.Resource.URI != ref.URI || !pin.ResourceCandidate.Valid() || !identity.MetadataExpiryValid(pin.ValidUntil, g.now()) || (!caps.sharedIndex && pin.AuthorityBinding == "") {
			return nil, time.Time{}, identity.ErrResourceDenied
		}
		if result.MenuProjection == nil {
			exact := result.Resource.DefinitionBytes
			if len(exact) == 0 {
				exact = result.Resource.Definition
			}
			if identity.ContentFingerprint(exact) != pin.ContentFingerprint {
				return nil, time.Time{}, identity.ErrResourceDenied
			}
			if len(result.Resource.DefinitionBytes) > 0 && len(result.Resource.Definition) > 0 && !bytes.Equal(result.Resource.DefinitionBytes, result.Resource.Definition) {
				left, leftErr := semanticJSON(result.Resource.DefinitionBytes)
				right, rightErr := semanticJSON(result.Resource.Definition)
				if leftErr != nil || rightErr != nil || !reflect.DeepEqual(left, right) {
					return nil, time.Time{}, identity.ErrResourceDenied
				}
			}
		}
		if public && (result.ExecutionProof != nil || result.MenuProjection != nil) {
			return nil, time.Time{}, fmt.Errorf("contextual resource metadata requires user cache scope")
		}
		if err = g.checkReadBinding(ctx, actor, binding); err != nil {
			return nil, time.Time{}, err
		}
		if err = g.final(ctx, actor); err != nil {
			return nil, time.Time{}, err
		}
		// Keep the exact bytes once. Marshaling the redundant RawMessage would
		// compact its whitespace, forcing every warm read to parse both copies
		// again to prove equivalence. The shared Get path restores Definition
		// from these already validated bytes before releasing the result.
		if len(result.Resource.DefinitionBytes) > 0 {
			resource := *result.Resource
			resource.Definition = nil
			result.Resource = &resource
		}
		raw, err := json.Marshal(result)
		return raw, pin.ValidUntil, err
	}, func(raw json.RawMessage) []string {
		if ref.Revision != "" {
			return nil
		}
		var result primitive.GetResult
		if json.Unmarshal(raw, &result) != nil || result.ResolvedResource == nil {
			return nil
		}
		return []string{ref.URI + "\x00" + result.ResolvedResource.Selector()}
	})
	if err != nil {
		return primitive.GetResult{}, nil, err
	}
	var result primitive.GetResult
	if err = json.Unmarshal(value, &result); err != nil {
		return primitive.GetResult{}, nil, err
	}
	return result, &definitionCacheReference{key: key, entry: entry}, nil
}

// Logical conversation changes do not reconnect an ordinary user MCP. Browser
// and explicitly session-dependent providers retain that isolation in keys.
func definitionCacheScopeContext(ctx context.Context, options *cfg.MCPClient, scope string) context.Context {
	if options.IsBrowserExecution() || scope == cfg.ResourceCacheConversation {
		return ctx
	}
	return context.WithValue(ctx, requestctx.ConversationIDKey, "")
}
