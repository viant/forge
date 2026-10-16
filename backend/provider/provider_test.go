// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"

	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

type portableTestAuthority struct {
	binding string
	deny    bool
}

func (a *portableTestAuthority) Authenticate(context.Context) (string, error) { return a.binding, nil }
func (a *portableTestAuthority) Authorize(_ context.Context, _, _, _, _ string) error {
	if a.deny {
		return errors.New("denied")
	}
	return nil
}

type portableTestHost struct {
	authority      *portableTestAuthority
	definition     *windowprotocol.Definition
	calls          int
	change         bool
	revisionChange bool
}

func (h *portableTestHost) Catalog(context.Context, *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
	return &windowprotocol.Catalog{ContractVersion: 1, CatalogRevision: "published-1", Groups: []windowprotocol.Group{{ID: "studio", Title: "Studio"}}, Windows: []windowprotocol.WindowSummary{{Key: "report", Title: "Report", GroupID: "studio"}}}, nil
}
func (h *portableTestHost) Definition(context.Context, *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error) {
	return h.definition, nil
}
func (h *portableTestHost) Fetch(_ context.Context, in *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error) {
	if in.WindowKey != "report" || in.DataSourceID != "records" || in.DefinitionRevision != "revision-1" {
		return nil, errors.New("provider dispatch identity changed")
	}
	h.calls++
	if h.change {
		h.authority.binding = "other-account"
	}
	if h.revisionChange {
		h.definition.DefinitionRevision = "revision-2"
		h.definition.DataSources["records"].Backend.Pinned["definitionRevision"] = "revision-2"
	}
	return json.RawMessage(`{"body":{"rows":[{"name":"selected","count":2}],"hasMore":false}}`), nil
}

func TestPortableExplicitHostBindingCannotExecuteThroughProvider(t *testing.T) {
	p, h := portablePOC(false)
	h.definition.DataSources["records"].Backend = &windowprotocol.Backend{Kind: "mcp_tool", Service: "studio-data", Method: "query"}
	if _, err := p.Definition(context.Background(), &windowprotocol.DefinitionInput{ContractVersion: 1, WindowKey: "report"}); err != nil {
		t.Fatal(err)
	}
	if _, err := p.Fetch(context.Background(), &windowprotocol.FetchInput{ContractVersion: 1, WindowKey: "report", DataSourceID: "records", DefinitionRevision: "revision-1"}); err == nil {
		t.Fatal("host binding dispatched through provider")
	}
	if h.calls != 0 {
		t.Fatal("host binding reached provider's private downstream connections")
	}
}

func TestPortableDefinitionRejectsIncompleteAndDuplicateContracts(t *testing.T) {
	for _, mode := range []string{"duplicate-source", "missing-report-source", "invalid-report-schema", "unpublished-scope-source"} {
		t.Run(mode, func(t *testing.T) {
			p, h := portablePOC(true)
			switch mode {
			case "duplicate-source":
				h.definition.Window.DataSource = map[string]types.DataSource{"records": {}}
			case "missing-report-source":
				h.definition.Report.Datasets[0].DataSourceRef = "other"
			case "invalid-report-schema":
				h.definition.Report.Kind = "report"
			case "unpublished-scope-source":
				h.definition.Report.Scope = &reportspec.Scope{DataSourceRef: "other", Params: []reportspec.ScopeParam{}}
			}
			if out, err := p.Definition(context.Background(), &windowprotocol.DefinitionInput{ContractVersion: 1, WindowKey: "report"}); err == nil || out != nil {
				t.Fatalf("invalid definition escaped: %+v %v", out, err)
			}
		})
	}
}

func TestPortableCatalogDenialHasNoPartialResult(t *testing.T) {
	p, _ := portablePOC(false)
	p.Authority = PrimitiveAuthorityFuncs{AuthenticateFunc: func(context.Context) (string, error) { return "verified", nil }, AuthorizeFunc: func(_ context.Context, _, action, key, _ string) error {
		if action == "resource.describe" && key == "report" {
			return errors.New("denied")
		}
		return nil
	}}
	if out, err := p.Catalog(context.Background(), &windowprotocol.CatalogInput{ContractVersion: 1}); err == nil || out != nil {
		t.Fatalf("catalog denial returned partial results: %+v %v", out, err)
	}
}

