package resource

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	dssvc "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	forgeMCP "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

func selectedDependencySequence(t *testing.T) (*dependencyStack, context.Context, func() error) {
	t.Helper()
	stack := newDependencyStack(t, time.Now().UTC().Add(time.Minute))
	ctx, err := requestctx.WithResourceReadAssociation(context.Background(), stack.opened.Definition.Resource, stack.opened.Definition.ResourceTarget)
	require.NoError(t, err)
	ctx, finish, err := stack.gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	return stack, ctx, finish
}
func TestSelectedDatasourceSequenceRegistersOnlyVerifiedClosedMapping(t *testing.T) {
	stack, ctx, finish := selectedDependencySequence(t)
	pin := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	descriptor, err := stack.catalog.ResolveDatasource(ctx, pin, target, "orders")
	require.NoError(t, err)
	state := sequenceFromContext(ctx)
	require.NotNil(t, state.selection)
	require.Len(t, state.selection.resources, 2)
	raw, err := json.Marshal(descriptor)
	require.NoError(t, err)
	fingerprint, err := types.WindowDescriptorFingerprint(raw)
	require.NoError(t, err)
	admissions := 0
	require.NoError(t, RegisterDatasourceSelectionAdmission(ctx, pin, target, "orders", fingerprint, func(context.Context) error { admissions++; return nil }))
	for i := 0; i < 3; i++ {
		_, err = stack.catalog.ResolveDatasource(ctx, pin, target, "orders")
		require.NoError(t, err)
	}
	end, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, admissions)
	require.NoError(t, end())
	_, err = stack.catalog.ResolveDatasource(ctx, pin, target, "orders")
	require.NoError(t, err)
	require.NoError(t, finish())
	require.Equal(t, 2, admissions)
	_, err = stack.catalog.ResolveDatasource(ctx, pin, target, "orders")
	require.Error(t, err)
}

func TestSelectedDatasourceSequenceStopsDriftBeforeDispatchAndCannotRecover(t *testing.T) {
	for _, change := range []string{"parent-content", "child-content", "revocation", "target", "alias", "credential", "generation", "expiry", "host-admission"} {
		t.Run(change, func(t *testing.T) {
			stack, ctx, finish := selectedDependencySequence(t)
			parent := *stack.opened.Definition.Resource
			target := stack.opened.Definition.ResourceTarget
			descriptor, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			raw, err := json.Marshal(descriptor)
			require.NoError(t, err)
			fingerprint, err := types.WindowDescriptorFingerprint(raw)
			require.NoError(t, err)
			require.NoError(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fingerprint, func(context.Context) error {
				if change == "host-admission" {
					return identity.ErrResourceDenied
				}
				return nil
			}))
			switch change {
			case "parent-content":
				stack.parent.raw = append(stack.parent.raw, ' ')
				stack.parentChanged()
			case "child-content":
				stack.child.raw = append(stack.child.raw, ' ')
				stack.provider.resourceChanged()
			case "revocation":
				stack.child.denied = true
				stack.provider.resourceChanged()
			case "target":
				target.SelectionToken = "invalid-original-target"
			case "alias":
				require.Error(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "another", fingerprint, func(context.Context) error { return nil }))
			case "credential":
				ctx = authctx.WithIDToken(ctx, "foreign-credential")
			case "generation":
				stack.gateway.Invalidate("child")
			case "expiry":
				stack.child.validUntil = time.Now().Add(time.Hour)
				now := parent.ValidUntil.Add(time.Second)
				stack.gateway.Now = func() time.Time { return now }
			}
			_, err = requestctx.BeginResourceReadDispatch(ctx)
			require.Error(t, err, "drift must stop the actual backend boundary")
			require.Zero(t, sequenceFromContext(ctx).dispatchDepth)
			stack.child.denied = false
			require.Error(t, finish())
			_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.Error(t, err, "regrant cannot revive a poisoned or closed original transaction")
		})
	}
}
func TestSelectedDatasourceSequencePostDriftAndCacheReleaseUseFreshChecks(t *testing.T) {
	for _, cacheHit := range []bool{false, true} {
		t.Run(map[bool]string{false: "actual-dispatch", true: "cache-release"}[cacheHit], func(t *testing.T) {
			stack, ctx, finish := selectedDependencySequence(t)
			parent := *stack.opened.Definition.Resource
			target := stack.opened.Definition.ResourceTarget
			_, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			state := sequenceFromContext(ctx)
			if cacheHit {
				require.NoError(t, requestctx.BeginResourceReadRelease(ctx))
				require.Zero(t, state.dispatchDepth, "a cache hit must not invent execution")
			} else {
				end, err := requestctx.BeginResourceReadDispatch(ctx)
				require.NoError(t, err)
				require.NoError(t, end())
			}
			require.Equal(t, 2, state.phases)
			require.NotNil(t, state.selection)
			for _, read := range state.selection.resources {
				require.Nil(t, read.result.Resource, "POST holds only original eligibility, never a PRE body")
			}
			_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			stack.child.denied = true
			stack.provider.resourceChanged()
			require.Error(t, finish(), "changed POST resource authority prevents data release")
		})
	}
}
func TestSelectedDatasourceHostCallbackContentMutationCannotPassBarrier(t *testing.T) {
	stack, ctx, finish := selectedDependencySequence(t)
	parent := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	descriptor, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.NoError(t, err)
	raw, err := json.Marshal(descriptor)
	require.NoError(t, err)
	fp, err := types.WindowDescriptorFingerprint(raw)
	require.NoError(t, err)
	require.NoError(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fp, func(context.Context) error {
		stack.child.raw = append(stack.child.raw, ' ')
		stack.provider.resourceChanged()
		return nil
	}))
	_, err = requestctx.BeginResourceReadDispatch(ctx)
	require.Error(t, err, "fresh resources must be checked after host callbacks and before effects")
	require.Zero(t, sequenceFromContext(ctx).dispatchDepth)
	require.Error(t, finish())
}

