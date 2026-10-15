// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"sort"
)

// Report definitions already admitted by the owning reader are immutable for
// this operation. Reuse lives in the existing read sequence, never across calls.
// Managing MCP still authorizes every data dispatch; finish freshly checks all
// retained report sources before any buffered operation output is released.
func (s *resourceReadSequence) reportRead(connection Connection, pin *identity.ResolvedResource, key string) (primitive.GetResult, bool, error) {
	if pin == nil {
		return primitive.GetResult{}, false, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil {
		return primitive.GetResult{}, false, identity.ErrResourceDenied
	}
	if !s.active {
		return primitive.GetResult{}, false, nil
	}
	held, ok := s.reportReads[selectionResourceID(connection, *pin)]
	if !ok {
		return primitive.GetResult{}, false, nil
	}
	if held.key != key || !identity.MetadataExpiryValid(held.pin.ValidUntil, s.gateway.now()) {
		return primitive.GetResult{}, false, identity.ErrResourceDenied
	}
	value, err := detachedGet(&held.result)
	return value, err == nil, err
}
func (r *gatewayReportReader) recordReportRead(ctx context.Context, connection Connection, result *primitive.GetResult) error {
	s := sequenceFromContext(ctx)
	if s == nil {
		return nil
	}
	if result == nil || result.ResolvedResource == nil || result.Resource == nil {
		return identity.ErrResourceDenied
	}
	read := selectedResourceRead{connection: connection, pin: *result.ResolvedResource, result: *result}
	var err error
	read.result, err = detachedGet(result)
	if err != nil {
		return err
	}
	read.key, err = s.selectionKey(ctx, read)
	if err != nil {
		return err
	}
	id := selectionResourceID(connection, read.pin)
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil || s.ending || !s.active {
		return identity.ErrResourceDenied
	}
	if s.reportReads == nil {
		s.reportReads = map[string]selectedResourceRead{}
	}
	if held, ok := s.reportReads[id]; ok {
		if held.key != read.key || !sameSelectedContent(held.result, read.result) {
			return identity.ErrResourceDenied
		}
	} else {
		s.reportReads[id] = read
	}
	return nil
}
func (s *resourceReadSequence) refreshReportReads(ctx context.Context) error {
	s.mu.Lock()
	reads := map[string]selectedResourceRead{}
	for k, v := range s.reportReads {
		reads[k] = v
	}
	s.mu.Unlock()
	ids := make([]string, 0, len(reads))
	for k := range reads {
		ids = append(ids, k)
	}
	sort.Strings(ids)
	for _, k := range ids {
		held := reads[k]
		key, err := s.selectionKey(ctx, held)
		if err != nil || key != held.key {
			return identity.ErrResourceDenied
		}
		fresh, err := get[json.RawMessage](ctx, s.gateway, held.connection, identity.ResourceRef{URI: held.pin.URI, Revision: held.pin.Selector()}, &held.pin, true, false)
		if err != nil {
			return err
		}
		if !sameSelectedContent(held.result, fresh.GetResult) || identity.MinimumMetadataExpiry(fresh.ResolvedResource.ValidUntil, held.pin.ValidUntil).Before(held.pin.ValidUntil) {
			return identity.ErrResourceStale
		}
	}
	return nil
}

// Only the owning dependency resolver may register children, after the complete
// original mapping and each exact descriptor have passed its existing checks.
func (g *Gateway) recordReportDependencies(ctx context.Context, parent identity.ResolvedResource, reads []selectedResourceRead) error {
	s := sequenceFromContext(ctx)
	if s == nil {
		return nil
	}
	s.mu.Lock()
	bound := false
	for _, held := range s.reportReads {
		if held.pin.URI == parent.URI && held.pin.ProviderIdentity == parent.ProviderIdentity && held.pin.ResourceCandidate == parent.ResourceCandidate && held.pin.AuthorityBinding == parent.AuthorityBinding && !identity.MetadataExpiryExtends(parent.ValidUntil, held.pin.ValidUntil) {
			bound = true
			break
		}
	}
	s.mu.Unlock()
	if !bound {
		return identity.ErrResourceDenied
	}
	for _, read := range reads {
		var err error
		read.result, err = detachedGet(&read.result)
		if err != nil {
			return err
		}
		read.key, err = s.selectionKey(ctx, read)
		if err != nil {
			return err
		}
		id := selectionResourceID(read.connection, read.pin)
		s.mu.Lock()
		if s.closed || s.failed != nil || s.ending || !s.active {
			s.mu.Unlock()
			return identity.ErrResourceDenied
		}
		if held, ok := s.reportReads[id]; ok {
			if held.key != read.key || !sameSelectedContent(held.result, read.result) {
				s.mu.Unlock()
				return identity.ErrResourceStale
			}
		} else {
			s.reportReads[id] = read
		}
		s.mu.Unlock()
	}
	return nil
}
