package uimetadata

import (
	"encoding/json"
	"fmt"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
	"testing"
)

func definition(t *testing.T, raw string) *types.Window {
	t.Helper()
	var w types.Window
	if err := json.Unmarshal([]byte(raw), &w); err != nil {
		t.Fatal(err)
	}
	return &w
}
func find(t *testing.T, page *Page, id string) Node {
	t.Helper()
	for i := len(page.Nodes) - 1; i >= 0; i-- {
		n := page.Nodes[i]
		if n.ID == id {
			return n
		}
	}
	t.Fatalf("missing %s in %+v", id, page.Nodes)
	return Node{}
}
func TestNestedHierarchySchemaOptionsAndNoExecution(t *testing.T) {
	w := definition(t, `{"windowKey":"records","title":"Records","actions":{"code":"throw new Error('DO NOT RUN')"},"dataSource":{"detail":{"resourceModelRef":"entry","backend":{"credentials":"PRIVATE_BACKEND"}}},"resourceModels":{"entry":{"schemaRef":"entrySchema","read":{"dataSourceRef":"detail"}}},"schemas":{"entrySchema":{"type":"object","required":["name"],"properties":{"name":{"type":"string","maxLength":30},"secretCode":{"type":"string","writeOnly":true}}}},"view":{"content":{"id":"workspace","tabs":{},"containers":[{"id":"properties","title":"Properties","dataSourceRef":"detail","draftForm":{"dataSourceRef":"detail","saveLabel":"Save","submit":{"dataSourceRef":"writer","payload":{"PRIVATE":"do not publish"}}},"items":[{"id":"name","label":"Name","type":"input","dataField":"name","value":"PRIVATE_LIVE_VALUE","disabledWhen":{"source":"authorization","field":"write","equals":false}},{"id":"country","type":"select","optionsDataSourceRef":"countries","options":[{"label":"Stale","value":"DO_NOT_CLAIM_LOADED"}]}],"containers":[{"id":"nested","title":"Nested","tabs":{},"containers":[{"id":"advanced","title":"Advanced"}]}]}]}}}`)
	before, _ := json.Marshal(w)
	page, err := Project(w, Query{ID: "properties", MaxNodes: 100})
	if err != nil {
		t.Fatal(err)
	}
	tab := find(t, page, "properties")
	if tab.Kind != "tab" {
		t.Fatalf("not tab: %+v", tab)
	}
	nested := find(t, page, "advanced")
	if nested.Kind != "tab" || nested.ParentPath == "" {
		t.Fatalf("nested hierarchy missing: %+v", nested)
	}
	name := find(t, page, "name")
	if name.DataType != "string" || name.Constraints["maxLength"] != 30 || name.Constraints["required"] != true || name.Availability != "unknown" || len(name.Conditional) != 1 {
		t.Fatalf("field contract: %+v", name)
	}
	country := find(t, page, "country")
	if country.Options == nil || country.Options.Loaded || country.Options.Source != "countries" || len(country.Options.Items) != 0 {
		t.Fatalf("dynamic options fetched/claimed: %+v", country)
	}
	serialized, _ := json.Marshal(page)
	for _, private := range []string{"PRIVATE_BACKEND", "PRIVATE_LIVE_VALUE", "DO_NOT_CLAIM_LOADED", "DO NOT RUN", "writer", "payload"} {
		if strings.Contains(string(serialized), private) {
			t.Fatal("leaked " + private)
		}
	}
	after, _ := json.Marshal(w)
	if string(before) != string(after) {
		t.Fatal("mutated selected definition")
	}
}
func TestPagingBoundsCursorAndScope(t *testing.T) {
	w := &types.Window{WindowKey: "test", View: types.View{Content: &types.Container{ID: "root"}}}
	for i := 0; i < 160; i++ {
		w.View.Content.Items = append(w.View.Content.Items, types.Item{ID: "field" + string(rune(i+100)), Label: strings.Repeat("x", 1000)})
	}
	first, err := Project(w, Query{MaxNodes: 12})
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Nodes) != 12 || first.NextCursor == "" {
		t.Fatalf("unbounded page %+v", first)
	}
	second, err := Project(w, Query{MaxNodes: 12, Cursor: first.NextCursor})
	if err != nil || second.Nodes[0].Path == first.Nodes[0].Path {
		t.Fatal("cursor did not advance", err)
	}
	if _, err = Project(w, Query{ID: "root", Cursor: first.NextCursor}); err == nil {
		t.Fatal("cross-scope cursor accepted")
	}
	w.View.Content.Title = "Changed"
	if _, err = Project(w, Query{Cursor: first.NextCursor}); err == nil {
		t.Fatal("stale cursor accepted")
	}
	for _, q := range []Query{{MaxNodes: 101}, {MaxNodes: -1}, {Path: "../private"}, {Path: "view/%2e%2e"}, {Path: "/etc/passwd"}, {Path: "view\\private"}, {Path: "view", ID: "root"}, {Cursor: "invalid"}} {
		if _, err = Project(w, q); err == nil {
			t.Fatalf("accepted bad query %+v", q)
		}
	}
}
func TestStaticOptionsSensitiveRedactionAndHardBudget(t *testing.T) {
	w := definition(t, `{"view":{"content":{"id":"root","items":[{"id":"api_token","type":"password","value":"VERY_SECRET","options":[{"value":"PRIVATE_OPTION"}]},{"id":"choice","options":[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}]}]}}}`)
	page, err := Project(w, Query{})
	if err != nil {
		t.Fatal(err)
	}
	secret := find(t, page, "api_token")
	if !secret.Sensitive || secret.Options != nil {
		t.Fatal("sensitive control not redacted")
	}
	options := find(t, page, "choice").Options
	if options == nil || !options.Loaded || len(options.Items) != 2 {
		t.Fatal("static option projection invalid")
	}
	w.View.Content.Items = nil
	for i := 0; i < 100; i++ {
		options := []types.Option{}
		for j := 0; j < 30; j++ {
			options = append(options, types.Option{Label: strings.Repeat("L", 500), Value: strings.Repeat("V", 500)})
		}
		w.View.Content.Items = append(w.View.Content.Items, types.Item{ID: "large", Options: options})
	}
	page, err = Project(w, Query{MaxNodes: 100})
	if err != nil {
		t.Fatal(err)
	}
	bytes, _ := json.Marshal(page)
	if len(bytes) > MaxPageBytes+2048 || page.NextCursor == "" {
		t.Fatalf("response unbounded: %d", len(bytes))
	}
	if !find(t, page, "large").Options.Truncated {
		t.Fatal("options were not bounded")
	}
}
func TestDuplicateIDAndScanTruncation(t *testing.T) {
	w := &types.Window{View: types.View{Content: &types.Container{ID: "root", Items: []types.Item{{ID: "duplicate"}, {ID: "duplicate"}}}}}
	if _, err := Project(w, Query{ID: "duplicate"}); err == nil {
		t.Fatal("ambiguous id accepted")
	}
	for i := 0; i < MaxScan+1; i++ {
		w.View.Content.Items = append(w.View.Content.Items, types.Item{ID: "many"})
	}
	page, err := Project(w, Query{MaxNodes: 1})
	if err != nil || !page.Truncated {
		t.Fatalf("scan coverage not explicit %v", err)
	}
}

