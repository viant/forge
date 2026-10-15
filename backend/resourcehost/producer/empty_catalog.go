// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

// EmptyCatalog declares supported namespaces and kinds before any resources
// exist. Static Bindings may populate the same namespaces. It holds no cache
// or mutable inventory and is useful for initially empty captured sources.
type EmptyCatalog []primitive.NamespaceCapabilities

func (c EmptyCatalog) Namespaces() []primitive.NamespaceCapabilities { return c }

func (EmptyCatalog) List(context.Context, identity.VerifiedActor, string, string) ([]LocalResourceBinding, error) {
	return nil, nil
}

func (EmptyCatalog) Lookup(context.Context, identity.VerifiedActor, identity.ResourceURI) (LocalResourceBinding, error) {
	return LocalResourceBinding{}, ErrCatalogNotFound
}
