// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var ErrResource = errors.New("invalid resource identity")
var ErrResourceDenied = errors.New("resource revision denied")
var ErrResourceStale = errors.New("resolved resource content changed")

const WorkingCandidate = "working"
const StampedCandidate = "stamped"

// PublishedCandidate selects the immutable content already chosen by the
// authenticated local cohort. It has no independent revision selector.
const PublishedCandidate = "published"
const ResourcePathMaxLength = 512

// ResourceURI is a logical identity. Namespace never denotes a network host.
type ResourceURI struct {
	Kind      string `json:"kind" yaml:"kind"`
	Namespace string `json:"namespace" yaml:"namespace"`
	// Name is a canonical relative path beneath Namespace, including subfolders.
	Name string `json:"name" yaml:"name"`
}

func ParseResourceURI(value string) (ResourceURI, error) {
	parts := strings.Split(value, "://")
	if len(parts) != 2 {
		return ResourceURI{}, ErrResource
	}
	names := strings.SplitN(parts[1], "/", 2)
	if len(names) != 2 {
		return ResourceURI{}, ErrResource
	}
	result := ResourceURI{Kind: parts[0], Namespace: names[0], Name: names[1]}
	if !result.Valid() {
		return ResourceURI{}, ErrResource
	}
	return result, nil
}
func (r ResourceURI) Valid() bool {
	return ValidResourceKind(r.Kind) && resourceName(r.Namespace) && resourcePath(r.Name)
}

func resourcePath(value string) bool {
	if len(value) == 0 || len(value) > ResourcePathMaxLength {
		return false
	}
	for _, segment := range strings.Split(value, "/") {
		if !resourceName(segment) {
			return false
		}
	}
	return true
}

// ValidResourceKind accepts canonical lower-case logical kind tokens. Content
// support is a separate trusted handler registration, never a URI guess.
func ValidResourceKind(value string) bool {
	switch value {
	case "http", "https", "ws", "wss", "file", "ftp", "data":
		return false
	}
	if len(value) < 1 || len(value) > 64 || value[0] < 'a' || value[0] > 'z' {
		return false
	}
	for _, char := range value {
		if !(char >= 'a' && char <= 'z' || char >= '0' && char <= '9' || char == '-') {
			return false
		}
	}
	return true
}
func (r ResourceURI) String() string { return r.Kind + "://" + r.Namespace + "/" + r.Name }
func resourceName(value string) bool {
	if len(value) < 1 || len(value) > 64 || value == "." || value == ".." {
		return false
	}
	for _, char := range value {
		if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '.' || char == '_' || char == '-') {
			return false
		}
	}
	return true
}

// Revision is an optional requested stamp. The reserved "working" selector
// explicitly requests mutable content; an omitted selector is policy-selected.
type ResourceRef struct {
	URI      string `json:"uri" yaml:"uri"`
	Revision string `json:"revision,omitempty" yaml:"revision,omitempty"`
}
type ResourceCandidate struct {
	Kind               string `json:"kind" yaml:"kind"`
	Revision           string `json:"revision,omitempty" yaml:"revision,omitempty"`
	ContentFingerprint string `json:"contentFingerprint" yaml:"contentFingerprint"`
}

func (c ResourceCandidate) Valid() bool {
	if c.Kind != WorkingCandidate && c.Kind != StampedCandidate && c.Kind != PublishedCandidate {
		return false
	}
	if (c.Kind == WorkingCandidate || c.Kind == PublishedCandidate) && c.Revision != "" || c.Kind == StampedCandidate && (!resourceName(c.Revision) || c.Revision == WorkingCandidate) {
		return false
	}
	if len(c.ContentFingerprint) != 64 {
		return false
	}
	decoded, err := hex.DecodeString(c.ContentFingerprint)
	return err == nil && len(decoded) == 32 && strings.ToLower(c.ContentFingerprint) == c.ContentFingerprint
}
func (c ResourceCandidate) Selector() string {
	if c.Kind == WorkingCandidate {
		return WorkingCandidate
	}
	return c.Revision
}

