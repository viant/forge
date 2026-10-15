// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	mcp "github.com/viant/mcp/server"
	"net/http"
	"sync/atomic"
)

type LocalResourceBinding = producer.LocalResourceBinding
type LocalResourceValidator = producer.LocalResourceValidator
type LocalResourceAuthorizer = producer.LocalResourceAuthorizer
type LocalRevisionPolicyFactory = producer.LocalRevisionPolicyFactory
type LocalWindowListVisibility = producer.LocalWindowListVisibility
type LocalWindowIndex = producer.LocalWindowIndex
type LocalConfig = producer.LocalConfig

// LocalProvider adapts host validation caching to one immutable producer
// generation. Request-time authority and resource reads remain in the producer.
type LocalProvider struct {
	provider atomic.Pointer[producer.LocalProvider]
}

func NewLocalProvider(config LocalConfig) (*LocalProvider, error) {
	if config.DefinitionValidationCache == nil {
		config.DefinitionValidationCache = func(source identity.ResourceSource, kind string, version int64, fingerprint string, validator LocalResourceValidator) bool {
			cached, ok := source.(interface {
				localDefinitionValidated(string, int64, string) bool
			})
			return ok && pureLocalValidator(kind, validator) && cached.localDefinitionValidated(kind, version, fingerprint)
		}
	}
	n, err := producer.NewLocalProvider(config)
	if err != nil {
		return nil, err
	}
	p := &LocalProvider{}
	p.provider.Store(n)
	return p, nil
}

// neutral returns the published producer without reconstructing its catalog.
func (p *LocalProvider) neutral() (*producer.LocalProvider, error) {
	if p == nil {
		return nil, ErrUnavailable
	}
	n := p.provider.Load()
	if n == nil {
		return nil, ErrUnavailable
	}
	return n, nil
}

func (p *LocalProvider) ProviderIdentity() string {
	n, err := p.neutral()
	if err != nil {
		return ""
	}
	return n.ProviderIdentity()
}
func (p *LocalProvider) NamespaceList(ctx context.Context, in primitive.NamespaceListRequest) (*primitive.NamespaceListResult, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return n.NamespaceList(ctx, in)
}
func (p *LocalProvider) NamespaceGet(ctx context.Context, in primitive.NamespaceGetRequest) (*primitive.NamespaceCapabilities, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return n.NamespaceGet(ctx, in)
}
func (p *LocalProvider) List(ctx context.Context, kind string, in primitive.ListRequest) (*primitive.ListResult, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return n.List(ctx, kind, in)
}
func (p *LocalProvider) Get(ctx context.Context, kind string, in primitive.GetRequest) (*primitive.GetResult, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return n.Get(ctx, kind, in)
}
func (p *LocalProvider) call(ctx context.Context, method string, raw json.RawMessage) (any, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return n.Call(ctx, method, raw)
}
func (p *LocalProvider) installedTools() []string {
	n, e := p.neutral()
	if e != nil {
		return nil
	}
	return n.InstalledTools()
}
func NewLocalMCPHandler(p *LocalProvider, protect func(http.Handler) http.Handler) (http.Handler, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return producer.NewLocalMCPHandler(n, protect)
}
func NewMCPHandler(p *LocalProvider, protect func(http.Handler) http.Handler) (http.Handler, error) {
	return NewLocalMCPHandler(p, protect)
}
func newLocalMCPServer(p *LocalProvider, compact ...bool) (*mcp.Server, error) {
	n, e := p.neutral()
	if e != nil {
		return nil, e
	}
	return producer.NewMCPServer(n, compact...)
}
func sameLocalActor(a, b identity.VerifiedActor) bool {
	return a.Subject == b.Subject && a.Issuer == b.Issuer && a.TenantID == b.TenantID && a.AccountID == b.AccountID && a.IdentityRevision == b.IdentityRevision
}