type selectedQueryExecutor struct {
	calls     int
	arguments map[string]interface{}
}

func (e *selectedQueryExecutor) Execute(ctx context.Context, _ string, args map[string]interface{}) (string, error) {
	state := sequenceFromContext(ctx)
	state.mu.Lock()
	active, depth := state.active, state.dispatchDepth
	state.mu.Unlock()
	if active || depth != 1 {
		return "", identity.ErrResourceDenied
	}
	e.calls++
	e.arguments = args
	return `{"data":[{"orderId":1}]}`, nil
}

type selectedCacheRelease struct {
	sequence *resourceReadSequence
	before   func()
	releases int
}

func (s *selectedCacheRelease) BeforeDispatch(ctx context.Context) error {
	return s.sequence.BeforeDispatch(ctx)
}
func (s *selectedCacheRelease) AfterDispatch(ctx context.Context) error {
	return s.sequence.AfterDispatch(ctx)
}
func (s *selectedCacheRelease) BeforeRelease(ctx context.Context) error {
	s.releases++
	if s.before != nil {
		s.before()
	}
	return s.sequence.BeforeRelease(ctx)
}

func selectedToolCacheStack(t *testing.T) *dependencyStack {
	t.Helper()
	stack := newDependencyStack(t, time.Now().UTC().Add(time.Minute))
	var child struct {
		SchemaVersion int                `json:"schemaVersion"`
		DataSource    dsproto.DataSource `json:"dataSource"`
	}
	require.NoError(t, json.Unmarshal(stack.child.raw, &child))
	child.DataSource.Backend = &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "ordinary", Method: "query"}
	raw, err := json.Marshal(child)
	require.NoError(t, err)
	stack.child.raw = raw
	var envelope types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(stack.parent.raw, &envelope))
	variant := envelope.Variants[envelope.Targets[0].Variant]
	child.DataSource.ID = "orders"
	descriptor, err := json.Marshal(child.DataSource)
	require.NoError(t, err)
	variant.DataSources["orders"] = descriptor
	ref := variant.DataSourceResources["orders"]
	ref.ContentFingerprint = identity.ContentFingerprint(stack.child.raw)
	variant.DataSourceResources["orders"] = ref
	fp, err := types.WindowDescriptorFingerprint(descriptor)
	require.NoError(t, err)
	variant.Window.ResourceDependencies["orders"] = fp
	variantFP, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope.Targets[0].Variant = variantFP
	envelope.Variants = map[string]types.WindowResourceVariant{variantFP: variant}
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	stack.parent.raw = raw
	stack.parentChanged()
	stack.provider.resourceChanged()
	stack.opened, err = stack.catalog.Get(context.Background(), &forgeMCP.WindowDefinitionGetInput{WindowID: stack.parentURI})
	require.NoError(t, err)
	return stack
}
func TestSelectedDatasourceCachedRowsRequireFreshReleaseWithoutToolDispatch(t *testing.T) {
	for _, change := range []string{"stable", "source", "revocation", "expiry", "host-admission"} {
		t.Run(change, func(t *testing.T) {
			stack := selectedToolCacheStack(t)
			query := &selectedQueryExecutor{}
			var release *selectedCacheRelease
			var beforeRelease func()
			denied := false
			service := dssvc.New(dssvc.Options{Executor: query, ReadContext: ReadContext, ReadSequence: func(ctx context.Context) (context.Context, func() error, error) {
				ctx, finish, err := stack.gateway.BeginReadSequence(ctx, nil)
				if err != nil {
					return nil, nil, err
				}
				release = &selectedCacheRelease{sequence: sequenceFromContext(ctx), before: beforeRelease}
				return requestctx.WithResourceReadDispatch(ctx, release), finish, nil
			}, ResolveResource: func(ctx context.Context, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
				result, err := stack.gateway.GetForProvider(ctx, pin.ProviderIdentity, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin)
				if err != nil {
					return nil, err
				}
				return result.ResolvedResource, nil
			}, ResolveDefinition: stack.catalog.ResolveDatasource, AuthorizeDefinition: func(ctx context.Context, descriptor *dsproto.DataSource, inputs map[string]interface{}) error {
				if denied {
					return identity.ErrResourceDenied
				}
				raw, err := json.Marshal(descriptor)
				if err != nil {
					return err
				}
				fp, err := types.WindowDescriptorFingerprint(raw)
				if err != nil {
					return err
				}
				return RegisterDatasourceSelectionAdmission(ctx, *stack.opened.Definition.Resource, stack.opened.Definition.ResourceTarget, descriptor.ID, fp, func(context.Context) error {
					if denied {
						return identity.ErrResourceDenied
					}
					return nil
				})
			}})
			ctx := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "orders-user"})
			options := dssvc.FetchOptions{Resource: stack.opened.Definition.Resource, Target: stack.opened.Definition.ResourceTarget}
			inputs := map[string]interface{}{"filter": "owned"}
			rows, err := service.Fetch(ctx, "orders", inputs, options)
			require.NoError(t, err)
			require.Len(t, rows.Rows, 1)
			require.Equal(t, 1, query.calls)
			// Mutate only after the second request's initial admission has completed,
			// at the real cache release boundary rather than at a fake tool dispatch.
			beforeRelease = func() {
				switch change {
				case "source":
					stack.parent.raw = append(stack.parent.raw, ' ')
					stack.parentChanged()
				case "revocation":
					stack.child.denied = true
					stack.provider.resourceChanged()
				case "host-admission":
					denied = true
				case "expiry":
					now := options.Resource.ValidUntil.Add(time.Second)
					stack.gateway.Now = func() time.Time { return now }
				}
			}
			rows, err = service.Fetch(ctx, "orders", inputs, options)
			if change == "stable" {
				require.NoError(t, err)
				require.NotNil(t, rows.Cache)
				require.True(t, rows.Cache.Hit)
				require.Len(t, rows.Rows, 1)
				require.Equal(t, 2, release.sequence.phases)
			} else {
				require.Error(t, err)
				require.Nil(t, rows)
			}
			require.Equal(t, 1, query.calls, "cached rows must never invent another backend dispatch")
			require.Equal(t, 1, release.releases)
			require.Zero(t, release.sequence.dispatchDepth)
			require.Equal(t, map[string]interface{}{"filter": "owned"}, query.arguments, "ordinary unpaginated tool arguments remain authored")
		})
	}
}

