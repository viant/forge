// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
)

// timingLabels includes configured namespace names only. This path is called
// only when enabled; untrusted filters and resource/user paths never become tags.
func (p *LocalProvider) timingLabels(kind, namespace string) observe.Labels {
	labels := observe.Labels{Provider: p.identity}
	if primitive.Plural(kind) != "" || kind == "resource" {
		labels.Kind = kind
	}
	if namespace == "" {
		return labels
	}
	if _, ok := p.catalogKinds[namespace]; ok {
		labels.Namespace = namespace
		return labels
	}
	if p.observedNamespaces[namespace] {
		labels.Namespace = namespace
	}
	return labels
}
func (p *LocalProvider) timing(ctx context.Context, phase observe.Phase, kind, namespace string) observe.Span {
	if p == nil || !observe.Enabled(ctx) {
		return observe.Span{}
	}
	return observe.Start(ctx, phase, p.timingLabels(kind, namespace))
}
