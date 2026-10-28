package resource

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	"sync"
)

type freshMetadataSelectionKey struct{}
type freshMetadataSelectionState struct {
	mu          sync.Mutex
	namespaces  map[string]bool
	definitions map[string]bool
}

func withFreshMetadataSelection(ctx context.Context) context.Context {
	if freshMetadataSelection(ctx) {
		return ctx
	}
	return context.WithValue(ctx, freshMetadataSelectionKey{}, &freshMetadataSelectionState{namespaces: map[string]bool{}, definitions: map[string]bool{}})
}
func freshMetadataSelection(ctx context.Context) bool {
	state, _ := ctx.Value(freshMetadataSelectionKey{}).(*freshMetadataSelectionState)
	return state != nil
}
func refreshMetadataNamespace(ctx context.Context, name string) bool {
	state, _ := ctx.Value(freshMetadataSelectionKey{}).(*freshMetadataSelectionState)
	if state == nil {
		return false
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.namespaces[name] {
		return false
	}
	state.namespaces[name] = true
	return true
}

func refreshMetadataDefinition(ctx context.Context, key, entry string) bool {
	state, _ := ctx.Value(freshMetadataSelectionKey{}).(*freshMetadataSelectionState)
	if state == nil {
		return false
	}
	identity := key + "\x00" + entry
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.definitions[identity] {
		return false
	}
	state.definitions[identity] = true
	return true
}

// ReadDefinitionFresh opens a NEW metadata selection at the original owner.
// previous is a locator bookmark only: its deadline is never extended and it
// cannot authorize or change an already admitted execution.
func (r *gatewayReportReader) ReadDefinitionFresh(ctx context.Context, ref identity.ResourceRef, previous *identity.ResolvedResource) (*primitive.GetResult, error) {
	if previous == nil || previous.ProviderIdentity == "" || !previous.ResourceCandidate.Valid() || previous.URI != ref.URI || ref.Revision != previous.Selector() {
		return nil, identity.ErrResourceDenied
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		sequence.mu.Lock()
		held := sequence.closed || sequence.ending || sequence.dispatchDepth != 0 || sequence.phases > 1 || len(sequence.reportReads) > 0 || sequence.originalSelection != nil
		sequence.mu.Unlock()
		if held {
			return nil, identity.ErrResourceDenied
		}
	}
	ctx = withFreshMetadataSelection(ctx)
	result, err := readReport[json.RawMessage](ctx, r, ref, nil, previous.ProviderIdentity, true, true)
	if err != nil {
		return nil, err
	}
	var definition registry.ReportEnvelope
	if json.Unmarshal(result.Definition, &definition) != nil {
		return nil, identity.ErrResourceDenied
	}
	if len(definition.DataSourceResources) > 0 {
		gateway := r.catalog.Gateway
		connection, found, err := gateway.configuredOwnerConnection(ctx, previous.ProviderIdentity)
		if err != nil {
			return nil, err
		}
		if !found {
			uri, err := identity.ParseResourceURI(ref.URI)
			if err != nil {
				return nil, err
			}
			connection, err = gateway.ConnectionForResource(ctx, uri, previous.ProviderIdentity)
			if err != nil {
				return nil, err
			}
		}
		pins, _, err := gateway.resolveDependencyReads(ctx, connection, *result.ResolvedResource, definition.DataSourceResources, definition.DataSources, nil, false)
		if err != nil {
			return nil, err
		}
		// Bind the new metadata action to the freshly selected child deadlines.
		// Existing grants are detached and never inherit these replacements.
		current := *result.ResolvedResource
		for _, pin := range pins {
			current.ValidUntil = identity.MinimumMetadataExpiry(current.ValidUntil, pin.ValidUntil)
		}
		result.ResolvedResource = &current
	}
	return &result.GetResult, nil
}
