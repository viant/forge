package forgeui

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/viant/forge/backend/types"
)

var runtimeRequestPath = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$`)
var runtimeIdentityUnsafe = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func validRuntimeRequestPath(path string) bool {
	if !runtimeRequestPath.MatchString(path) {
		return false
	}
	for _, part := range strings.Split(path, ".") {
		if part == "__proto__" || part == "prototype" || part == "constructor" {
			return false
		}
	}
	return true
}

// AttachReportRuntime renders a published native report inside its ordinary
// Forge window. Call after the consumer has bound all portable datasources to
// authorized fetch routes. Dataset bindings consume those sources' collection
// signals; ordinary window fetching, refresh and revocation own their state.
// requestPaths is taken from the published backend's explicit MCPRequest
// queryPath, naming where the complete native RequestPayload must be sent.
func AttachReportRuntime(window *types.Window, report *reportspec.ReportSpec, requestPaths map[string]string) error {
	if window == nil || window.View.Content == nil {
		return fmt.Errorf("native report window content is required")
	}
	sources := map[string]bool{}
	for id := range window.DataSource {
		sources[id] = true
	}
	if err := ValidateReport(report, sources); err != nil {
		return err
	}
	for _, dataset := range report.Datasets {
		if !validRuntimeRequestPath(requestPaths[dataset.DataSourceRef]) {
			return fmt.Errorf("report datasource %q requires an explicit request path", dataset.DataSourceRef)
		}
		if window.DataSource[dataset.DataSourceRef].Service == nil {
			return fmt.Errorf("report datasource %q has no bound fetch route", dataset.DataSourceRef)
		}
	}
	data, err := json.Marshal(report)
	if err != nil {
		return err
	}
	var spec map[string]any
	if err = json.Unmarshal(data, &spec); err != nil {
		return err
	}
	bindings := map[string]any{}
	needed := map[string]bool{}
	root := window.View.Content
	ids := map[string]bool{}
	var collect func(*types.Container)
	collect = func(node *types.Container) {
		ids[node.ID] = true
		for i := range node.Containers {
			collect(&node.Containers[i])
		}
	}
	collect(root)
	unique := func(base string) string {
		candidate := base
		for i := 1; ids[candidate]; i++ {
			candidate = fmt.Sprintf("%s-%d", base, i)
		}
		ids[candidate] = true
		return candidate
	}
	for _, dataset := range report.Datasets {
		base := "portable-report-dataset-" + runtimeIdentityUnsafe.ReplaceAllString(dataset.ID, "-")
		ref := base
		for i := 1; window.DataSource[ref].Service != nil || sources[ref]; i++ {
			ref = fmt.Sprintf("%s-%d", base, i)
		}
		sources[ref] = true
		source := window.DataSource[dataset.DataSourceRef]
		source.Parameters = append([]types.Parameter(nil), source.Parameters...)
		request, err := json.Marshal(dataset.Request)
		if err != nil {
			return err
		}
		path := requestPaths[dataset.DataSourceRef]
		// The source's explicit request binding decides where the entire native
		// request is placed. Independent datasets get independent query state.
		parameters := source.Parameters[:0]
		for _, parameter := range source.Parameters {
			if parameter.Name != path {
				parameters = append(parameters, parameter)
			}
		}
		source.Parameters = append(parameters, types.Parameter{Name: path, Default: string(request), Codec: &types.Codec{Name: "json"}})
		window.DataSource[ref] = source
		bindings[dataset.ID] = map[string]any{"dataSourceRef": ref}
		needed[ref] = true
	}
	// Source-only containers trigger all dataset loads, including multi-source
	// reports. They have no visual output in the existing Forge Container path.
	refs := make([]string, 0, len(needed))
	for ref := range needed {
		refs = append(refs, ref)
	}
	sort.Strings(refs)
	for _, ref := range refs {
		root.Containers = append(root.Containers, types.Container{ID: unique("portable-report-source-" + ref), Binding: types.Binding{DataSourceRef: ref}, FetchData: true})
	}
	root.Containers = append(root.Containers, types.Container{ID: unique("portable-report-runtime"), Kind: "dashboard.reportRuntime", Title: report.Title, Dashboard: &types.Dashboard{ReportRuntime: map[string]any{"title": report.Title, "reportSpec": spec, "datasetBindings": bindings}}})
	return nil
}
