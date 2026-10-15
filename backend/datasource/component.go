// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"fmt"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"strings"
	"time"
)

func (s *Service) validateComponentSource(ctx context.Context, ds *dsproto.DataSource) error {
	if ds == nil || ds.Backend == nil {
		return nil
	}
	backend := ds.Backend
	providerOwned := backend.Kind == dsproto.BackendDatly && backend.Ownership == "provider"
	if (backend.Kind == dsproto.BackendDatly || backend.Ownership == "provider") && !providerOwned {
		return identity.ErrResourceDenied
	}
	if providerOwned && (s.providerExecute == nil || backend.Service != "" || backend.Method == "" || backend.Component == nil) {
		return identity.ErrResourceDenied
	}
	if providerOwned {
		pin, ok := requestctx.ResolvedResourceFromContext(ctx)
		target, targetOK := requestctx.WindowTargetFromContext(ctx)
		if !ok {
			return identity.ErrResourceDenied
		}
		if strings.HasPrefix(pin.URI, "datasource://") {
			proof, ok := requestctx.ResourceExecutionProofFromContext(ctx)
			if !ok || proof.Resource.ProviderIdentity != pin.ProviderIdentity || proof.Resource.URI != pin.URI || proof.Resource.ResourceCandidate != pin.ResourceCandidate || proof.Resource.AuthorityBinding != pin.AuthorityBinding || pin.ValidUntil.After(proof.Resource.ValidUntil) || proof.Binding == "" || proof.Token == "" || !proof.Resource.ValidUntil.After(time.Now()) || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
				return identity.ErrResourceDenied
			}
		} else if strings.HasPrefix(pin.URI, "window://") {
			if !targetOK || target.SelectionToken == "" {
				return identity.ErrResourceDenied
			}
			child, hasChild := target.DependencyPins[ds.ID]
			if hasChild {
				uri, err := identity.ParseResourceURI(child.URI)
				if err != nil || uri.Kind != "datasource" || !identity.MetadataExpiryValid(child.ValidUntil, time.Now()) {
					return identity.ErrResourceDenied
				}
			} else if target.ExecutionProof == nil {
				return identity.ErrResourceDenied
			}
		} else if strings.HasPrefix(pin.URI, "report://") {
			child, ok := requestctx.ResourceDependencyFromContext(ctx, ds.ID)
			if !ok {
				return identity.ErrResourceDenied
			}
			uri, err := identity.ParseResourceURI(child.URI)
			if err != nil || uri.Kind != "datasource" || !identity.MetadataExpiryValid(child.ValidUntil, time.Now()) {
				return identity.ErrResourceDenied
			}
		} else {
			return identity.ErrResourceDenied
		}
	}
	if backend.ProducerKind != "" && backend.ProducerKind != "datly" && backend.ProducerKind != "mcp" {
		return fmt.Errorf("unknown datasource producer kind")
	}
	classified := backend.ProducerKind == "datly"
	if backend.Component == nil {
		if classified {
			return fmt.Errorf("Datly producer requires an exact component pin")
		}
		return nil
	}
	if (!providerOwned && backend.Kind != dsproto.BackendMCPTool) || backend.ProducerKind == "mcp" {
		return fmt.Errorf("component source cannot downgrade to generic backend")
	}
	pin := backend.Component
	fingerprint := func(value string) bool {
		return (identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: value}).Valid()
	}
	if pin.ID == "" || strings.TrimSpace(pin.ID) != pin.ID || pin.Revision == "" || strings.TrimSpace(pin.Revision) != pin.Revision || pin.Revision == "active" || pin.Revision == "latest" || pin.Revision == "working" || (pin.Kind != "linked" && pin.Kind != "dynamic") || !fingerprint(pin.ContentFingerprint) || !fingerprint(pin.SchemaFingerprint) {
		return fmt.Errorf("incomplete exact component pin")
	}
	if providerOwned {
		return nil
	}
	if s.components == nil || !s.components.IsComponentProducer(backend.Service) {
		return fmt.Errorf("component producer exact transport unavailable")
	}
	observed, err := s.components.ObserveComponent(ctx, backend.Service, backend.Method, *pin)
	if err != nil {
		return err
	}
	return windowprotocol.ValidateComponentDispatch(pin, observed)
}