func TestPortableSelectedFetchAuthorizationUsesVerifiedIdentity(t *testing.T) {
	for _, mode := range []string{"allowed", "selected-deny", "expiry-before-dispatch", "revoke-after-dispatch", "forged-identity"} {
		t.Run(mode, func(t *testing.T) {
			p, h := portablePOC(false)
			checks := 0
			p.Authority = PrimitiveAuthorityFuncs{
				AuthenticateFunc: func(context.Context) (string, error) { return h.authority.binding, nil },
				AuthorizeFunc:    func(context.Context, string, string, string, string) error { return nil },
				AuthorizeFetchFunc: func(_ context.Context, binding string, input *windowprotocol.FetchInput) error {
					checks++
					if binding != "verified-user-account-lease" {
						return errors.New("unverified identity")
					}
					if input.Inputs["selectedId"] != 1 {
						return errors.New("selected entity denied")
					}
					if mode == "expiry-before-dispatch" {
						h.authority.binding = ""
					}
					if mode == "revoke-after-dispatch" && checks > 1 {
						return errors.New("permission revoked")
					}
					return nil
				},
			}
			inputs := map[string]any{"selectedId": 1}
			if mode == "selected-deny" {
				inputs["selectedId"] = 2
			}
			if mode == "forged-identity" {
				inputs["subject"] = "admin"
				inputs["accountId"] = "other-account"
				inputs["facts"] = map[string]any{"isAdmin": true}
			}
			out, err := p.Fetch(context.Background(), &windowprotocol.FetchInput{ContractVersion: 1, WindowKey: "report", DataSourceID: "records", DefinitionRevision: "revision-1", Inputs: inputs})
			allowed := mode == "allowed" || mode == "forged-identity"
			if allowed && (err != nil || out == nil || checks != 2 || h.calls != 1) {
				t.Fatalf("valid selected fetch failed: checks=%d dispatches=%d err=%v", checks, h.calls, err)
			}
			if !allowed && (err == nil || out != nil) {
				t.Fatal("denied selected fetch exposed rows")
			}
			if (mode == "selected-deny" || mode == "expiry-before-dispatch") && h.calls != 0 {
				t.Fatal("selected denial/expired identity reached executor")
			}
		})
	}
}
func portablePOC(report bool) (*PrimitiveProvider, *portableTestHost) {
	a := &portableTestAuthority{binding: "verified-user-account-lease"}
	definition := &windowprotocol.Definition{ContractVersion: 1, DefinitionRevision: "revision-1", Window: &types.Window{WindowKey: "report", View: types.View{Content: &types.Container{}}}, DataSources: map[string]*windowprotocol.DataSource{
		"records": {ID: "records", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "body.rows", DataInfo: "body"}}, Backend: &windowprotocol.Backend{Kind: "provider", Method: windowprotocol.FetchTool, Pinned: map[string]any{"windowKey": "report", "dataSourceId": "records", "definitionRevision": "revision-1"}}},
	}}
	if report {
		data, err := os.ReadFile("../window/contract/testdata/native-report.json")
		if err != nil {
			panic(err)
		}
		definition.Report, err = reportspec.DecodeJSON(data)
		if err != nil {
			panic(err)
		}
	}
	h := &portableTestHost{authority: a, definition: definition}
	return &PrimitiveProvider{Host: h, Authority: a}, h
}
func TestPortableDatlyWindowAndAIReportPOC(t *testing.T) {
	for _, nativeReport := range []bool{false, true} {
		name := "datly-studio-window"
		if nativeReport {
			name = "ai-studio-report"
		}
		t.Run(name, func(t *testing.T) {
			p, h := portablePOC(nativeReport)
			ctx := context.Background()
			catalog, err := p.Catalog(ctx, &windowprotocol.CatalogInput{ContractVersion: 1, Limit: 100})
			if err != nil || len(catalog.Windows) != 1 {
				t.Fatalf("catalog=%+v err=%v", catalog, err)
			}
			definition, err := p.Definition(ctx, &windowprotocol.DefinitionInput{ContractVersion: 1, WindowKey: "report"})
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(definition)
			if err != nil {
				t.Fatal(err)
			}
			var wire windowprotocol.Definition
			if err = json.Unmarshal(encoded, &wire); err != nil {
				t.Fatal(err)
			}
			if wire.DataSources["records"].Selectors.Data != "body.rows" || (wire.Report != nil) != nativeReport {
				t.Fatal("complete datasource/native report lost in transport")
			}
			result, err := p.Fetch(ctx, &windowprotocol.FetchInput{ContractVersion: 1, WindowKey: "report", DataSourceID: "records", DefinitionRevision: wire.DefinitionRevision, Inputs: map[string]any{"windowKey": "attacker", "dataSourceId": "other"}})
			if err != nil || !json.Valid(result) || h.calls != 1 {
				t.Fatalf("fetch=%s calls=%d err=%v", result, h.calls, err)
			}
		})
	}
}
func TestPortableFetchFailsClosed(t *testing.T) {
	for _, mode := range []string{"deny", "identity-switch", "revision-drift", "publication-race", "missing-authority", "unknown-source"} {
		t.Run(mode, func(t *testing.T) {
			p, h := portablePOC(false)
			in := &windowprotocol.FetchInput{ContractVersion: 1, WindowKey: "report", DataSourceID: "records", DefinitionRevision: "revision-1"}
			switch mode {
			case "deny":
				h.authority.deny = true
			case "identity-switch":
				h.change = true
			case "revision-drift":
				in.DefinitionRevision = "old"
			case "publication-race":
				h.revisionChange = true
			case "missing-authority":
				p.Authority = nil
			case "unknown-source":
				in.DataSourceID = "other"
			}
			out, err := p.Fetch(context.Background(), in)
			if err == nil || out != nil {
				t.Fatalf("protected result escaped: %s %v", out, err)
			}
			if mode != "identity-switch" && mode != "publication-race" && h.calls != 0 {
				t.Fatal("unauthorized dispatch occurred")
			}
		})
	}
}
