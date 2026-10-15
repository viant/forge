// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package mcp

import (
	"context"
	"errors"

	service "github.com/viant/forge/backend/provider"
	"github.com/viant/jsonrpc/transport"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/logger"
	protoserver "github.com/viant/mcp-protocol/server"
)

type Handler struct {
	*protoserver.DefaultHandler
	service      *service.Service
	ops          protoclient.Operations
	portableOnly bool
}

// NewProviderHandler exposes only published catalogs, definitions and guarded
// datasource execution. Standalone providers do not need a browser UI bridge.
func NewProviderHandler(svc *service.Service) protoserver.NewHandler {
	return func(_ context.Context, notifier transport.Notifier, log logger.Logger, ops protoclient.Operations) (protoserver.Handler, error) {
		if svc == nil || !svc.HasPrimitiveProvider() {
			return nil, errors.New("portable Forge provider is not configured")
		}
		base := protoserver.NewDefaultHandler(notifier, log, ops)
		ret := &Handler{DefaultHandler: base, service: svc, ops: ops, portableOnly: true}
		configureCanonicalResources(ret)
		if err := registerTools(base, ret); err != nil {
			return nil, err
		}
		return ret, nil
	}
}

func NewHandler(svc *service.Service) protoserver.NewHandler {
	return func(_ context.Context, notifier transport.Notifier, logger logger.Logger, clientOperation protoclient.Operations) (protoserver.Handler, error) {
		base := protoserver.NewDefaultHandler(notifier, logger, clientOperation)
		ret := &Handler{DefaultHandler: base, service: svc, ops: clientOperation}
		configureCanonicalResources(ret)
		if err := registerTools(base, ret); err != nil {
			return nil, err
		}
		return ret, nil
	}
}