func TestSelectedDatasourceConcurrentRegistrationAndCancellationCannotPassBarrier(t *testing.T) {
	stack, scoped, finish := selectedDependencySequence(t)
	ctx, cancel := context.WithCancel(scoped)
	defer cancel()
	parent := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	descriptor, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.NoError(t, err)
	raw, err := json.Marshal(descriptor)
	require.NoError(t, err)
	fp, err := types.WindowDescriptorFingerprint(raw)
	require.NoError(t, err)
	entered := make(chan struct{})
	release := make(chan struct{})
	require.NoError(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fp, func(ctx context.Context) error {
		close(entered)
		select {
		case <-release:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}))
	completed := make(chan error, 1)
	go func() { _, err := requestctx.BeginResourceReadDispatch(ctx); completed <- err }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("barrier did not enter selected descriptor check")
	}
	require.Error(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fp, func(context.Context) error { return nil }), "new checks cannot enter a barrier already in progress")
	cancel()
	close(release)
	select {
	case err := <-completed:
		require.Error(t, err)
	case <-time.After(time.Second):
		t.Fatal("cancelled barrier did not close")
	}
	require.Zero(t, sequenceFromContext(ctx).dispatchDepth)
	require.Error(t, finish())
	_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.Error(t, err)
}

type selectedRPCSpy struct {
	mcpclient.Interface
	mu    sync.Mutex
	calls map[string]int
}

