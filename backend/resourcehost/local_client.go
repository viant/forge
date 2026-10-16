// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	producer "github.com/viant/forge/backend/resourcehost/producer"
	mcpclient "github.com/viant/mcp/client"
)

// NewLocalMCPClient exports the authoritative local provider through the same
// SDK tools/list/call handler as HTTP. Every operation uses its own request
// context; startup actor/authority is never captured. No aggregate self-proxy
// or network listener is involved. The provider's actor verifier is mandatory.
func NewLocalMCPClient(provider *LocalProvider) (mcpclient.Interface, error) {
	if provider == nil {
		return nil, ErrUnavailable
	}
	neutral, err := provider.neutral()
	if err != nil {
		return nil, err
	}
	return producer.NewLocalMCPClient(neutral)
}