func TestInitializationParametersAreDeclarationsWithoutPrivateDefaults(t *testing.T) {
	w := definition(t, `{"windowKey":"record","parameters":[{"name":"RecordId","type":"int[]","required":true,"default":"PRIVATE_DEFAULT","bindTo":"PRIVATE_BACKEND_BINDING"}],"view":{"content":{"id":"root"}}}`)
	page, err := Project(w, Query{Path: "parameters/0"})
	if err != nil {
		t.Fatal(err)
	}
	n := find(t, page, "RecordId")
	if n.Kind != "parameter" || n.DataType != "int[]" || n.Constraints["required"] != true {
		t.Fatalf("initialization contract lost %+v", n)
	}
	bytes, _ := json.Marshal(page)
	if strings.Contains(string(bytes), "PRIVATE_") {
		t.Fatal("private parameter default or backend binding leaked")
	}
}
func TestPublicTargetDropsAllRuntimeProofs(t *testing.T) {
	target := &types.WindowTarget{Platform: "web", FormFactor: "desktop", SelectionToken: "PRIVATE_SELECTION", DependencyPins: map[string]identity.ResolvedResource{"private": {AuthorityBinding: "PRIVATE_PIN"}}}
	public := PublicTarget(target)
	bytes, _ := json.Marshal(public)
	if strings.Contains(string(bytes), "PRIVATE_") || strings.Contains(string(bytes), "selectionToken") {
		t.Fatal("runtime proof leaked")
	}
	copy := public.WindowTarget()
	if copy.SelectionToken != "" || len(copy.DependencyPins) != 0 || copy.ExecutionProof != nil || copy.Platform != "web" {
		t.Fatal("public target reconstructed private authority")
	}
}

func TestCursorUsesSelectedResourceButNotRotatingRuntimeProofs(t *testing.T) {
	w := &types.Window{WindowKey: "sharedRenderer", Resource: &identity.ResolvedResource{URI: "window://team/one", ResourceCandidate: identity.ResourceCandidate{ContentFingerprint: strings.Repeat("a", 64)}}, ResourceTarget: &types.WindowTarget{Platform: "web", SelectionToken: "old-proof"}, View: types.View{Content: &types.Container{ID: "root", Items: []types.Item{{ID: "child"}}}}}
	first, err := Project(w, Query{MaxNodes: 1})
	if err != nil || first.NextCursor == "" {
		t.Fatal("initial cursor missing", err)
	}
	w.ResourceTarget.SelectionToken = "fresh-proof"
	if _, err = Project(w, Query{Cursor: first.NextCursor}); err != nil {
		t.Fatal("runtime proof rotation invalidated content cursor", err)
	}
	w.Resource.URI = "window://team/two"
	if _, err = Project(w, Query{Cursor: first.NextCursor}); err == nil {
		t.Fatal("cursor crossed resource identity")
	}
	w.Resource.URI = "window://team/one"
	w.Resource.ContentFingerprint = strings.Repeat("b", 64)
	if _, err = Project(w, Query{Cursor: first.NextCursor}); err == nil {
		t.Fatal("cursor crossed selected revision fingerprint")
	}
}

