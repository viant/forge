package reporting

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type unverifiedPublishedReader struct{ pin identity.ResolvedResource }

func (r unverifiedPublishedReader) Resolve(context.Context, identity.ResourceRef) (*identity.ResolvedResource, error) {
	pin := r.pin
	return &pin, nil
}
func (r unverifiedPublishedReader) ReadResolved(context.Context, identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	pin := r.pin
	return json.RawMessage(`{"schemaVersion":1,"reportSpec":{}}`), &pin, nil
}
func TestPublishedCandidateRequiresTrustedReaderVerifier(t *testing.T) {
	service := New(Options{Compiler: NewReportSpecCompiler(nil)})
	reader := unverifiedPublishedReader{pin: identity.ResolvedResource{ProviderIdentity: "publisher", URI: "report://example/summary", ResourceCandidate: identity.ResourceCandidate{Kind: identity.PublishedCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("root"))}, AuthorityBinding: "session", ValidUntil: time.Now().Add(time.Minute)}}
	service.SetResourceReaderFactory(func(context.Context, string) (ResourceReader, error) { return reader, nil })
	_, err := service.Compile(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: reader.pin.URI}})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	_, err = service.ExecutePreparedReport(context.Background(), &PreparedReport{pin: reader.pin}, &ExecuteResourceRequest{})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}
func TestPublishedClosureRejectsChildPinsAndKeepsOrdinaryDependencyAdmission(t *testing.T) {
	service := New(Options{})
	called := 0
	proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	service.SetResourceDependencies(func(context.Context, identity.ResolvedResource, map[string]primitive.DataSourceReference, map[string]json.RawMessage, map[string]identity.ResolvedResource) (map[string]identity.ResolvedResource, error) {
		called++
		return nil, identity.ErrResourceDenied
	}, proof)
	parent := identity.ResolvedResource{URI: "report://example/summary", ResourceCandidate: identity.ResourceCandidate{Kind: identity.PublishedCandidate}}
	definition := registry.ReportEnvelope{DataSourceResources: map[string]primitive.DataSourceReference{"rows": {Resource: identity.ResourceRef{URI: "datasource://example/rows"}}}}
	pins, token, err := service.bindDependencies(context.Background(), &parent, definition, nil, "")
	require.NoError(t, err)
	require.Empty(t, pins)
	require.Empty(t, token)
	require.Zero(t, called)
	_, _, err = service.bindDependencies(context.Background(), &parent, definition, map[string]identity.ResolvedResource{"rows": {}}, "")
	require.Error(t, err)
	_, _, err = service.bindDependencies(context.Background(), &parent, definition, nil, "browser-token")
	require.Error(t, err)
	require.Zero(t, called)
	parent.Kind = identity.WorkingCandidate
	_, _, err = service.bindDependencies(context.Background(), &parent, definition, nil, "")
	require.Error(t, err)
	require.Equal(t, 1, called, "ordinary reports retain separate dependency admission")
}

func TestPublishedWindowDescriptorResolverRequiresPrivateMatchingAdmission(t *testing.T) {
	pin := identity.ResolvedResource{URI: "window://example/builder", ResourceCandidate: identity.ResourceCandidate{Kind: identity.PublishedCandidate}}
	descriptor := &dsproto.DataSource{ID: "rows"}
	require.Nil(t, publishedWindowReportResolver(context.Background(), pin, descriptor))
	service := New(Options{})
	ctx := context.WithValue(context.Background(), admittedReportDefinitionKey{}, admittedReportDefinition{service: service, pin: pin})
	resolver := publishedWindowReportResolver(ctx, pin, descriptor)
	require.NotNil(t, resolver)
	selected, err := resolver(ctx, pin, nil, "rows")
	require.NoError(t, err)
	require.Same(t, descriptor, selected)
	_, err = resolver(context.Background(), pin, nil, "rows")
	require.Error(t, err)
	_, err = resolver(ctx, pin, nil, "other")
	require.Error(t, err)
	forged := pin
	forged.AuthorityBinding = "other"
	_, err = resolver(ctx, forged, nil, "rows")
	require.Error(t, err)
}
