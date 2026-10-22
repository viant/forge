package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"

	dssvc "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/viant/forge/backend/reporting/registry"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

// admittedReportDefinition is scoped to one execution, never shared or cached.
// Dataset admission compares against the exact immutable envelope already read
// under report.execute; the provider still admits every dispatched tool call.
type admittedReportDefinitionKey struct{}
type admittedReportDefinition struct {
	service    *Service
	pin        identity.ResolvedResource
	definition registry.ReportEnvelope
}

type ExecuteResourceRequest struct {
	DependencyPins   map[string]identity.ResolvedResource `json:"dependencyPins,omitempty"`
	DependencyToken  string                               `json:"dependencyToken,omitempty"`
	Resource         *identity.ResourceRef                `json:"resource,omitempty"`
	ResolvedResource *identity.ResolvedResource           `json:"resolvedResource,omitempty"`
	Parameters       map[string]interface{}               `json:"parameters,omitempty"`
	DatasetIDs       []string                             `json:"datasetIds,omitempty"`
}
type ExecuteResourceResult struct {
	DependencyPins  map[string]identity.ResolvedResource `json:"dependencyPins,omitempty"`
	DependencyToken string                               `json:"dependencyToken,omitempty"`
	Resource        *identity.ResolvedResource           `json:"resource"`
	ReportSpec      json.RawMessage                      `json:"reportSpec"`
	ReportFill      json.RawMessage                      `json:"reportFill"`
	ReportPrint     json.RawMessage                      `json:"reportPrint"`
	Datasets        map[string]*dsproto.FetchResult      `json:"datasets"`
}

// ResourceDatasetExecutor receives only the exact datasource descriptor from
// an approved report envelope. The callback retains the caller's identity and
// performs ordinary datasource/tool admission; it cannot choose another source.
type ResourceDatasetExecutor func(context.Context, identity.ResolvedResource, *dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error)