func (s *selectedRPCSpy) SetNotificationHandler(h protoclient.Handler) {
	s.Interface.(interface{ SetNotificationHandler(protoclient.Handler) }).SetNotificationHandler(h)
}
func (s *selectedRPCSpy) CallTool(ctx context.Context, in *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	s.mu.Lock()
	s.calls[in.Name]++
	s.mu.Unlock()
	return s.Interface.CallTool(ctx, in, opts...)
}
func (s *selectedRPCSpy) count(method string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls[method]
}
func TestSelectedDatasourcePostFirstReadsFillOnlyOriginalResourceSlots(t *testing.T) {
	stack := newDependencyStack(t, time.Now().UTC().Add(time.Minute))
	parentProvider := &dependencyMCPProvider{owner: "parent-provider", items: map[string]*dependencyResource{stack.parentURI: stack.parent}}
	parentSpy := &selectedRPCSpy{Interface: parentProvider, calls: map[string]int{}}
	childSpy := &selectedRPCSpy{Interface: stack.provider, calls: map[string]int{}}
	providers := map[string]mcpclient.Interface{"parent": parentSpy, "child": childSpy}
	options := fixtureOptions{"parent": &cfg.MCPClient{PrimitiveProviderIdentity: "parent-provider"}, "child": &cfg.MCPClient{PrimitiveProviderIdentity: "child-provider"}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) { return providers[name], nil }))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	stack.gateway.Manager = mgr
	stack.gateway.Invalidate("parent")
	stack.gateway.Invalidate("child")
	parent := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	ctx, err := requestctx.WithResourceReadAssociation(context.Background(), &parent, target)
	require.NoError(t, err)
	ctx, finish, err := stack.gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	for i := 0; i < 3; i++ {
		_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
		require.NoError(t, err)
	}
	require.Equal(t, 1, parentSpy.count("windows/get"))
	require.Equal(t, 1, childSpy.count("datasources/get"))
	end, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.NoError(t, end())
	require.Equal(t, 2, parentSpy.count("windows/get"), "dispatch checks the held working selection with its owner")
	require.Equal(t, 2, childSpy.count("datasources/get"))
	child := target.DependencyPins["orders"]
	for i := 0; i < 3; i++ {
		_, _, err = stack.gateway.ResolveDatasource(ctx, child)
		require.NoError(t, err)
	}
	require.Equal(t, 3, childSpy.count("datasources/get"), "POST reads reuse only the current phase's original resource slot")
	_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.NoError(t, err)
	require.Equal(t, 3, parentSpy.count("windows/get"))
	require.Equal(t, 3, childSpy.count("datasources/get"))
	require.NoError(t, finish())
	require.Equal(t, 4, parentSpy.count("windows/get"))
	require.Equal(t, 4, childSpy.count("datasources/get"), "final release validates the current working content")
}
func TestSelectedDatasourcePostFirstReadCannotAdoptMutationOrRevocation(t *testing.T) {
	for _, change := range []string{"content", "revocation"} {
		t.Run(change, func(t *testing.T) {
			stack, ctx, finish := selectedDependencySequence(t)
			parent := *stack.opened.Definition.Resource
			target := stack.opened.Definition.ResourceTarget
			_, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			end, err := requestctx.BeginResourceReadDispatch(ctx)
			require.NoError(t, err)
			require.NoError(t, end())
			if change == "content" {
				stack.child.raw = append(stack.child.raw, ' ')
				stack.provider.resourceChanged()
			} else {
				stack.child.denied = true
				stack.provider.resourceChanged()
			}
			child := target.DependencyPins["orders"]
			descriptor, _, err := stack.gateway.ResolveDatasource(ctx, child)
			require.Error(t, err)
			require.Nil(t, descriptor)
			require.Error(t, finish())
		})
	}
}

