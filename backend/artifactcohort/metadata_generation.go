package artifactcohort

import (
	"context"
	"encoding/json"
	"time"
)

// MetadataGeneration identifies current local admission and active partition
// pointers for request-local metadata memos. It reads no artifact body, catalog
// inventory, transport, or roles beyond the existing session admission.
func (s *MetadataSource) MetadataGeneration(ctx context.Context, kind string) (string, error) {
	if s == nil || s.replica == nil || !RootKind(kind) || ctx == nil || ctx.Err() != nil {
		return "", ErrDenied
	}
	if err := s.replica.EnsureAdmitted(ctx); err != nil {
		return "", err
	}
	session, err := s.replica.cfg.SessionKey(ctx)
	if err != nil || session == "" {
		return "", ErrDenied
	}
	selected, err := s.replica.selectedCohort(ctx)
	if err != nil {
		return "", err
	}
	s.replica.mu.RLock()
	defer s.replica.mu.RUnlock()
	admitted, ok := s.replica.admissions[session]
	if !ok || !s.replica.ready || admitted.manifestHash != s.replica.latest.Hash || !admitted.validUntil.After(time.Now()) {
		return "", ErrDenied
	}
	type head struct{ Namespace, Kind, Policy string }
	heads := make([]head, 0, len(s.namespaces))
	for _, namespace := range s.namespaces {
		current := head{Namespace: namespace}
		for _, partition := range []string{kind, "policy"} {
			key := PartitionKey(namespace, partition)
			expected := s.replica.latest.PartitionHashes[key]
			state := s.replica.partitions[key]
			if state == nil {
				if expected != "" {
					return "", ErrUnavailable
				}
			} else if state.stale || state.hash != expected {
				return "", ErrUnavailable
			}
			if partition == kind {
				current.Kind = expected
			} else {
				current.Policy = expected
			}
		}
		heads = append(heads, current)
	}
	raw, err := json.Marshal([]any{s.replica.cfg.Source, s.replica.cfg.Tenant, s.replica.cfg.Account, session, admitted.manifestHash, selected, kind, heads})
	if err != nil {
		return "", err
	}
	return Hash(raw), nil
}