type ResolvedResource struct {
	// ProviderIdentity is host-declared instance provenance. It is separate
	// from the logical URI and must match the executing resolver when present.
	ProviderIdentity  string `json:"providerIdentity,omitempty" yaml:"providerIdentity,omitempty"`
	URI               string `json:"uri" yaml:"uri"`
	ResourceCandidate `json:",inline" yaml:",inline"`
	// AuthorityBinding is recomputed by trusted policy from the current verified
	// principal, account and authority revision. Client text grants no authority.
	AuthorityBinding string    `json:"authorityBinding" yaml:"authorityBinding"`
	ValidUntil       time.Time `json:"validUntil" yaml:"validUntil"`
}

// SameResolvedResource compares the complete lease across transport encodings.
// time.Time.Equal ignores the monotonic reading that JSON does not preserve.
func SameResolvedResource(a, b ResolvedResource) bool {
	return a.ProviderIdentity == b.ProviderIdentity && a.URI == b.URI &&
		a.ResourceCandidate == b.ResourceCandidate && a.AuthorityBinding == b.AuthorityBinding &&
		a.ValidUntil.Equal(b.ValidUntil)
}

type ResourceDecision struct {
	Candidate        ResourceCandidate
	AuthorityBinding string
	ValidUntil       time.Time
}

// ResourceSource returns all available candidates without choosing a default.
// ReadCandidate must return the exact supplied identity, never an active alias.
type ResourceSource interface {
	Candidates(context.Context, ResourceURI) ([]ResourceCandidate, error)
	ReadCandidate(context.Context, ResourceURI, ResourceCandidate) (json.RawMessage, error)
}

// ResourceRevisionPolicy is implemented by the trusted host. It must bind the
// current verified principal, action and entity scope in ctx. Explicit selectors
// are authorized too; no allowed candidate is a denial, never a default choice.
type ResourceRevisionPolicy interface {
	SelectRevision(context.Context, ResourceRef, []ResourceCandidate) (ResourceDecision, error)
}
type ResourceResolver struct {
	ProviderIdentity string
	Source           ResourceSource
	Policy           ResourceRevisionPolicy
	Now              func() time.Time
}

func (r *ResourceResolver) now() time.Time {
	if r.Now != nil {
		return r.Now()
	}
	return time.Now()
}
func (r *ResourceResolver) Resolve(ctx context.Context, ref ResourceRef) (*ResolvedResource, error) {
	if r == nil || r.Source == nil || r.Policy == nil || ctx == nil || ctx.Err() != nil {
		return nil, ErrResourceDenied
	}
	uri, err := ParseResourceURI(ref.URI)
	if err != nil {
		return nil, err
	}
	if ref.Revision != "" && !resourceName(ref.Revision) {
		return nil, ErrResource
	}
	candidates, err := r.Source.Candidates(ctx, uri)
	if err != nil {
		return nil, err
	}
	eligible := make([]ResourceCandidate, 0, len(candidates))
	seen := map[string]bool{}
	for _, candidate := range candidates {
		if !candidate.Valid() || seen[candidate.Selector()] {
			return nil, ErrResource
		}
		seen[candidate.Selector()] = true
		if ref.Revision == "" || candidate.Selector() == ref.Revision {
			eligible = append(eligible, candidate)
		}
	}
	return r.selectCandidate(ctx, ref, eligible)
}
func (r *ResourceResolver) selectCandidate(ctx context.Context, ref ResourceRef, candidates []ResourceCandidate) (*ResolvedResource, error) {
	if len(candidates) == 0 {
		return nil, ErrResourceDenied
	}
	// Keep authority's argument isolated from the candidate set used to validate
	// its response. A policy cannot introduce a nonexistent revision.
	decision, err := r.Policy.SelectRevision(ctx, ref, append([]ResourceCandidate(nil), candidates...))
	if err != nil {
		return nil, err
	}
	if ctx.Err() != nil || decision.AuthorityBinding == "" || strings.TrimSpace(decision.AuthorityBinding) != decision.AuthorityBinding || !MetadataExpiryValid(decision.ValidUntil, r.now()) {
		return nil, ErrResourceDenied
	}
	for _, candidate := range candidates {
		if candidate == decision.Candidate {
			return &ResolvedResource{ProviderIdentity: r.ProviderIdentity, URI: ref.URI, ResourceCandidate: candidate, AuthorityBinding: decision.AuthorityBinding, ValidUntil: decision.ValidUntil}, nil
		}
	}
	return nil, ErrResourceDenied
}