func TestEveryStaticChoiceReachableThroughBoundedMetadataPages(t *testing.T) {
	options := make([]types.Option, 0, 73)
	for i := 0; i < 73; i++ {
		value := fmt.Sprintf("choice-%02d", i)
		if i == 56 {
			value = "USD"
		}
		options = append(options, types.Option{Label: "Currency " + value, Value: value})
	}
	w := &types.Window{WindowKey: "currencies", View: types.View{Content: &types.Container{ID: "root", Items: []types.Item{{ID: "currency", Options: options}, {ID: "another", Options: options}}}}}
	preview, err := Project(w, Query{ID: "currency"})
	if err != nil {
		t.Fatal(err)
	}
	control := find(t, preview, "currency")
	if !control.Options.Truncated || len(control.Options.Items) != MaxOptions || control.Options.Path == "" || control.Options.Total != 73 {
		t.Fatalf("continuation undiscoverable %+v", control.Options)
	}
	var all []string
	cursor := ""
	usdPath := ""
	firstCursor := ""
	for pageIndex := 0; pageIndex < 20; pageIndex++ {
		page, err := Project(w, Query{Path: control.Options.Path, MaxNodes: 9, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Nodes) > 9 {
			t.Fatal("option page unbounded")
		}
		for _, node := range page.Nodes {
			if node.Kind != "option" || node.Option == nil {
				t.Fatalf("not an option leaf %+v", node)
			}
			all = append(all, node.Option.Value.(string))
			if node.Option.Value == "USD" {
				usdPath = node.Path
			}
		}
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
		if firstCursor == "" {
			firstCursor = cursor
		}
	}
	if len(all) != 73 || all[56] != "USD" || usdPath == "" {
		t.Fatalf("static choices lost, got %d", len(all))
	}
	single, err := Project(w, Query{Path: usdPath})
	if err != nil || len(single.Nodes) != 1 || single.Nodes[0].Option.Value != "USD" {
		t.Fatal("returned option path cannot be selected", err)
	}
	other, err := Project(w, Query{ID: "another"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = Project(w, Query{Path: find(t, other, "another").Options.Path, Cursor: firstCursor}); err == nil {
		t.Fatal("option cursor crossed control scope")
	}
	w.View.Content.Items[0].Options[56].Value = "Changed after preview"
	if _, err = Project(w, Query{Path: control.Options.Path, Cursor: firstCursor}); err == nil {
		t.Fatal("option edits beyond initial20 did not stale cursor")
	}
}
func TestEnumContinuationRedactionAndDynamicOptionsRemainUnloaded(t *testing.T) {
	values := make([]string, 61)
	for i := range values {
		values[i] = fmt.Sprintf("enum-%02d", i)
	}
	w := &types.Window{View: types.View{Content: &types.Container{ID: "root", SchemaBasedForm: &types.SchemaBasedForm{Id: "form", Fields: []types.FormField{{Name: "status", Type: "string", Enum: values}, {Name: "password", Type: "string", Enum: values}}}, Items: []types.Item{{ID: "masked", Type: "password", Options: []types.Option{{Value: "PRIVATE_PASSWORD_OPTION"}}}, {ID: "dynamic", OptionsDataSourceRef: "unloaded", Options: []types.Option{{Value: "PRIVATE_DYNAMIC_FALLBACK"}}}}}}}
	preview, err := Project(w, Query{ID: "status"})
	if err != nil {
		t.Fatal(err)
	}
	path := find(t, preview, "status").Options.Path
	seen := 0
	cursor := ""
	for i := 0; i < 20; i++ {
		page, err := Project(w, Query{Path: path, MaxNodes: 7, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		seen += len(page.Nodes)
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}
	if seen != len(values) {
		t.Fatalf("enum continuation lost choices %d", seen)
	}
	for _, id := range []string{"password", "masked", "dynamic"} {
		page, err := Project(w, Query{ID: id})
		if err != nil {
			t.Fatal(err)
		}
		node := find(t, page, id)
		if node.Options != nil && node.Options.Path != "" {
			t.Fatal("private or dynamic choices expose continuation")
		}
		if _, err = Project(w, Query{Path: node.Path + "/options"}); err == nil {
			t.Fatal("guessed option subtree bypassed redaction/unloaded semantics")
		}
		bytes, _ := json.Marshal(page)
		if strings.Contains(string(bytes), "PRIVATE_DYNAMIC_FALLBACK") {
			t.Fatal("dynamic fallback leaked")
		}
	}
}
