package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
)

func TestNativeScopeSelectionReexecutesAdmittedDatasetAndResets(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"reportDocument":{"title":"Records"},"reportSpec":{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"records","stateKey":"records","dataSourceRef":"records"},"title":"Records","parameters":{"viewMode":"table","groupBy":"","pageSize":25,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["filters","evidence"]},"refinements":[],"calculatedFields":[],"scope":{"dataSourceRef":"records","params":[{"id":"mode","kind":"select","label":"Mode","required":true,"value":1,"options":[{"label":"First","value":1},{"label":"Second","value":2}],"filterBindings":[{"datasetRef":"primary","path":"mode"}]},{"id":"layout","kind":"select","label":"Layout","value":"wide","options":[{"label":"Wide","value":"wide"},{"label":"Narrow","value":"narrow"}]}]},"datasets":[{"id":"primary","dataSourceRef":"records","resultContract":{"shape":"tabular","rowPath":"rows.0","hasMorePath":"rows.0.hasMore"},"request":{"offset":9,"limit":25,"filters":{"scope":"fixed","mode":1}}}],"blocks":[{"id":"filters","kind":"filterBarBlock","title":"Controls","paramIds":["mode","layout"]},{"id":"evidence","kind":"tableBlock","title":"Evidence","datasetRef":"primary","columns":[{"key":"value","label":"Value"}]}]},"dataSources":{"records":{"id":"records","cardinality":"collection","parameters":[{"name":"scopeID"},{"name":"from"},{"name":"to"}],"selectors":{"data":"data.0","dataInfo":"data.0"},"backend":{"kind":"mcp_tool","service":"owned","method":"read"}}}}`)
	original := string(raw)
	uri, _ := identity.ParseResourceURI("report://example/records")
	allowed := true
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "held-actor", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls, wantMode := 0, float64(1)
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(_ context.Context, method string, args map[string]interface{}) (string, error) {
		calls++
		filters := args["filters"].(map[string]interface{})
		if method != "owned:read" || filters["scope"] != "fixed" || filters["mode"] != wantMode || args["scopeID"] != float64(7) || args["from"] != "2031-04-01" || args["to"] != "2031-04-02" {
			t.Fatalf("scope or input changed: %#v", args)
		}
		if args["offset"] != float64(0) || args["layout"] != nil || args["mode"] != nil {
			t.Fatalf("control leaked or paging did not reset: %#v", args)
		}
		return fmt.Sprintf(`{"data":[{"columns":[{"name":"value"}],"rows":[[%d]],"hasMore":false}]}`, int(wantMode)*10), nil
	}), service.AuthorizeResourceDataset))
	base := map[string]interface{}{"scopeID": float64(7), "from": "2031-04-01", "to": "2031-04-02"}
	for _, selected := range []float64{2, 1} {
		wantMode = selected
		parameters := map[string]interface{}{}
		for key, value := range base {
			parameters[key] = value
		}
		parameters["mode"], parameters["layout"] = selected, "narrow"
		out, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, Parameters: parameters, FillOnly: true})
		if err != nil {
			t.Fatal(err)
		}
		var fill struct {
			Datasets []struct{ Rows []map[string]interface{} }
		}
		if json.Unmarshal(out.ReportFill, &fill) != nil || len(fill.Datasets) != 1 || len(fill.Datasets[0].Rows) != 1 || fill.Datasets[0].Rows[0]["value"] != selected*10 {
			t.Fatal("selected rows did not reach the report fill")
		}
		var spec struct {
			Scope struct {
				Params []struct {
					ID    string
					Value interface{}
				}
			}
		}
		if json.Unmarshal(out.ReportSpec, &spec) != nil || spec.Scope.Params[0].Value != selected || spec.Scope.Params[1].Value != "narrow" {
			t.Fatal("effective control values were lost")
		}
		if parameters["mode"] != selected || !reflect.DeepEqual(base, map[string]interface{}{"scopeID": float64(7), "from": "2031-04-01", "to": "2031-04-02"}) || string(raw) != original {
			t.Fatal("source or caller inputs mutated")
		}
	}
	if calls != 2 {
		t.Fatal("selection and reset must execute independently")
	}
	for _, invalid := range []map[string]interface{}{{"mode": 3}, {"mode": "2"}, {"mode": 2, "service": "spoof"}} {
		before := calls
		if out, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, Parameters: invalid}); err == nil || out != nil || calls != before {
			t.Fatal("invalid control reached producer")
		}
	}
	allowed = false
	if out, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, Parameters: map[string]interface{}{"mode": 1}}); err == nil || out != nil || calls != 2 {
		t.Fatal("revoked actor reached producer")
	}
}

func TestNativeScopeDateBindingsPreserveUnrelatedInputs(t *testing.T) {
	raw := json.RawMessage(`{"scope":{"params":[{"id":"period","kind":"dateRange","required":true,"value":{"start":"2031-04-01","end":"2031-04-02"},"filterBindings":[{"datasetRef":"one","path":"from","valuePath":"start"},{"datasetRef":"one","path":"to","valuePath":"end"}]}]},"datasets":[{"id":"one","request":{"offset":5,"filters":{"fixed":true}}}]}`)
	parameters := map[string]interface{}{"period": map[string]interface{}{"start": "2031-05-01", "end": "2031-05-02"}, "scopeID": 7}
	bound, remaining, err := bindNativeScopeParameters(raw, parameters)
	if err != nil {
		t.Fatal(err)
	}
	var spec struct {
		Datasets []struct {
			Request struct {
				Offset  int
				Filters map[string]interface{}
			}
		}
	}
	if json.Unmarshal(bound, &spec) != nil || spec.Datasets[0].Request.Offset != 0 || !reflect.DeepEqual(spec.Datasets[0].Request.Filters, map[string]interface{}{"from": "2031-05-01", "to": "2031-05-02", "fixed": true}) || !reflect.DeepEqual(remaining, map[string]interface{}{"scopeID": 7}) {
		t.Fatal("date binding changed scope or request", string(bound))
	}
	for _, period := range []interface{}{map[string]interface{}{"start": "2031-05-03", "end": "2031-05-02"}, map[string]interface{}{"start": "2031-02-29", "end": "2031-05-02"}, "arbitrary"} {
		if _, _, err := bindNativeScopeParameters(raw, map[string]interface{}{"period": period}); err == nil {
			t.Fatal("invalid period admitted")
		}
	}
	optional := json.RawMessage(strings.Replace(string(raw), `"required":true`, `"required":false`, 1))
	cleared, remaining, err := bindNativeScopeParameters(optional, map[string]interface{}{"period": nil, "scopeID": 7})
	if err != nil {
		t.Fatal("optional null range could not clear endpoint bindings", err)
	}
	if json.Unmarshal(cleared, &spec) != nil || spec.Datasets[0].Request.Filters["from"] != nil || spec.Datasets[0].Request.Filters["to"] != nil || !reflect.DeepEqual(remaining, map[string]interface{}{"scopeID": 7}) {
		t.Fatal("explicit null endpoints or unrelated inputs changed")
	}
	for _, endpoint := range []string{"from", "to"} {
		if _, present := spec.Datasets[0].Request.Filters[endpoint]; !present {
			t.Fatal("explicit null became omitted")
		}
	}
	untouched, _, err := bindNativeScopeParameters(optional, map[string]interface{}{"scopeID": 7})
	if err != nil || string(untouched) != string(optional) {
		t.Fatal("omitted date control was changed")
	}
	if _, _, err := bindNativeScopeParameters(raw, map[string]interface{}{"period": nil}); err == nil {
		t.Fatal("required date range accepted null")
	}
}

func TestNativeScopeBindingKeepsExactNumbersAndRejectsUnsafeChoices(t *testing.T) {
	raw := json.RawMessage(`{"scope":{"params":[{"id":"mode","kind":"select","required":true,"value":1,"options":[{"label":"One","value":1.0},{"label":"Two","value":2}],"filterBindings":[{"datasetRef":"one","path":"mode"}]}]},"datasets":[{"id":"one","request":{"filters":{"mode":1,"exactId":9007199254740993},"offset":5},"sentinel":9007199254740992},{"id":"untouched","request":{"filters":{"anotherId":9007199254740993,"exactExponent":9.007199254740993e15}}}]}`)
	bound, _, err := bindNativeScopeParameters(raw, map[string]interface{}{"mode": 1})
	if err != nil {
		t.Fatal("equal typed numeric choice rejected", err)
	}
	for _, literal := range []string{`"exactId":9007199254740993`, `"sentinel":9007199254740992`, `"anotherId":9007199254740993`, `"exactExponent":9.007199254740993e15`} {
		if !strings.Contains(string(bound), literal) {
			t.Fatalf("unrelated numeric literal changed: %s in %s", literal, bound)
		}
	}
	unsafe := json.RawMessage(`{"scope":{"params":[{"id":"mode","kind":"select","required":true,"value":1,"options":[{"label":"First large","value":9007199254740992},{"label":"Adjacent large","value":9007199254740993}]}]},"datasets":[]}`)
	for _, value := range []interface{}{int64(9007199254740992), int64(9007199254740993), json.Number("9007199254740992"), json.Number("9007199254740993")} {
		if _, _, err := bindNativeScopeParameters(unsafe, map[string]interface{}{"mode": value}); err == nil {
			t.Fatalf("unsafe numeric choice was admitted: %v", value)
		}
	}
	if sameNativeScopeValue(json.Number("9007199254740992"), json.Number("9007199254740993")) {
		t.Fatal("adjacent numeric choices became equal")
	}
}

func TestNativeScopeBindingsKeepCanonicalSourceFilterPaths(t *testing.T) {
	raw := json.RawMessage(`{"scope":{"params":[{"id":"mode","kind":"integer","value":1,"filterBindings":[{"datasetRef":"one","path":"nested._mode"}]}]},"datasets":[{"id":"one","request":{"filters":{"nested":{"_mode":1,"fixed":true}}}}]}`)
	bound, _, err := bindNativeScopeParameters(raw, map[string]interface{}{"mode": 2})
	if err != nil || !strings.Contains(string(bound), `"nested":{"_mode":2,"fixed":true}`) {
		t.Fatal("canonical underscored source field was lost", string(bound), err)
	}
	for _, path := range []string{"__proto__.mode", "nested.constructor", "nested.prototype"} {
		unsafe := json.RawMessage(strings.Replace(string(raw), "nested._mode", path, 1))
		if _, _, err := bindNativeScopeParameters(unsafe, map[string]interface{}{"mode": 2}); err == nil {
			t.Fatal("unsafe path admitted", path)
		}
	}
}