func TestSelectedDatasourceFailedPostReadCannotRecoverAfterRegrant(t *testing.T) {
	for _, change := range []string{"content", "revocation"} {
		t.Run(change, func(t *testing.T) {
			stack, ctx, finish := selectedDependencySequence(t)
			parent := *stack.opened.Definition.Resource
			target := stack.opened.Definition.ResourceTarget
			_, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			end, err := requestctx.BeginResourceReadDispatch(ctx)
			require.NoError(t, err)
			require.NoError(t, end())
			original := append([]byte(nil), stack.child.raw...)
			if change == "content" {
				stack.child.raw = append(stack.child.raw, ' ')
				stack.provider.resourceChanged()
			} else {
				stack.child.denied = true
				stack.provider.resourceChanged()
			}
			_, _, err = stack.gateway.ResolveDatasource(ctx, target.DependencyPins["orders"])
			require.Error(t, err)
			stack.child.raw, stack.child.denied = original, false
			_, _, err = stack.gateway.ResolveDatasource(ctx, target.DependencyPins["orders"])
			require.Error(t, err, "restored authority cannot revive a failed original operation")
			require.Error(t, finish())
		})
	}
}

func TestSelectedDatasourceFinalBarrierRejectsConcurrentRegistration(t *testing.T) {
	stack, ctx, finish := selectedDependencySequence(t)
	parent := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	descriptor, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.NoError(t, err)
	raw, err := json.Marshal(descriptor)
	require.NoError(t, err)
	fingerprint, err := types.WindowDescriptorFingerprint(raw)
	require.NoError(t, err)
	entered, release := make(chan struct{}), make(chan struct{})
	require.NoError(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fingerprint, func(context.Context) error {
		close(entered)
		<-release
		return nil
	}))
	done := make(chan error, 1)
	go func() { done <- finish() }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("final barrier did not enter selected descriptor check")
	}
	registration := RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fingerprint, func(context.Context) error { return nil })
	close(release)
	require.Error(t, registration, "final barrier must detach and close callback registration")
	select {
	case err := <-done:
		require.Error(t, err)
	case <-time.After(time.Second):
		t.Fatal("final barrier did not finish")
	}
}

func TestSelectedDatasourceSnapshotsDetachReturnedMetadataAndPreserveOriginalProof(t *testing.T) {
	stack, ctx, finish := selectedDependencySequence(t)
	parent := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	_, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.NoError(t, err)
	state := sequenceFromContext(ctx)
	child := target.DependencyPins["orders"]
	connection, err := stack.gateway.ConnectionForProvider(ctx, child.ProviderIdentity)
	require.NoError(t, err)
	id := selectionResourceID(connection, child)
	original := state.originalSelection.resources[id]
	proof := &primitive.ExecutionProof{Resource: original.pin, Binding: "original-binding", Token: "original-proof"}
	original.result.ExecutionProof = proof
	state.originalSelection.resources[id] = original
	result, err := stack.gateway.Get(ctx, connection, identity.ResourceRef{URI: child.URI}, &child)
	require.NoError(t, err)
	result.Resource.Definition[0] = ' '
	result.ExecutionProof.Token = "caller-mutated"
	again, err := stack.gateway.Get(ctx, connection, identity.ResourceRef{URI: child.URI}, &child)
	require.NoError(t, err)
	require.Equal(t, "original-proof", again.ExecutionProof.Token)
	require.Equal(t, original.result.Resource.Definition, again.Resource.Definition)
	end, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.NoError(t, end())
	stack.child.validUntil = child.ValidUntil.Add(time.Hour)
	again, err = stack.gateway.Get(ctx, connection, identity.ResourceRef{URI: child.URI}, &child)
	require.NoError(t, err)
	require.Equal(t, proof, again.ExecutionProof, "POST cannot replace original provenance with a new provider proof")
	require.Equal(t, original.pin.ValidUntil, again.ResolvedResource.ValidUntil)
	require.NoError(t, finish())
}

