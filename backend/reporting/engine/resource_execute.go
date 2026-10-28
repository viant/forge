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
	"github.com/viant/forge/backend/provider/contract/observe"
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
	// FillOnly projects interactive preview output; it does not change dataset
	// planning, authority, or business-source dispatch. Default output is full.
	FillOnly bool `json:"fillOnly,omitempty"`
	// PrioritySectionID is an advisory presentation hint, never a datasource
	// selector. Only the admitted server definition determines section closure.
	PrioritySectionID string `json:"prioritySectionId,omitempty"`
	// DatasetFetchMode defaults to complete for backward compatibility. Page
	// returns one producer page and preserves its completeness metadata; complete
	// follows only the continuation contract declared by the approved datasource.
	DatasetPageOffsets    map[string]int                               `json:"datasetPageOffsets,omitempty"`
	DatasetFetchMode      DatasetFetchMode                             `json:"datasetFetchMode,omitempty"`
	DependencyPins        map[string]identity.ResolvedResource         `json:"dependencyPins,omitempty"`
	DependencyToken       string                                       `json:"dependencyToken,omitempty"`
	Resource              *identity.ResourceRef                        `json:"resource,omitempty"`
	ResolvedResource      *identity.ResolvedResource                   `json:"resolvedResource,omitempty"`
	Parameters            map[string]interface{}                       `json:"parameters,omitempty"`
	ChartMetricSelections map[string]materializer.ChartMetricSelection `json:"chartMetricSelections,omitempty"`
	TablePresentations    materializer.TablePresentations              `json:"tablePresentations,omitempty"`
	DatasetIDs            []string                                     `json:"datasetIds,omitempty"`
	// A non-nil table ID selects exactly one authored table from the compiled,
	// admitted ReportSpec. An empty ID is valid only for a single-table report.
	// It is mutually exclusive with caller-provided DatasetIDs.
	TableBlockID *string `json:"tableBlockId,omitempty"`
}

type DatasetFetchMode string

const (
	DatasetFetchPage     DatasetFetchMode = "page"
	DatasetFetchComplete DatasetFetchMode = "complete"
)

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

// WindowBuilderDeriver is a trusted host composition callback, not a request
// payload. It receives the admitted original window and returns an invocation-
// local envelope built from its selected container and attached bindings.
type WindowBuilderDeriver func(context.Context, identity.ResolvedResource, json.RawMessage) (registry.ReportEnvelope, error)

func (s *Service) SetResourceDatasetExecutor(execute ResourceDatasetExecutor) {
	if s != nil {
		s.resourceDatasetExecutor = execute
	}
}
func (s *Service) ExecuteResource(ctx context.Context, request *ExecuteResourceRequest) (out *ExecuteResourceResult, resultErr error) {
	return s.executeResourceScoped(ctx, request, nil)
}

func (s *Service) ExecuteWindowBuilder(ctx context.Context, request *ExecuteResourceRequest, derive WindowBuilderDeriver) (*ExecuteResourceResult, error) {
	if derive == nil {
		return nil, identity.ErrResourceDenied
	}
	return s.executeResourceScoped(ctx, request, derive)
}

