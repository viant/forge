package resource

import (
	"context"
	"encoding/json"
	"net/http"

	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"

	forgeTypes "github.com/viant/forge/backend/types"
)

type localFixtureSource struct {
	producer.ResourceChanges
	mu     sync.Mutex
	raw    json.RawMessage
	onRead func()
}

func (s *localFixtureSource) bytes() json.RawMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append(json.RawMessage(nil), s.raw...)
}
func (s *localFixtureSource) Candidates(_ context.Context, uri identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	raw := s.bytes()
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(raw)}}, nil
}
func (s *localFixtureSource) ReadCandidate(_ context.Context, _ identity.ResourceURI, c identity.ResourceCandidate) (json.RawMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.onRead != nil {
		s.onRead()
	}
	return append(json.RawMessage(nil), s.raw...), nil
}

type localFixturePolicy struct {
	actor         identity.VerifiedActor
	now           func() time.Time
	denyAfterRead *bool
	denyOmitted   bool
	seenRevision  *string
}

func (p localFixturePolicy) SelectRevision(_ context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if p.seenRevision != nil {
		*p.seenRevision = ref.Revision
	}
	if ref.Revision != "" && ref.Revision != identity.WorkingCandidate || ref.Revision == "" && p.denyOmitted || len(candidates) != 1 || candidates[0].Kind != identity.WorkingCandidate {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	if p.denyAfterRead != nil && *p.denyAfterRead {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "fixture-authority", ValidUntil: p.actor.ValidUntil}, nil
}
func localWindowBytes(t *testing.T) json.RawMessage {
	t.Helper()
	w := &forgeTypes.Window{View: forgeTypes.View{Content: &forgeTypes.Container{ID: "root"}}}
	v := forgeTypes.WindowResourceVariant{Window: w, DataSources: map[string]json.RawMessage{}}
	fp, err := forgeTypes.WindowVariantFingerprint(v)
	require.NoError(t, err)
	e := forgeTypes.WindowResourceEnvelope{SchemaVersion: 2, Format: forgeTypes.WindowBundleFormat, Targets: []forgeTypes.WindowTargetBinding{{Target: forgeTypes.WindowTarget{}, Variant: fp}}, Variants: map[string]forgeTypes.WindowResourceVariant{fp: v}}
	raw, err := json.Marshal(e)
	require.NoError(t, err)
	require.NoError(t, e.Validate())
	return raw
}
func localFixture(t *testing.T) (*LocalProvider, *localFixtureSource, *identity.VerifiedActor, *bool) {
	t.Helper()
	actor := &identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "team", AccountID: "acct-opaque", IdentityRevision: "facts-1", ValidUntil: time.Now().Add(time.Minute)}
	source := &localFixtureSource{raw: localWindowBytes(t)}
	revoked := new(bool)
	actorResolver := func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }
	verify := func(_ context.Context, expected identity.VerifiedActor) error {
		if *revoked || expected.Subject != actor.Subject || expected.AccountID != actor.AccountID || !expected.Valid(time.Now()) {
			return identity.ErrResourceDenied
		}
		return nil
	}
	policyFactory := func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "local-workspace", Source: source, Policy: localFixturePolicy{actor: a}}, nil
	}
	p, err := NewLocalProvider(LocalConfig{ProviderIdentity: "local-workspace", Actor: actorResolver, Verify: verify, Authorize: func(_ context.Context, _ identity.VerifiedActor, u identity.ResourceURI, _ string) error {
		if u.Namespace != "team" {
			return identity.ErrResourceDenied
		}
		return nil
	}, Bindings: []LocalResourceBinding{{URI: "window://team/sales", Title: "Sales", FormatVersion: 2, Resolver: policyFactory}, {URI: "window://elsewhere/secret", Title: "Secret", FormatVersion: 2, Resolver: policyFactory}}, Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle}})
	require.NoError(t, err)
	return p, source, actor, revoked
}

type localTestRequest struct{}
type localAuthRoundTripper struct{ next http.RoundTripper }

func (r localAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	copy := req.Clone(req.Context())
	copy.Header = req.Header.Clone()
	copy.Header.Set("Authorization", "Bearer fixture")
	return r.next.RoundTrip(copy)
}