func TestSelectedDatasourceOriginalShortProofLeaseStopsDispatchAndRelease(t *testing.T) {
	for _, boundary := range []string{"dispatch", "release"} {
		t.Run(boundary, func(t *testing.T) {
			stack, ctx, finish := selectedDependencySequence(t)
			parent := *stack.opened.Definition.Resource
			target := stack.opened.Definition.ResourceTarget
			_, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			state := sequenceFromContext(ctx)
			reads := make([]selectedResourceRead, 0, len(state.selection.resources))
			short := time.Now().Add(10 * time.Second)
			for _, read := range state.selection.resources {
				proofPin := read.pin
				proofPin.ValidUntil = short
				read.result.ExecutionProof = &primitive.ExecutionProof{Resource: proofPin, Binding: "original", Token: "original"}
				reads = append(reads, read)
			}
			variant, err := types.SelectWindowResourceWithReferences(stack.parent.raw, target)
			require.NoError(t, err)
			// Recreate the catalog registration from the same previously verified reads
			// with provider provenance, without changing any source or target pin.
			state.selection, state.originalSelection = nil, nil
			require.NoError(t, stack.catalog.registerSelectedDatasource(ctx, parent, target, "orders", variant, reads))
			require.Equal(t, short, state.lease)
			if boundary == "release" {
				end, err := requestctx.BeginResourceReadDispatch(ctx)
				require.NoError(t, err)
				require.NoError(t, end())
			}
			now := short.Add(time.Second)
			stack.gateway.Now = func() time.Time { return now }
			require.True(t, parent.ValidUntil.After(now), "resource pins are still valid")
			if boundary == "dispatch" {
				_, err = requestctx.BeginResourceReadDispatch(ctx)
				require.Error(t, err)
				require.Zero(t, state.dispatchDepth)
			}
			require.Error(t, finish(), "fresh pin leases cannot extend the original opaque proof")
		})
	}
}

func TestSelectedDatasourceRejectedAliasCannotRecoverOriginalOperation(t *testing.T) {
	stack, ctx, finish := selectedDependencySequence(t)
	parent := *stack.opened.Definition.Resource
	target := stack.opened.Definition.ResourceTarget
	_, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.NoError(t, err)
	_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "unmapped-alias")
	require.Error(t, err)
	_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
	require.Error(t, err)
	require.Error(t, finish())
}

type selectedNamespaceDrift struct {
	mcpclient.Interface
	hidden bool
}

func (p *selectedNamespaceDrift) CallTool(ctx context.Context, in *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if p.hidden && in.Name == "namespaces/get" {
		namespace, _ := in.Arguments["namespace"].(string)
		return &schema.CallToolResult{StructuredContent: primitive.NamespaceCapabilities{ProviderIdentity: "child-provider", Namespace: namespace}}, nil
	}
	return p.Interface.CallTool(ctx, in, opts...)
}
func TestSelectedDatasourceInvalidatedCatalogCannotEscapeBarrierRelease(t *testing.T) {
	for _, boundary := range []string{"dispatch", "release"} {
		t.Run(boundary, func(t *testing.T) {
			stack := newDependencyStack(t, time.Now().Add(time.Minute))
			child := &selectedNamespaceDrift{Interface: stack.provider}
			parentProvider := &dependencyMCPProvider{owner: "parent-provider", items: map[string]*dependencyResource{stack.parentURI: stack.parent}}
			clients := map[string]mcpclient.Interface{"parent": parentProvider, "child": child}
			options := fixtureOptions{"parent": &cfg.MCPClient{PrimitiveProviderIdentity: "parent-provider"}, "child": &cfg.MCPClient{PrimitiveProviderIdentity: "child-provider"}}
			mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) { return clients[name], nil }))
			require.NoError(t, err)
			t.Cleanup(func() { mgr.CloseConversation("") })
			stack.gateway.Manager = mgr
			parent := *stack.opened.Definition.Resource
			target := stack.opened.Definition.ResourceTarget
			ctx, err := requestctx.WithResourceReadAssociation(context.Background(), &parent, target)
			require.NoError(t, err)
			ctx, finish, err := stack.gateway.BeginReadSequence(ctx, nil)
			require.NoError(t, err)
			descriptor, err := stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
			require.NoError(t, err)
			raw, err := json.Marshal(descriptor)
			require.NoError(t, err)
			fingerprint, err := types.WindowDescriptorFingerprint(raw)
			require.NoError(t, err)
			mutate := boundary == "dispatch"
			require.NoError(t, RegisterDatasourceSelectionAdmission(ctx, parent, target, "orders", fingerprint, func(context.Context) error {
				if mutate {
					child.hidden = true
					stack.gateway.Invalidate("child")
				}
				return nil
			}))
			if boundary == "dispatch" {
				_, err = requestctx.BeginResourceReadDispatch(ctx)
				require.Error(t, err, "catalog mutation during admission cannot escape the effect barrier")
				require.Zero(t, sequenceFromContext(ctx).dispatchDepth)
			} else {
				end, err := requestctx.BeginResourceReadDispatch(ctx)
				require.NoError(t, err)
				require.NoError(t, end())
				_, err = stack.catalog.ResolveDatasource(ctx, parent, target, "orders")
				require.NoError(t, err)
				mutate = true
			}
			require.Error(t, finish(), "catalog mutation during admission cannot escape final row release")
		})
	}
}