func (s *Service) SetResourceDatasetExecutor(execute ResourceDatasetExecutor) {
	if s != nil {
		s.resourceDatasetExecutor = execute
	}
}
func (s *Service) ExecuteResource(ctx context.Context, request *ExecuteResourceRequest) (out *ExecuteResourceResult, resultErr error) {
	if s != nil && s.reportCatalog != nil && s.hasResourceReader() {
		scoped, finish, err := s.reportCatalog.MetadataRead(ctx)
		if err != nil {
			return nil, err
		}
		if scoped == nil || finish == nil {
			return nil, identity.ErrResourceDenied
		}
		defer func() {
			if err := finish(); err != nil {
				out = nil
				resultErr = errors.Join(resultErr, err)
			}
		}()
		ctx = scoped
	}
	return s.executeResourceUnscoped(ctx, request)
}
func (s *Service) executeResourceUnscoped(ctx context.Context, request *ExecuteResourceRequest) (*ExecuteResourceResult, error) {
	if request == nil || !s.hasResourceReader() || s.resourceDatasetExecutor == nil {
		return nil, identity.ErrResourceDenied
	}

	ref := identity.ResourceRef{}
	if request.Resource != nil {
		ref = *request.Resource
	} else if request.ResolvedResource != nil {
		ref = identity.ResourceRef{URI: request.ResolvedResource.URI, Revision: request.ResolvedResource.Selector()}
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "report" {
		return nil, identity.ErrResourceDenied
	}
	resolver, err := s.resourceReaderFor(ctx, "report.execute")
	if err != nil {
		return nil, err
	}
	if resolver == nil {
		return nil, identity.ErrResourceDenied
	}
	pin := cloneResolvedResource(request.ResolvedResource)
	// Select and deliver through one admitted read; no discarded definition.
	original := cloneResolvedResource(pin)
	admittedRaw, pin, err := selectResourceRead(ctx, resolver, ref, pin)
	if err != nil {
		return nil, err
	}
	if original == nil {
		original = cloneResolvedResource(pin)
	}
	dependencyPins, dependencyToken := cloneDependencyPins(request.DependencyPins), request.DependencyToken
	if dependencyPins != nil && !original.ValidUntil.Equal(pin.ValidUntil) {
		var admittedDefinition registry.ReportEnvelope
		if json.Unmarshal(admittedRaw, &admittedDefinition) != nil {
			return nil, identity.ErrResourceDenied
		}
		dependencyPins, dependencyToken, err = s.bindOperationDependencies(ctx, original, pin, admittedDefinition, dependencyPins, dependencyToken)
		if err != nil {
			return nil, err
		}
	}
	compiled, err := s.Compile(ctx, &CompileRequest{DependencyPins: dependencyPins, DependencyToken: dependencyToken, ResolvedResource: pin})
	if err != nil {
		return nil, err
	}
	if compiled == nil || compiled.Resource == nil || compiled.Resource.URI != pin.URI || compiled.Resource.ResourceCandidate != pin.ResourceCandidate || compiled.Resource.AuthorityBinding != pin.AuthorityBinding {
		return nil, identity.ErrResourceDenied
	}
	// Compile retains the selected candidate and authority. Its original admitted
	// definition is immutable, so execution composes from those exact bytes.
	pin = cloneResolvedResource(compiled.Resource)
	raw := admittedRaw
	var envelope registry.ReportEnvelope
	if json.Unmarshal(raw, &envelope) != nil || len(envelope.DataSources) == 0 {
		return nil, fmt.Errorf("report execution requires trusted datasource descriptors")
	}
	if !compiled.Resource.ValidUntil.Equal(pin.ValidUntil) {
		compiled.DependencyPins, compiled.DependencyToken, err = s.bindOperationDependencies(ctx, compiled.Resource, pin, envelope, compiled.DependencyPins, compiled.DependencyToken)
		if err != nil {
			return nil, err
		}
	}
	finalCheck := func() error {
		original := cloneResolvedResource(pin)
		_, fresh, e := resolver.ReadResolved(ctx, *pin)
		if e != nil {
			return e
		}
		if fresh == nil || fresh.URI != original.URI || fresh.ProviderIdentity != original.ProviderIdentity || fresh.ResourceCandidate != original.ResourceCandidate || fresh.AuthorityBinding != original.AuthorityBinding || identity.MetadataExpiryExtends(fresh.ValidUntil, original.ValidUntil) {
			return identity.ErrResourceDenied
		}
		if !fresh.ValidUntil.Equal(original.ValidUntil) {
			compiled.DependencyPins, compiled.DependencyToken, e = s.bindOperationDependencies(ctx, original, fresh, envelope, compiled.DependencyPins, compiled.DependencyToken)
			if e != nil {
				return e
			}
			pin = fresh
			return nil // The narrowing helper already revalidated original children.
		}
		pin = fresh
		return s.verifyDependencies(ctx, *pin, envelope, compiled.DependencyPins, compiled.DependencyToken)
	}
	check := func() error {
		if ctx.Err() != nil || !identity.MetadataExpiryValid(pin.ValidUntil, s.now()) {
			return identity.ErrResourceDenied
		}
		// Page dispatch uses the already admitted immutable definition and original
		// dependency pins. Managing MCP authorizes every data call; all original
		// children are freshly revalidated at the final publication barrier.
		return nil
	}
	// Compile has already revalidated the complete original child mapping;
	// publication revalidates it again after all managing-MCP data dispatch.
	if err = check(); err != nil {
		return nil, err
	}
	var spec struct {
		Datasets []struct {
			ID            string                       `json:"id"`
			DataSourceRef string                       `json:"dataSourceRef"`
			Request       map[string]interface{}       `json:"request"`
			Rows          json.RawMessage              `json:"rows"`
			Scope         *reportExecutionDatasetScope `json:"scope"`
		} `json:"datasets"`
	}
	decodeSpec := json.Unmarshal
	for _, rawDescriptor := range envelope.DataSources {
		var candidate dsproto.DataSource
		if decodeReportDatasource(rawDescriptor, &candidate) == nil && explicitReportPaging(&candidate) {
			decodeSpec = decodeReportPagingJSON
			break
		}
	}
	if decodeSpec(compiled.ReportSpec, &spec) != nil || len(spec.Datasets) == 0 {
		return nil, fmt.Errorf("report has no executable datasets")
	}

	type plannedDataset struct {
		id         string
		descriptor *dsproto.DataSource
		args       map[string]interface{}
	}
	plans := make([]plannedDataset, 0, len(spec.Datasets))
	seen := map[string]bool{}
	var selected map[string]bool
	if request.DatasetIDs != nil {
		if len(request.DatasetIDs) == 0 || len(request.DatasetIDs) > len(spec.Datasets) {
			return nil, identity.ErrResourceDenied
		}
		selected = make(map[string]bool, len(request.DatasetIDs))
		for _, id := range request.DatasetIDs {
			if id == "" || selected[id] {
				return nil, identity.ErrResourceDenied
			}
			selected[id] = true
		}
	}
	var specRoot map[string]json.RawMessage
	_ = json.Unmarshal(compiled.ReportSpec, &specRoot)
	var effectiveDatasets []map[string]interface{}
	if json.Unmarshal(specRoot["datasets"], &effectiveDatasets) != nil {
		return nil, identity.ErrResourceDenied
	}
	for index, dataset := range spec.Datasets {
		if dataset.ID == "" || seen[dataset.ID] || dataset.DataSourceRef == "" || len(dataset.Rows) != 0 {
			return nil, fmt.Errorf("report execution dataset identity invalid")
		}
		seen[dataset.ID] = true
		descriptorRaw := envelope.DataSources[dataset.DataSourceRef]
		descriptor := new(dsproto.DataSource)
		if len(descriptorRaw) == 0 || decodeReportDatasource(descriptorRaw, descriptor) != nil || descriptor.ID != dataset.DataSourceRef || descriptor.Backend == nil {
			return nil, identity.ErrResourceDenied
		}
		args, err := reportDatasetArguments(dataset.Request, request.Parameters, descriptor, envelope.BuilderDefinition, dataset.Scope)
		if err != nil {
			return nil, err
		}
		effectiveDatasets[index]["request"] = args
		if selected == nil || selected[dataset.ID] {
			plans = append(plans, plannedDataset{dataset.ID, descriptor, args})
		}
	}
	// Plans and effectiveDatasets share the bound argument maps. Resolve only
	// comparison dates again after newly submitted aliases have been bound.
	if err := applyReportPreviousPeriods(effectiveDatasets); err != nil {
		return nil, err
	}
	if selected != nil && len(plans) != len(selected) {
		return nil, identity.ErrResourceDenied
	}
	specRoot["datasets"], err = json.Marshal(effectiveDatasets)
	if err != nil {
		return nil, err
	}
	if err := validateReportSpecRoot(specRoot); err != nil {
		return nil, err
	}
	effectiveSpec, err := json.Marshal(specRoot)
	if err != nil {
		return nil, err
	}
	fetched := make([]*dsproto.FetchResult, len(plans))
	fetchedPayloads := make([]json.RawMessage, len(plans))
	err = runReportDatasetPlans(ctx, len(plans), s.resourceDatasetConcurrency, func(datasetCtx context.Context, index int) error {
		plan := plans[index]
		checkPage := func() error {
			if err := datasetCtx.Err(); err != nil {
				return err
			}
			return check()
		}
		if err := checkPage(); err != nil {
			return err
		}
		result, err := fetchCompleteResourceDataset(datasetCtx, plan.descriptor, plan.args, checkPage, func(exact *dsproto.DataSource, pageArgs map[string]interface{}) (*dsproto.FetchResult, error) {
			admittedContext := context.WithValue(datasetCtx, admittedReportDefinitionKey{}, admittedReportDefinition{service: s, pin: *pin, definition: envelope})
			return s.resourceDatasetExecutor(requestctx.WithResourceDependencies(requestctx.WithResolvedResource(admittedContext, *pin), *pin, compiled.DependencyPins), *pin, exact, pageArgs)
		})
		if err != nil {
			return err
		}
		if result == nil {
			return fmt.Errorf("report datasource returned no result")
		}
		if err := checkPage(); err != nil {
			return err
		}
		payload, err := json.Marshal(result)
		if err != nil {
			return err
		}
		fetched[index], fetchedPayloads[index] = result, payload
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Publish no partial result: collect only after all admitted fetches finish.
	results := map[string]*dsproto.FetchResult{}
	payloads := map[string]json.RawMessage{}
	for index, plan := range plans {
		results[plan.id] = fetched[index]
		payloads[plan.id] = fetchedPayloads[index]
	}
	artifacts, err := materializer.Materialize(ctx, effectiveSpec, payloads)
	if err != nil {
		return nil, err
	}
	if err = finalCheck(); err != nil {
		return nil, err
	}
	return &ExecuteResourceResult{DependencyPins: cloneDependencyPins(compiled.DependencyPins), DependencyToken: compiled.DependencyToken, Resource: cloneResolvedResource(pin), ReportSpec: cloneJSON(effectiveSpec), ReportFill: artifacts.ReportFill, ReportPrint: artifacts.ReportPrint, Datasets: results}, nil
}
func reportDatasetArguments(base, parameters map[string]interface{}, descriptor *dsproto.DataSource, builderRaw json.RawMessage, scope *reportExecutionDatasetScope) (map[string]interface{}, error) {
	raw, err := json.Marshal(base)
	if err != nil {
		return nil, err
	}
	args := map[string]interface{}{}
	if len(raw) > 0 && string(raw) != "null" {
		decode := json.Unmarshal
		if explicitReportPaging(descriptor) {
			decode = decodeReportPagingJSON
		}
		if decode(raw, &args) != nil {
			return nil, identity.ErrResourceDenied
		}
	}
	allowed := map[string]bool{}
	for key := range base {
		allowed[key] = true
	}
	declarations, err := reportParameterDeclarations(builderRaw)
	if err != nil {
		return nil, err
	}
	for _, p := range descriptor.Parameters {
		if p.Name != "" {
			allowed[p.Name] = true
		}
	}
	assigned := map[string]interface{}{}
	for key, value := range parameters {
		if strings.HasPrefix(key, "_") || key == "backend" || key == "source" || key == "service" || key == "method" || key == "filters" || key == "options" {
			return nil, fmt.Errorf("report parameter not admitted by trusted schema")
		}
		if declaration, ok := declarations[key]; ok {
			if scope.preserves(declaration) {
				continue
			}
			if declaration.Multiple {
				switch value.(type) {
				case []interface{}:
				default:
					value = []interface{}{value}
				}
			}
			if old, exists := assigned[declaration.Path]; exists && !reflect.DeepEqual(old, value) {
				return nil, fmt.Errorf("conflicting report parameter aliases")
			}
			assigned[declaration.Path] = value
			if err := setReportParameterPath(args, declaration.Path, value); err != nil {
				return nil, err
			}
			continue
		}
		if strings.HasPrefix(key, "_") || key == "backend" || key == "source" || key == "service" || key == "method" || !allowed[key] {
			return nil, fmt.Errorf("report parameter %q not declared by approved datasource", key)
		}
		if current, exists := args[key]; exists {
			if old, ok := current.(map[string]interface{}); ok {
				next, ok := value.(map[string]interface{})
				if !ok {
					return nil, identity.ErrResourceDenied
				}
				for field, newValue := range next {
					oldValue, exists := old[field]
					if !exists || !reflect.DeepEqual(oldValue, newValue) {
						return nil, fmt.Errorf("report parameter widens compiled selection")
					}
				}
			}
		}
		args[key] = value
	}
	return args, nil
}

type exactReportDatasourceStore struct{ definition *dsproto.DataSource }

func (s exactReportDatasourceStore) Get(id string) (*dsproto.DataSource, bool) {
	return s.definition, id == s.definition.ID
}

// NewResourceDatasetExecutor uses Core's real datasource pipeline and MCP
// registry. The report service already revalidates its exact resource around
// dispatch; authorize supplies the host's ordinary input/entity admission.
func NewResourceDatasetExecutor(executor dssvc.ToolExecutor, authorize dssvc.DefinitionAuthorizer, dispatchers ...windowprotocol.ComponentDispatcher) ResourceDatasetExecutor {
	return NewResourceDatasetExecutorWithProvider(executor, authorize, nil, dispatchers...)
}

// NewResourceDatasetExecutorWithProvider adds the same exact provider datasource
// dispatch used by window/standalone consumers; existing inline/MCP paths remain.
func NewResourceDatasetExecutorWithProvider(executor dssvc.ToolExecutor, authorize dssvc.DefinitionAuthorizer, provider dssvc.ProviderExecutor, dispatchers ...windowprotocol.ComponentDispatcher) ResourceDatasetExecutor {
	var components windowprotocol.ComponentDispatcher
	if len(dispatchers) > 0 {
		components = dispatchers[0]
	}
	return func(ctx context.Context, pin identity.ResolvedResource, descriptor *dsproto.DataSource, inputs map[string]interface{}) (*dsproto.FetchResult, error) {
		if executor == nil && components == nil && provider == nil || authorize == nil {
			return nil, identity.ErrResourceDenied
		}
		service := dssvc.New(dssvc.Options{ProviderExecute: provider, ComponentDispatcher: components, Store: exactReportDatasourceStore{descriptor}, Executor: executor, DisableCache: true, AuthorizeDefinition: authorize})
		return service.Fetch(requestctx.WithResolvedResource(ctx, pin), descriptor.ID, inputs, dssvc.FetchOptions{BypassCache: true})
	}
}
func (s *Service) AuthorizeResourceDataset(ctx context.Context, descriptor *dsproto.DataSource, _ map[string]interface{}) error {
	pin, ok := requestctx.ResolvedResourceFromContext(ctx)
	if !ok || descriptor == nil || !s.hasResourceReader() {
		return identity.ErrResourceDenied
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(pin.ValidUntil, s.now()) {
		return identity.ErrResourceDenied
	}
	var e registry.ReportEnvelope
	if admitted, found := ctx.Value(admittedReportDefinitionKey{}).(admittedReportDefinition); found {
		if admitted.service != s || admitted.pin != *pin {
			return identity.ErrResourceDenied
		}
		e = admitted.definition
	} else {
		resolver, err := s.resourceReaderFor(ctx, "report.execute")
		if err != nil {
			return err
		}
		if resolver == nil {
			return identity.ErrResourceDenied
		}
		raw, fresh, err := resolver.ReadResolved(ctx, *pin)
		if err != nil {
			return err
		}
		// This error-only callback cannot hand the caller a narrower replacement
		// pin. Abort this fetch when a shorter grant is observed; a later regrant
		// must not restore the previous lease and release this operation's rows.
		if fresh == nil || !fresh.ValidUntil.Equal(pin.ValidUntil) {
			return identity.ErrResourceDenied
		}
		if json.Unmarshal(raw, &e) != nil {
			return identity.ErrResourceDenied
		}
	}
	expectedRaw := e.DataSources[descriptor.ID]
	var expected dsproto.DataSource
	if len(expectedRaw) == 0 || decodeReportDatasource(expectedRaw, &expected) != nil {
		return identity.ErrResourceDenied
	}
	if !reflect.DeepEqual(&expected, descriptor) {
		return identity.ErrResourceDenied
	}
	return nil
}
