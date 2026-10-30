package artifactrelease

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

type priorityFactsKey struct{}
type priorityFacts struct{}

func (priorityFacts) Resolve(ctx context.Context) (authz.Facts, error) {
	return ctx.Value(priorityFactsKey{}).(authz.Facts), nil
}

type priorityCaller struct {
	publisher *artifactcohort.Publisher
	calls     int
}

func (c *priorityCaller) Discover(context.Context) (artifactcohort.Manifest, error) {
	c.calls++
	return c.publisher.Snapshot()
}
func (c *priorityCaller) Fetch(_ context.Context, in artifactcohort.FetchInput) (*artifactcohort.Artifact, error) {
	return c.publisher.Get(in.Root)
}

func TestNamedExecutePrioritySelectsReleaseAfterColdSync(t *testing.T) {
	ctx := context.Background()
	p := artifactcohort.NewPublisher()
	low := releaseArtifact(t, p, "window://sales/main", 1, `{"name":"stable"}`)
	high := releaseArtifact(t, p, "window://sales/main", 2, `{"name":"preview"}`)
	var policies []authz.Document
	var cohorts []artifactcohort.Cohort
	for i, ref := range []artifactcohort.RootRef{low, high} {
		name := []string{"stable", "preview"}[i]
		doc, named := releaseNamedPolicy("tenant", name, name, 1)
		definition := doc.Policies[authz.NamedDefinitionAction].Definition
		execution := definition.Policies["execute"]
		execution.Priority = i * 10
		definition.Policies["execute"] = execution
		// Describe remains a mandatory visibility gate, not a competing rank.
		describe := definition.Policies["describe"]
		describe.Priority = 100 - i
		definition.Policies["describe"] = describe
		bundle, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{ref}, func(_ context.Context, r artifactcohort.RootRef) (*artifactcohort.Artifact, error) { return p.Get(r) })
		require.NoError(t, err)
		channel, err := NewChannel(Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: name}, name, []authz.NamedReference{named})
		require.NoError(t, err)
		channel, err = PreparePromotion(channel, 0, bundle)
		require.NoError(t, err)
		compiled, err := CompileCohorts(ctx, channel, bundle, []authz.Document{doc})
		require.NoError(t, err)
		require.Equal(t, i*10, compiled.Cohorts[0].Priority)
		policies = append(policies, compiled.Policies...)
		cohorts = append(cohorts, compiled.Cohorts...)
	}
	_, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	require.NoError(t, err)
	caller := &priorityCaller{publisher: p}
	replica, err := artifactcohort.NewReplica(artifactcohort.Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: caller, Facts: priorityFacts{}, SessionKey: func(ctx context.Context) (string, error) {
		f := ctx.Value(priorityFactsKey{}).(authz.Facts)
		return f.Subject, nil
	}})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	for _, tc := range []struct {
		name  string
		roles []string
		want  artifactcohort.RootRef
	}{{"both", []string{"stable", "preview"}, high}, {"stable-only", []string{"stable"}, low}} {
		actor := context.WithValue(ctx, priorityFactsKey{}, authz.Facts{Subject: tc.name, Tenant: "tenant", Issuer: "verified", Roles: tc.roles, GrantedScopes: []string{"catalog.read", "catalog.execute"}, ValidUntil: time.Now().Add(time.Hour)})
		require.NoError(t, replica.Admit(actor))
		got, err := replica.Open(actor, low.URI)
		require.NoError(t, err)
		require.Equal(t, tc.want, got.Ref())
	}
	require.Equal(t, 1, caller.calls, "local release selection must not rediscover metadata")
}
