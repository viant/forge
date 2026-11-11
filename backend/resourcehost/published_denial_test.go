package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type deniedCohortFacts struct{}

func (deniedCohortFacts) Resolve(context.Context) (authz.Facts, error) {
	return authz.Facts{}, authz.ErrDenied
}

func TestRealCohortDenialIsLocalToDiscovery(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	replica, err := artifactcohort.NewReplica(artifactcohort.Config{
		Enabled: true, Source: "restricted-producer", Tenant: "tenant", Account: "account",
		Caller: artifactcohort.NamespaceCaller{Namespace: "restricted"}, Facts: deniedCohortFacts{},
		SessionKey: func(context.Context) (string, error) { return "", authz.ErrDenied },
	})
	require.NoError(t, err)
	source, err := artifactcohort.NewMetadataSource(replica, []string{"restricted"})
	require.NoError(t, err)
	_, denial := source.AdmissionKey(context.Background())
	require.ErrorIs(t, denial, artifactcohort.ErrDenied)
	require.True(t, purePublishedDenial(denial), "real cohort errors use the typed HTTP 403 contract")
	require.False(t, purePublishedDenial(errors.Join(denial, errors.New("corrupt manifest"))))
	connection := Connection{Name: "restricted", ProviderIdentity: "restricted-producer"}
	require.NoError(t, g.RegisterPublishedMetadataSource(connection, []string{"restricted"}, source))
	reader := &MCPReferenceReader{gateway: g, internal: MCPDefinitionSource{ConnectionName: "internal", ProviderIdentity: "internal", Namespace: "workspace"}}
	definitions, supported, err := reader.filteredMCPRows(context.Background(), connection)
	require.NoError(t, err, "retained tool inventory must omit denied cohort definitions")
	require.True(t, supported)
	require.Empty(t, definitions)

	for _, kind := range []string{"mcp", "skill", "navigation", "report", "prompt", "agent", "eval", "playbook", "toolfeed"} {
		page, err := ListPage[json.RawMessage](context.Background(), g, kind, CatalogQuery{}, true)
		require.NoError(t, err, kind)
		require.Len(t, page.Items, 1, kind)
	}
	_, _, err = (&NativeSkillSource{Gateway: g}).CatalogScope(context.Background(), "", []string{"restricted"})
	require.NoError(t, err)
	_, err = g.Get(context.Background(), connection, identity.ResourceRef{URI: "report://restricted/sample"}, nil)
	require.ErrorIs(t, err, artifactcohort.ErrDenied)
	require.Zero(t, trap.calls, "local denial must not contact another transport")
}

func TestDeniedPublishedProviderDoesNotBlockOtherCatalogs(t *testing.T) {
	g, allowed, trap, _ := publishedFixture(t)
	denied := &syntheticPublishedSource{denied: true, namespace: "restricted", owner: "restricted-producer"}
	connection := Connection{Name: "restricted", ProviderIdentity: "restricted-producer"}
	require.NoError(t, g.RegisterPublishedMetadataSource(connection, []string{"restricted"}, denied))
	ctx := context.Background()
	namespaces, err := g.Discover(ctx)
	require.NoError(t, err)
	require.Len(t, namespaces, 1)
	require.Equal(t, "example", namespaces[0].Namespace)
	for _, kind := range []string{"mcp", "skill", "navigation", "report", "prompt", "agent", "eval", "playbook", "toolfeed"} {
		page, err := ListPage[json.RawMessage](ctx, g, kind, CatalogQuery{}, true)
		require.NoError(t, err, kind)
		require.Len(t, page.Items, 1, kind)
	}
	before, err := g.publishedAdmissionKeys(ctx)
	require.NoError(t, err)
	skills := &NativeSkillSource{Gateway: g}
	_, _, err = skills.CatalogScope(ctx, "", []string{"catalog", "restricted"})
	require.NoError(t, err)
	_, err = g.Get(ctx, connection, identity.ResourceRef{URI: "report://restricted/sample"}, nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied, "explicit access remains denied")
	allowed.denied = true
	namespaces, err = g.Discover(ctx)
	require.NoError(t, err)
	require.Empty(t, namespaces)
	after, err := g.publishedAdmissionKeys(ctx)
	require.NoError(t, err)
	require.NotEqual(t, before, after, "revocation changes the aggregate cursor scope")
	denied.denied = false
	namespaces, err = g.Discover(ctx)
	require.NoError(t, err)
	require.Len(t, namespaces, 1)
	require.Equal(t, "restricted", namespaces[0].Namespace, "newly granted namespaces must appear without a stale negative cache")
	require.Zero(t, trap.calls, "denial must never trigger a remote fallback")
}