func (s *Service) executeResourceScoped(ctx context.Context, request *ExecuteResourceRequest, derive WindowBuilderDeriver) (out *ExecuteResourceResult, resultErr error) {
	entryTiming := observe.Start(ctx, "report.resource.entry", observe.Labels{Kind: "report"})
	defer func() { entryTiming.End(observe.OutcomeFor(resultErr), observe.CacheUnknown) }()
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
	return s.executeResourceDefinition(ctx, request, derive)
}
func (s *Service) executeResourceUnscoped(ctx context.Context, request *ExecuteResourceRequest) (output *ExecuteResourceResult, resultErr error) {
	return s.executeResourceDefinition(ctx, request, nil)
}
func (s *Service) executeResourceDefinition(ctx context.Context, request *ExecuteResourceRequest, derive WindowBuilderDeriver) (output *ExecuteResourceResult, resultErr error) {
	totalTiming := observe.Start(ctx, "report.resource.total", observe.Labels{Kind: "report"})
	defer func() { totalTiming.End(observe.OutcomeFor(resultErr), observe.CacheUnknown) }()
	prepared := preparedReportFromContext(ctx)
	if request == nil || prepared == nil && !s.hasResourceReader() || s.resourceDatasetExecutor == nil {
		return nil, identity.ErrResourceDenied
	}
	if request.DatasetFetchMode != "" && request.DatasetFetchMode != DatasetFetchPage && request.DatasetFetchMode != DatasetFetchComplete {
		return nil, fmt.Errorf("unsupported report dataset fetch mode")
	}

	ref := identity.ResourceRef{}
	if request.Resource != nil {
		ref = *request.Resource
	} else if request.ResolvedResource != nil {
		ref = identity.ResourceRef{URI: request.ResolvedResource.URI, Revision: request.ResolvedResource.Selector()}
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || derive == nil && uri.Kind != "report" || derive != nil && uri.Kind != "window" {
		return nil, identity.ErrResourceDenied
	}
	var resolver ResourceReader
	var pin *identity.ResolvedResource
	var admittedRaw json.RawMessage
	original := cloneResolvedResource(request.ResolvedResource)
	if prepared != nil {
		pin = cloneResolvedResource(&prepared.pin)
		admittedRaw = cloneJSON(prepared.raw)
	} else {
		resolver, err = s.resourceReaderFor(ctx, "report.execute")
		if err != nil {
			return nil, err
		}
		if resolver == nil {
			return nil, identity.ErrResourceDenied
		}
		pin = cloneResolvedResource(request.ResolvedResource)
		selectTiming := observe.Start(ctx, "report.resource.select", observe.Labels{Kind: "report"})
		admittedRaw, pin, err = selectResourceRead(ctx, resolver, ref, pin)
		selectTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
		if err != nil {
			return nil, err
		}
	}
	if original == nil {
		original = cloneResolvedResource(pin)
	}
	admitted := &admittedCompileDefinition{raw: admittedRaw, pin: *pin}
	definitionRaw := admittedRaw
	if derive != nil {
		definition, e := derive(ctx, *pin, append(json.RawMessage(nil), admittedRaw...))
		if e != nil {
			return nil, e
		}
		sourceDependencies := 0
		for _, dependency := range definition.Dependencies {
			if prepared != nil {
				break
			}
			if dependency.Kind == "window" {
				sourceDependencies++
				if dependency.ID != pin.URI || dependency.ContentFingerprint != pin.ContentFingerprint {
					return nil, identity.ErrResourceDenied
				}
			}
		}
		if prepared == nil && sourceDependencies != 1 {
			return nil, identity.ErrResourceDenied
		}
		definitionRaw, err = json.Marshal(definition)
		if err != nil {
			return nil, err
		}
		admitted.windowEnvelope = definitionRaw
	}
	dependencyPins, dependencyToken := cloneDependencyPins(request.DependencyPins), request.DependencyToken
	if dependencyPins != nil && !original.ValidUntil.Equal(pin.ValidUntil) {
		var admittedDefinition registry.ReportEnvelope
		if json.Unmarshal(definitionRaw, &admittedDefinition) != nil {
			return nil, identity.ErrResourceDenied
		}
		dependencyPins, dependencyToken, err = s.bindOperationDependencies(ctx, original, pin, admittedDefinition, dependencyPins, dependencyToken)
		if err != nil {
			return nil, err
		}
	}
	admitted.pin = *pin
	compileTiming := observe.Start(ctx, "report.resource.compile", observe.Labels{Kind: "report"})
	var compiled *CompileResult
	if prepared != nil {
		invocation := *prepared
		if derive != nil {
			invocation.raw = definitionRaw
		}
		compiled, err = s.compilePreparedReport(ctx, &invocation, request.Parameters)
	} else {
		compiled, err = s.compileWithAdmitted(ctx, &CompileRequest{DependencyPins: dependencyPins, DependencyToken: dependencyToken, ResolvedResource: pin, Parameters: request.Parameters}, admitted)
	}
	compileTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	if compiled == nil || compiled.Resource == nil || compiled.Resource.URI != pin.URI || compiled.Resource.ResourceCandidate != pin.ResourceCandidate || compiled.Resource.AuthorityBinding != pin.AuthorityBinding {
		return nil, identity.ErrResourceDenied
	}
	// Compile retains the selected candidate and authority. Its original admitted
	// definition is immutable, so execution composes from those exact bytes.
	pin = cloneResolvedResource(compiled.Resource)
	raw := definitionRaw
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
		if prepared != nil {
			return ctx.Err()
		}
		if pin.Kind == identity.PublishedCandidate {
			verifier, ok := resolver.(PublishedResourceVerifier)
			if !ok {
				return identity.ErrResourceDenied
			}
			return verifier.VerifyPublishedResource(ctx, *pin)
		}
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
		if prepared != nil {
			return ctx.Err()
		}
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
	precheckTiming := observe.Start(ctx, "report.resource.precheck", observe.Labels{Kind: "report"})
	err = check()
	precheckTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	planTiming := observe.Start(ctx, "report.resource.plan", observe.Labels{Kind: "report"})
	planPending := true
	defer func() {
		if planPending {
			planTiming.End(observe.OutcomeFor(resultErr), observe.CacheUnknown)
		}
	}()
	var spec struct {
		Blocks []struct {
			ID         string `json:"id"`
			Kind       string `json:"kind"`
			DatasetRef string `json:"datasetRef"`
		} `json:"blocks"`
		Datasets []struct {
			ID             string                       `json:"id"`
			Label          string                       `json:"label"`
			DataSourceRef  string                       `json:"dataSourceRef"`
			Request        map[string]interface{}       `json:"request"`
			Rows           json.RawMessage              `json:"rows"`
			ResultContract json.RawMessage              `json:"resultContract"`
			Scope          *reportExecutionDatasetScope `json:"scope"`
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
	executionSpec := compiled.ReportSpec
	if len(request.ChartMetricSelections) > 0 {
		executionSpec, err = materializer.Present(ctx, executionSpec, request.ChartMetricSelections)
		if err != nil {
			return nil, err
		}
	}
	if decodeSpec(executionSpec, &spec) != nil || len(spec.Datasets) == 0 {
		return nil, fmt.Errorf("report has no executable datasets")
	}
	if err := materializer.ValidateTablePresentations(executionSpec, request.TablePresentations); err != nil {
		return nil, err
	}
	selectedIDs := request.DatasetIDs
	if request.TableBlockID != nil {
		if selectedIDs != nil {
			return nil, identity.ErrResourceDenied
		}
		var chosen string
		for _, block := range spec.Blocks {
			if block.Kind != "tableBlock" || *request.TableBlockID != "" && block.ID != *request.TableBlockID {
				continue
			}
			if chosen != "" || block.DatasetRef == "" {
				return nil, identity.ErrResourceDenied
			}
			chosen = block.DatasetRef
		}
		if chosen == "" {
			return nil, identity.ErrResourceDenied
		}
		selectedIDs = []string{chosen}
	}

	type plannedDataset struct {
		id             string
		descriptor     *dsproto.DataSource
		args           map[string]interface{}
		resultContract json.RawMessage
		progress       datasetProgress
	}
	plans := make([]plannedDataset, 0, len(spec.Datasets))
	progressTabs := reportProgressTabs(executionSpec)
	seen := map[string]bool{}
	var selected map[string]bool
	if selectedIDs != nil {
		if len(selectedIDs) == 0 || len(selectedIDs) > len(spec.Datasets) {
			return nil, identity.ErrResourceDenied
		}
		selected = make(map[string]bool, len(selectedIDs))
		for _, id := range selectedIDs {
			if id == "" || selected[id] {
				return nil, identity.ErrResourceDenied
			}
			selected[id] = true
		}
	}
	if len(request.DatasetPageOffsets) > 32 || len(request.DatasetPageOffsets) > 0 && request.DatasetFetchMode != DatasetFetchPage {
		return nil, fmt.Errorf("dataset offsets require bounded page execution")
	}
	var specRoot map[string]json.RawMessage
	_ = json.Unmarshal(executionSpec, &specRoot)
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
		args, err = materializer.MapBuilderRequest(ctx, envelope.BuilderDefinition, args, dataset.ID)
		if err != nil {
			return nil, err
		}
		if request.DatasetFetchMode != DatasetFetchPage && explicitReportPaging(descriptor) && descriptor.Paging.Size > 0 && descriptor.Paging.Parameters != nil && descriptor.Paging.Parameters.Size != "" {
			if descriptor.Paging.Size > maxResourceDatasetRows {
				return nil, fmt.Errorf("complete report page size exceeds row bound")
			}
			// Complete aggregation uses the authored transport batch size. The
			// preview's page limit and every non-paging input remain unchanged.
			parameter := descriptor.Paging.Parameters.Size
			if _, pinned := descriptor.Backend.Pinned[parameter]; !pinned {
				args[parameter] = descriptor.Paging.Size
			}
		}
		if offset, ok := request.DatasetPageOffsets[dataset.ID]; ok {
			if selected != nil && !selected[dataset.ID] {
				return nil, identity.ErrResourceDenied
			}
			if err := applyReportDatasetOffset(descriptor, args, offset); err != nil {
				return nil, err
			}
		}
		effectiveDatasets[index]["request"] = args
		if explicitReportPaging(descriptor) {
			// Producer tabular envelopes must be flattened before counting offset
			// progress. Materialization then consumes the canonical aggregated rows.
			effectiveDatasets[index]["resultContract"] = map[string]interface{}{"shape": "rows", "rowPath": "rows", "hasMorePath": "dataInfo.hasMore"}
		}
		if selected == nil || selected[dataset.ID] {
			plans = append(plans, plannedDataset{dataset.ID, descriptor, args, dataset.ResultContract, datasetProgress{id: dataset.ID, label: reportProgressLabel(dataset.Label, descriptor.Title, dataset.ID), source: descriptor.ID, tabs: progressTabs[dataset.ID]}})
		}
	}
	for id := range request.DatasetPageOffsets {
		if !seen[id] {
			return nil, identity.ErrResourceDenied
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
	if prepared == nil {
		if err := validateReportSpecRoot(specRoot); err != nil {
			return nil, err
		}
	}
	effectiveSpec, err := json.Marshal(specRoot)
	if err != nil {
		return nil, err
	}
	planTiming.End(observe.OK, observe.CacheUnknown)
	planPending = false
	progress := newExecutionProgress(ctx, len(plans))
	fetched := make([]*dsproto.FetchResult, len(plans))
	fetchedPayloads := make([]json.RawMessage, len(plans))
	fetchTiming := observe.Start(ctx, "report.resource.fetch", observe.Labels{Kind: "report"})
	fetchPlan := func(datasetCtx context.Context, index int) error {
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
		progress.emit("started", plan.progress)
		fetch := func(exact *dsproto.DataSource, pageArgs map[string]interface{}) (*dsproto.FetchResult, error) {
			admittedContext := context.WithValue(datasetCtx, admittedReportDefinitionKey{}, admittedReportDefinition{service: s, pin: *pin, definition: envelope})
			result, err := s.resourceDatasetExecutor(requestctx.WithResourceDependencies(requestctx.WithResolvedResource(admittedContext, *pin), *pin, compiled.DependencyPins), *pin, exact, pageArgs)
			if err != nil || !explicitReportPaging(exact) {
				return result, err
			}
			return normalizeReportPageResult(result, exact, plan.resultContract)
		}
		var result *dsproto.FetchResult
		var err error
		if request.DatasetFetchMode == DatasetFetchPage {
			result, err = fetch(plan.descriptor, plan.args)
		} else {
			result, err = fetchCompleteResourceDataset(datasetCtx, plan.descriptor, plan.args, checkPage, fetch)
		}
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
		progress.emit("completed", plan.progress)
		return nil
	}
	var section *materializer.SectionPlan
	if request.FillOnly && selectedIDs == nil && request.DatasetFetchMode != DatasetFetchPage && prepared == nil && requestctx.HasToolUpdates(ctx) {
		section = materializer.PlanInitialSection(effectiveSpec, request.PrioritySectionID)
	}
	indices := make([]int, len(plans))
	for index := range plans {
		indices[index] = index
	}
	runIndices := func(indices []int) error {
		return runReportDatasetPlans(ctx, len(indices), s.resourceDatasetConcurrency, func(datasetCtx context.Context, index int) error { return fetchPlan(datasetCtx, indices[index]) })
	}
	if section == nil {
		err = runIndices(indices)
	} else {
		first := map[string]bool{}
		for _, id := range section.DatasetIDs {
			first[id] = true
		}
		var initial, remaining []int
		for index, plan := range plans {
			if first[plan.id] {
				initial = append(initial, index)
			} else {
				remaining = append(remaining, index)
			}
		}
		err = runIndices(initial)
		if err == nil {
			payloads := map[string]json.RawMessage{}
			for _, index := range initial {
				payloads[plans[index].id] = fetchedPayloads[index]
			}
			var initialArtifacts *materializer.Artifacts
			initialArtifacts, err = materializer.MaterializeSection(ctx, section, payloads, request.TablePresentations)
			if err == nil {
				err = finalCheck()
			}
			// Drain the first wave before reusing existing POST release checks.
			// No producer work overlaps a publication transition.
			if err == nil {
				err = requestctx.CheckResourceReadPublication(ctx)
			}
			if err == nil {
				err = requestctx.EmitToolUpdate(ctx, SectionReadySnapshot{Kind: "reportSectionReady", Resource: cloneResolvedResource(pin), SectionID: section.SectionID, Sections: section.Sections, ReportSpec: cloneJSON(section.Spec), ReportFill: initialArtifacts.ReportFill})
			}
		}
		if err == nil {
			err = runIndices(remaining)
		}
	}
	fetchTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	progress.emit("materializing", datasetProgress{})
	// Publish no partial result: collect only after all admitted fetches finish.
	results := map[string]*dsproto.FetchResult{}
	payloads := map[string]json.RawMessage{}
	for index, plan := range plans {
		results[plan.id] = fetched[index]
		payloads[plan.id] = fetchedPayloads[index]
	}
	materializeTiming := observe.Start(ctx, "report.resource.materialize", observe.Labels{Kind: "report"})
	var artifacts *materializer.Artifacts
	if request.FillOnly {
		artifacts, err = materializer.MaterializePresented(ctx, effectiveSpec, payloads, request.TablePresentations, true)
	} else {
		artifacts, err = materializer.MaterializePresented(ctx, effectiveSpec, payloads, request.TablePresentations, false)
	}
	materializeTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	finalTiming := observe.Start(ctx, "report.resource.final", observe.Labels{Kind: "report"})
	err = finalCheck()
	finalTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
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
	// Compilation may already have copied global predicate values into the
	// request. Exclusion applies to those values as well as incoming aliases;
	// retain explicitly authored dataset-local values at the same paths.
	if scope != nil {
		for _, declaration := range declarations {
			if _, authoredLocal := scope.Local[declaration.ID]; authoredLocal {
				continue
			}
			for _, excluded := range scope.Exclude {
				if excluded == declaration.ID {
					removeExcludedReportParameter(args, scope.Local, declaration.Path)
					break
				}
			}
		}
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
			return nil, newReportParameterBindingError(key, allowed, declarations)
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
	if err := validateRequiredReportParameters(args, declarations, scope); err != nil {
		return nil, err
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
		service := dssvc.New(dssvc.Options{ProviderExecute: provider, ComponentDispatcher: components, Store: exactReportDatasourceStore{descriptor}, Executor: executor, DisableCache: true, AuthorizeDefinition: authorize, ResolveDefinition: publishedWindowReportResolver(ctx, pin, descriptor)})
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