// ReadResolved reauthorizes only the pinned identity. It detects mutable-file
// drift and never silently switches an open window/run to a different stamp.
func (r *ResourceResolver) ReadResolved(ctx context.Context, pinned ResolvedResource) (json.RawMessage, *ResolvedResource, error) {
	if r == nil || r.Source == nil || r.Policy == nil || ctx == nil || ctx.Err() != nil {
		return nil, nil, ErrResourceDenied
	}
	uri, err := ParseResourceURI(pinned.URI)
	if err != nil || !pinned.ResourceCandidate.Valid() || pinned.AuthorityBinding == "" {
		return nil, nil, ErrResource
	}
	if !MetadataExpiryValid(pinned.ValidUntil, r.now()) {
		return nil, nil, ErrResourceDenied
	}
	if pinned.ProviderIdentity != r.ProviderIdentity {
		return nil, nil, ErrResourceDenied
	}
	fresh, err := r.selectCandidate(ctx, ResourceRef{URI: pinned.URI, Revision: pinned.Selector()}, []ResourceCandidate{pinned.ResourceCandidate})
	if err != nil {
		return nil, nil, err
	}
	if fresh.AuthorityBinding != pinned.AuthorityBinding || fresh.ProviderIdentity != pinned.ProviderIdentity {
		return nil, nil, ErrResourceDenied
	}
	raw, err := r.Source.ReadCandidate(ctx, uri, pinned.ResourceCandidate)
	if err != nil {
		return nil, nil, err
	}
	if ContentFingerprint(raw) != pinned.ContentFingerprint {
		return nil, nil, ErrResourceStale
	}
	// Reauthorize after I/O as well: a provider read may outlive revocation or
	// an account switch even while the original lease has time remaining.
	fresh, err = r.selectCandidate(ctx, ResourceRef{URI: pinned.URI, Revision: pinned.Selector()}, []ResourceCandidate{pinned.ResourceCandidate})
	if err != nil {
		return nil, nil, err
	}
	if fresh.AuthorityBinding != pinned.AuthorityBinding || fresh.ProviderIdentity != pinned.ProviderIdentity {
		return nil, nil, ErrResourceDenied
	}
	// Recheck after potentially slow I/O. The previous lease remains a cap.
	if !MetadataExpiryValid(pinned.ValidUntil, r.now()) || !MetadataExpiryValid(fresh.ValidUntil, r.now()) || ctx.Err() != nil {
		return nil, nil, ErrResourceDenied
	}
	fresh.ValidUntil = MinimumMetadataExpiry(fresh.ValidUntil, pinned.ValidUntil)
	return append(json.RawMessage(nil), raw...), fresh, nil
}

// ContentFingerprint identifies bytes; it is never a user-visible stamp.
func ContentFingerprint(raw []byte) string {
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

// LocalResource is one unversioned YAML/JSON artifact. Load reads the current
// bytes each time so stale opened content cannot silently execute new content.
type LocalResource struct {
	URI  ResourceURI
	Load func(context.Context) (json.RawMessage, error)
}

func (s *LocalResource) Candidates(ctx context.Context, uri ResourceURI) ([]ResourceCandidate, error) {
	if s == nil || s.Load == nil || !s.URI.Valid() || s.URI != uri {
		return nil, ErrResource
	}
	raw, err := s.Load(ctx)
	if err != nil {
		return nil, err
	}
	return []ResourceCandidate{{Kind: WorkingCandidate, ContentFingerprint: ContentFingerprint(raw)}}, nil
}
func (s *LocalResource) ReadCandidate(ctx context.Context, uri ResourceURI, candidate ResourceCandidate) (json.RawMessage, error) {
	if s == nil || s.Load == nil || s.URI != uri || candidate.Kind != WorkingCandidate || !candidate.Valid() {
		return nil, ErrResource
	}
	return s.Load(ctx)
}