func TestPublishedDenialClassificationPreservesOtherFailures(t *testing.T) {
	require.True(t, purePublishedDenial(fmt.Errorf("provider: %w", identity.ErrResourceDenied)))
	for _, err := range []error{context.Canceled, identity.ErrResourceStale, identity.ErrInvalid,
		errors.Join(identity.ErrResourceDenied, errors.New("corrupt publication")),
		errors.Join(identity.ErrResourceDenied, context.Canceled)} {
		require.False(t, purePublishedDenial(err))
	}
	g, _, _, _ := publishedFixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := g.publishedAdmissionKeys(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

type invalidPublishedCapabilities struct{ *syntheticPublishedSource }

func (s invalidPublishedCapabilities) Namespaces(context.Context) ([]primitive.NamespaceCapabilities, error) {
	return []primitive.NamespaceCapabilities{{ProviderIdentity: "foreign-owner", Namespace: "restricted"}}, nil
}

func TestPublishedIntegrityFailureStillBlocksDiscovery(t *testing.T) {
	g, _, _, _ := publishedFixture(t)
	source := invalidPublishedCapabilities{&syntheticPublishedSource{}}
	require.NoError(t, g.RegisterPublishedMetadataSource(Connection{Name: "restricted", ProviderIdentity: "restricted-producer"}, []string{"restricted"}, source))
	_, err := g.Discover(context.Background())
	require.ErrorIs(t, err, identity.ErrResourceDenied, "invalid metadata is not an optional admission denial")
}

type unavailablePublishedSource struct{ *syntheticPublishedSource }

func (*unavailablePublishedSource) AdmissionKey(context.Context) (string, error) {
	return "", context.DeadlineExceeded
}

func TestScopedPublishedCatalogIgnoresUnrelatedUnavailableAdmission(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	unavailable := &unavailablePublishedSource{&syntheticPublishedSource{namespace: "unavailable", owner: "other"}}
	require.NoError(t, g.RegisterPublishedMetadataSource(Connection{Name: "unavailable", ProviderIdentity: "other"}, []string{"unavailable"}, unavailable))
	roots := g.PublishedMetadataConnections("example")
	require.Len(t, roots, 1)
	for i := 0; i < 10; i++ {
		page, err := ListPageFrom[json.RawMessage](context.Background(), g, roots, "report", CatalogQuery{Namespace: "example"}, false)
		require.NoError(t, err)
		require.Len(t, page.Items, 1)
	}
	_, err := ListPageFrom[json.RawMessage](context.Background(), g, g.PublishedMetadataConnections("unavailable"), "report", CatalogQuery{}, false)
	require.ErrorIs(t, err, context.DeadlineExceeded, "selected dependency failure keeps its cause")
	require.Zero(t, trap.calls)
}

type recoveringPublicCaller struct{ publisher *artifactcohort.Publisher }

func (c recoveringPublicCaller) Discover(context.Context) (artifactcohort.Manifest, error) {
	return c.publisher.PublicSnapshot()
}
func (c recoveringPublicCaller) Fetch(_ context.Context, input artifactcohort.FetchInput) (*artifactcohort.Artifact, error) {
	return c.publisher.FetchPublic(input)
}

func TestRealUnavailablePublicReplicaDoesNotPoisonHealthyCatalogAndRecovers(t *testing.T) {
	ctx := context.Background()
	g, _, trap, _ := publishedFixture(t)
	publisher := artifactcohort.NewPublisher()
	replica, err := artifactcohort.NewReplica(artifactcohort.Config{Enabled: true, Source: "global-owner", Tenant: "tenant", Account: "owner", Caller: recoveringPublicCaller{publisher}, Facts: deniedCohortFacts{}, SessionKey: func(context.Context) (string, error) { return "synthetic-session", nil }})
	require.NoError(t, err)
	source, err := artifactcohort.NewMetadataSource(replica, []string{"global"})
	require.NoError(t, err)
	connection := Connection{Name: "global-catalog", ProviderIdentity: "global-owner"}
	require.NoError(t, g.RegisterPublishedMetadataSource(connection, []string{"global"}, source))
	_, failure := source.AdmissionKey(ctx)
	require.ErrorIs(t, failure, artifactcohort.ErrUnavailable)
	require.ErrorIs(t, failure, ErrUnavailable)
	require.False(t, purePublishedDenial(failure))
	for i := 0; i < 10; i++ {
		page, listErr := ListPage[json.RawMessage](ctx, g, "report", CatalogQuery{}, false)
		require.NoError(t, listErr)
		require.Len(t, page.Items, 1)
	}
	_, err = ListPageFrom[json.RawMessage](ctx, g, []Connection{connection}, "style", CatalogQuery{}, false)
	require.ErrorIs(t, err, artifactcohort.ErrUnavailable)
	_, err = g.Get(ctx, connection, identity.ResourceRef{URI: "style://global/workspace"}, nil)
	require.ErrorIs(t, err, artifactcohort.ErrUnavailable)
	reader := &MCPReferenceReader{gateway: g}
	rows, supported, err := reader.filteredMCPRows(ctx, connection)
	require.NoError(t, err)
	require.True(t, supported)
	require.Empty(t, rows)
	artifact, _, err := publisher.Publish(ctx, artifactcohort.RootRef{URI: "style://global/workspace", Kind: "style", Version: 1}, json.RawMessage(`{"schemaVersion":1,"css":".surface{color:purple}"}`), func(context.Context, json.RawMessage) error { return nil })
	require.NoError(t, err)
	cohort := artifactcohort.Cohort{Tenant: "tenant", Name: "global", Public: true, Roots: []artifactcohort.RootRef{artifact.Root}}
	_, err = publisher.ReplaceCatalog(ctx, nil, []artifactcohort.Cohort{cohort}, publisher.Generation())
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	page, err := ListPageFrom[json.RawMessage](ctx, g, []Connection{connection}, "style", CatalogQuery{}, false)
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	cohort.Roots = nil
	_, err = publisher.ReplaceCatalog(ctx, nil, []artifactcohort.Cohort{cohort}, publisher.Generation())
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	page, err = ListPageFrom[json.RawMessage](ctx, g, []Connection{connection}, "style", CatalogQuery{}, false)
	require.NoError(t, err)
	require.Empty(t, page.Items)
	require.Zero(t, trap.calls)
}
