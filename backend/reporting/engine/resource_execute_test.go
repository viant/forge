// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package reporting

import (
	"context"
	"encoding/json"
	"errors"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/reporting/registry"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	authsvc "github.com/viant/mcp/client/auth/link"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

type reportFixtureTransport func(context.Context, string, map[string]interface{}) (string, error)

func (f reportFixtureTransport) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	return f(ctx, name, args)
}
func TestAuthoredResourceExecutesRealDatasourcePipeline(t *testing.T) {
	original, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if json.Unmarshal(original, &envelope) != nil {
		t.Fatal("fixture")
	}
	for id, raw := range envelope.DataSources {
		var descriptor dsproto.DataSource
		_ = json.Unmarshal(raw, &descriptor)
		if descriptor.Backend == nil {
			continue
		}
		descriptor.Backend.Service = "arbitrary-producer"
		descriptor.Backend.Method = "read-approved-" + id
		descriptorRaw, _ := json.Marshal(descriptor)
		envelope.DataSources[id] = descriptorRaw
		for i := range envelope.Dependencies {
			d := &envelope.Dependencies[i]
			if d.Kind == "datasource" && d.ID == id {
				d.ContentFingerprint = identity.ContentFingerprint(descriptorRaw)
			}
		}
	}
	original, _ = json.Marshal(envelope)
	content := append([]byte(nil), original...)
	uri, _ := identity.ParseResourceURI("report://example/summary")
	binding := "verified-account"
	allowed := true
	expiry := time.Now().Add(time.Minute)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return append(json.RawMessage(nil), content...), nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: binding, ValidUntil: expiry}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := 0
	during := func() {}
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		calls++
		if !strings.HasPrefix(name, "arbitrary-producer:read-approved-") || authsvc.EffectiveUserID(ctx) != "fixture-user" {
			t.Fatalf("wrong real transport dispatch: %s", name)
		}
		pin, ok := requestctx.ResolvedResourceFromContext(ctx)
		if !ok || pin.URI != uri.String() {
			t.Fatal("missing exact pin")
		}
		during()
		return `{"data":[{"category":"Sample","day":"2026-10-07","amount":10,"count":5}]}`, nil
	}), service.AuthorizeResourceDataset))
	var events []observe.Event
	ctx := observe.WithObserver(authsvc.InjectUser(context.Background(), "fixture-user"), observe.ObserverFunc(func(event observe.Event) {
		events = append(events, event)
	}))
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}}
	result, err := service.ExecuteResource(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	if calls != len(result.Datasets) || len(result.Datasets["primary"].Rows) != 1 || len(result.ReportFill) == 0 || len(result.ReportPrint) == 0 {
		t.Fatalf("missing actual execution artifacts: %+v", result)
	}
	fillOnly, fillErr := service.ExecuteResource(ctx, &ExecuteResourceRequest{Resource: request.Resource, FillOnly: true})
	if fillErr != nil || fillOnly == nil || len(fillOnly.ReportFill) == 0 || len(fillOnly.ReportPrint) != 0 || len(fillOnly.Datasets) != len(result.Datasets) {
		t.Fatalf("fill-only execution changed admitted data or returned print: %v", fillErr)
	}
	var fullFill, projectedFill any
	if json.Unmarshal(result.ReportFill, &fullFill) != nil || json.Unmarshal(fillOnly.ReportFill, &projectedFill) != nil || !reflect.DeepEqual(fullFill, projectedFill) {
		t.Fatal("fill-only preview changed report fill")
	}
	seen := map[observe.Phase]bool{}
	for _, event := range events {
		if !strings.HasPrefix(string(event.Phase), "report.resource.") {
			continue
		}
		if event.Outcome != observe.OK || event.Duration < 0 || event.Labels.Kind != "report" {
			t.Fatalf("unsafe report timing event: %+v", event)
		}
		seen[event.Phase] = true
	}
	for _, phase := range []observe.Phase{"report.resource.entry", "report.resource.total", "report.resource.select", "report.resource.compile", "report.resource.precheck", "report.resource.plan", "report.resource.fetch", "report.resource.materialize", "report.resource.final"} {
		if !seen[phase] {
			t.Fatalf("missing report timing phase %s", phase)
		}
	}
	originalPin := *result.Resource
	for _, test := range []struct {
		name   string
		change func()
	}{{"source drift", func() { content = append(content, ' ') }}, {"account change", func() { binding = "other-account" }}, {"revocation", func() { allowed = false }}, {"lease expiry", func() { expiry = time.Now().Add(-time.Second) }}} {
		t.Run(test.name, func(t *testing.T) {
			content = append([]byte(nil), original...)
			binding = "verified-account"
			allowed = true
			expiry = time.Now().Add(time.Minute)
			during = test.change
			out, err := service.ExecuteResource(ctx, request)
			if err == nil || out != nil {
				t.Fatal("boundary released rows after authority/content changed")
			}
		})
	}
	content = append([]byte(nil), original...)
	binding = "verified-account"
	allowed = true
	expiry = time.Now().Add(time.Minute)
	during = func() {}
	before := calls
	forged := originalPin
	forged.AuthorityBinding = "forged"
	if out, err := service.ExecuteResource(ctx, &ExecuteResourceRequest{ResolvedResource: &forged}); err == nil || out != nil || calls != before {
		t.Fatal("forged pin reached transport")
	}
	if _, err := service.ExecuteResource(ctx, &ExecuteResourceRequest{Resource: request.Resource, Parameters: map[string]interface{}{"backend": "injected"}}); err == nil || calls != before {
		t.Fatal("undeclared source override executed")
	}

	before = calls
	allowed = false
	if _, err := service.ExecuteResource(ctx, request); !errors.Is(err, identity.ErrResourceDenied) || calls != before {
		t.Fatal("unauthorized source reached transport")
	}
}
