// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"time"

	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

// WindowSelectionEmitter is optional trusted startup wiring, called only by
// successful canonical OPEN transports. Parameters are the complete effective
// selection, never the authored Window.Parameters declarations. The host owns
// fresh credential/canonical user verification, instance identity and signing.
// Its binding is selection provenance and grants no datasource capability.
// ErrWindowSelectionUnavailable is a neutral trusted-host availability signal.
// OPEN emitters normalize their known dependency sentinel at this boundary;
// private error text never determines status and is never sent to clients.
var ErrWindowSelectionUnavailable = errors.New("window selection authority unavailable")

type WindowSelectionEmitter func(context.Context, *types.Window, map[string]any) (*identity.SelectionBinding, error)

func (s *Service) ConfigureWindowSelectionEmitter(emit WindowSelectionEmitter) {
	if s != nil && s.cfg != nil {
		s.cfg.WindowSelectionEmitter = emit
	}
}

func decodeSelectionJSON(raw []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(out); err != nil {
		return err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return identity.ErrResource
	}
	return nil
}
func withoutWindowSelectionBinding(window *types.Window) *types.Window {
	if window == nil {
		return nil
	}
	copy := *window
	copy.SelectionBinding = nil
	return &copy
}
func sanitizedSelectionError(err error) error {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return context.DeadlineExceeded
	case errors.Is(err, context.Canceled):
		return context.Canceled
	case errors.Is(err, ErrWindowSelectionUnavailable):
		return ErrWindowSelectionUnavailable
	default:
		return identity.ErrResourceDenied
	}
}

// EmitWindowSelection runs after the transport's final successful OPEN checks.
// Definition reads and datasource operations never call this method.
func (s *Service) EmitWindowSelection(ctx context.Context, window *types.Window, parameters map[string]any) (*types.Window, error) {
	if s == nil || s.cfg == nil {
		return nil, identity.ErrResourceDenied
	}
	if s.cfg.WindowSelectionEmitter == nil {
		return withoutWindowSelectionBinding(window), nil
	}
	if ctx == nil || ctx.Err() != nil || window == nil || window.Resource == nil || !identity.MetadataExpiryValid(window.Resource.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	original := withoutWindowSelectionBinding(window)
	raw, err := json.Marshal(original)
	if err != nil {
		return nil, identity.ErrResourceDenied
	}
	var output, callbackWindow types.Window
	if decodeSelectionJSON(raw, &output) != nil || decodeSelectionJSON(raw, &callbackWindow) != nil {
		return nil, identity.ErrResourceDenied
	}
	parameterRaw, err := json.Marshal(parameters)
	if err != nil {
		return nil, identity.ErrResourceDenied
	}
	var callbackParameters map[string]any
	if decodeSelectionJSON(parameterRaw, &callbackParameters) != nil {
		return nil, identity.ErrResourceDenied
	}
	digest, err := identity.SelectionParametersDigest(parameters)
	if err != nil {
		return nil, err
	}
	binding, err := s.cfg.WindowSelectionEmitter(ctx, &callbackWindow, callbackParameters)
	if err != nil {
		return nil, sanitizedSelectionError(err)
	}
	if ctx.Err() != nil {
		return nil, sanitizedSelectionError(ctx.Err())
	}
	if binding == nil || binding.Token == "" || binding.Actor.Issuer == "" || binding.Actor.Subject == "" || binding.Actor.TenantID == "" || binding.Actor.AccountID == "" || binding.InstanceID == "" || binding.ParametersDigest != digest || !identity.MetadataExpiryValid(output.Resource.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	copy := *binding
	output.SelectionBinding = &copy
	return &output, nil
}
