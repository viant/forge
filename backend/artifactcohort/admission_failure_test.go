package artifactcohort

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
)

type failingAdmissionFacts struct {
	cause error
	calls int
}

func (p *failingAdmissionFacts) Resolve(ctx context.Context) (authz.Facts, error) {
	p.calls++
	if p.cause != nil {
		return authz.Facts{}, fmt.Errorf("verified facts: %w", p.cause)
	}
	return fixtureFacts{}.Resolve(ctx)
}

func TestReportMetadataAdmissionPreservesFailureAndRecovery(t *testing.T) {
	ctx := actorContext("reader", "operator")
	for _, tc := range []struct {
		name   string
		cause  error
		status int
	}{
		{"outage", authz.ErrUnavailable, 503}, {"denial", authz.ErrDenied, 403}, {"canceled", context.Canceled, 0}, {"deadline", context.DeadlineExceeded, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := NewPublisher()
			a, _, err := p.Publish(ctx, RootRef{URI: "report://example/summary", Kind: "report", Version: 1}, []byte(`{"schemaVersion":1,"reportDocument":{"title":"Summary"}}`), allowPublished)
			require.NoError(t, err)
			policies, cohorts := cohortFixture()
			cohorts[0].Roots = []RootRef{a.Root}
			_, err = p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
			require.NoError(t, err)
			facts := &failingAdmissionFacts{cause: tc.cause}
			caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
			replica, err := NewReplica(Config{Enabled: true, Source: "source", Tenant: "tenant", Account: "account", Caller: caller, Facts: facts, SessionKey: fixtureSession})
			require.NoError(t, err)
			require.NoError(t, replica.Sync(ctx))
			source, err := NewMetadataSource(replica, []string{"example"})
			require.NoError(t, err)
			result, err := source.Get(ctx, a.Root.URI)
			require.Nil(t, result)
			require.ErrorIs(t, err, tc.cause)
			require.NotContains(t, err.Error(), "verified facts")
			list, err := source.List(ctx, "report", "example")
			require.Nil(t, list)
			require.ErrorIs(t, err, tc.cause)
			require.NotContains(t, err.Error(), "verified facts")
			if tc.status != 0 {
				var status interface{ HTTPStatusCode() int }
				require.ErrorAs(t, err, &status)
				require.Equal(t, tc.status, status.HTTPStatusCode())
			}
			require.Equal(t, 2, facts.calls)
			facts.cause = nil
			result, err = source.Get(ctx, a.Root.URI)
			require.NoError(t, err)
			require.Equal(t, a.Root.Hash, result.ContentFingerprint)
			_, err = source.Get(ctx, a.Root.URI)
			require.NoError(t, err)
			require.Equal(t, 3, facts.calls)
			other := actorContext("different", "different-role")
			result, err = source.Get(other, a.Root.URI)
			require.Nil(t, result)
			require.True(t, errors.Is(err, ErrDenied))
		})
	}
}

type admissionPolicyStore struct {
	authz.Store
	onRead func()
	cause  error
}

func (s admissionPolicyStore) Get(context.Context, authz.Resource) (authz.Document, error) {
	if s.onRead != nil {
		s.onRead()
	}
	return authz.Document{}, s.cause
}

func TestCohortJoinPreservesPolicyReadFailure(t *testing.T) {
	resource := authz.Resource{Kind: "cohort", ID: "sample", Version: "logical", Tenant: "tenant"}
	ctx, cancel := context.WithCancel(context.Background())
	allowed, err := admitPolicy(ctx, &authz.Service{Store: admissionPolicyStore{onRead: cancel, cause: authz.ErrDenied}}, resource, "viewer")
	require.False(t, allowed)
	require.ErrorIs(t, err, context.Canceled)
	allowed, err = admitPolicy(context.Background(), &authz.Service{Store: admissionPolicyStore{cause: authz.ErrUnavailable}}, resource, "viewer")
	require.False(t, allowed)
	require.ErrorIs(t, err, ErrUnavailable)
	require.ErrorIs(t, err, authz.ErrUnavailable)
}

type admissionNamedPolicyStore struct {
	authz.Store
	assignment authz.Document
}

func (s admissionNamedPolicyStore) Get(_ context.Context, resource authz.Resource) (authz.Document, error) {
	if resource == s.assignment.Resource {
		return s.assignment, nil
	}
	return authz.Document{}, errors.Join(authz.ErrDenied, authz.ErrUnavailable)
}

func TestCohortJoinDoesNotTreatUnavailableNamedPolicyAsNonmember(t *testing.T) {
	resource := authz.Resource{Kind: "cohort", ID: "sample", Version: "logical", Tenant: "tenant"}
	dependency := authz.Resource{Kind: "policy", ID: "shared", Version: "logical", Tenant: "tenant"}
	assignment := authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{
		PolicyAction: {Mode: "named", Named: &authz.NamedReference{Resource: dependency, Revision: 1}},
	}}
	service := &authz.Service{Store: admissionNamedPolicyStore{assignment: assignment}}
	allowed, err := admitPolicy(context.Background(), service, resource, "viewer")
	require.False(t, allowed)
	require.ErrorIs(t, err, ErrUnavailable)
	require.ErrorIs(t, err, authz.ErrUnavailable)
}
