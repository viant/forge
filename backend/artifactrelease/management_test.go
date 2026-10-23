package artifactrelease

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

func TestManagementToolsUseStableDistinctMCPMethods(t *testing.T) {
	want := []string{"releases/list", "releases/candidates", "releases/publish", "releases/promote", "releases/history"}
	got := Methods()
	if Capability != "io.viant/artifact-releases/v1" || len(got) != len(want) {
		t.Fatalf("release capability/method inventory changed: %q %v", Capability, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("release MCP method %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestManagementInputsNeverAcceptTrustedAccountScope(t *testing.T) {
	for _, input := range []any{ListInput{}, CandidatesInput{}, PublishInput{}, PromoteInput{}, HistoryInput{}} {
		typeOf := reflect.TypeOf(input)
		for _, forbidden := range []string{"Key", "Tenant", "Account", "Workspace"} {
			if _, found := typeOf.FieldByName(forbidden); found {
				t.Fatalf("%s accepts caller-supplied authority field %s", typeOf.Name(), forbidden)
			}
		}
	}
	if (ListInput{Namespace: "sales"}).Validate() != nil || (CandidatesInput{Namespace: "sales"}).Validate() != nil || (HistoryInput{Namespace: "sales", Name: "stable"}).Validate() != nil {
		t.Fatal("canonical namespace/channel query rejected")
	}
	for _, name := range []string{"bad space", "bad\nname", "bad/name"} {
		if !errors.Is((ListInput{Namespace: name}).Validate(), ErrInvalid) || !errors.Is((HistoryInput{Namespace: "sales", Name: name}).Validate(), ErrInvalid) {
			t.Fatalf("invalid management selector %q accepted", name)
		}
	}
}

func TestPublishAndPromoteWireCarriesExactRootsNamedPoliciesAndCAS(t *testing.T) {
	root := artifactcohort.RootRef{URI: "window://sales/new-board", Kind: "window", Version: 3, Hash: strings.Repeat("a", 64)}
	ref := authz.NamedReference{Resource: authz.Resource{Tenant: "tenant", Kind: "policy", ID: "reviewers", Version: "logical"}, Revision: 2}
	in := PublishInput{Namespace: "sales", Name: "preview", Description: "Preview release", Policies: []authz.NamedReference{ref}, Roots: []artifactcohort.RootRef{root}, ExpectedRevision: 7}
	if err := in.Validate(); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["namespace"] != "sales" || decoded["name"] != "preview" || decoded["expectedRevision"] != float64(7) || decoded["policies"] == nil || decoded["roots"] == nil || decoded["tenant"] != nil || decoded["account"] != nil || decoded["workspace"] != nil {
		t.Fatalf("publish wire contract changed: %s", raw)
	}
	in.Roots = append(in.Roots, root)
	if !errors.Is(in.Validate(), ErrInvalid) {
		t.Fatal("duplicate root URI accepted")
	}
	rollBack := PromoteInput{Namespace: "sales", Name: "preview", BundleHash: strings.Repeat("b", 64), ExpectedRevision: 8}
	if err := rollBack.Validate(); err != nil {
		t.Fatal(err)
	}
	rollBack.BundleHash = "working"
	if !errors.Is(rollBack.Validate(), ErrInvalid) {
		t.Fatal("mutable or malformed bundle selector accepted")
	}
}

func TestManagementOutputsDistinguishPendingFromActive(t *testing.T) {
	channel := Channel{Key: Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "preview"}, Policies: []authz.NamedReference{{Resource: authz.Resource{Tenant: "tenant", Kind: "policy", ID: "readers", Version: "logical"}, Revision: 1}}, ActiveBundleHash: strings.Repeat("a", 64), Revision: 2}
	result := Result{Channel: channel, Status: StatusActive, Activated: true}
	if err := result.Validate(); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(ListOutput{Channels: []Result{result}})
	if err != nil || !strings.Contains(string(raw), `"channels":[{"channel":`) || !strings.Contains(string(raw), `"activated":true`) {
		t.Fatalf("active release list shape changed: %s %v", raw, err)
	}
	pending := Result{Channel: channel, Status: StatusPending, OperationID: "pending-op"}
	if err := pending.Validate(); err != nil {
		t.Fatal(err)
	}
	raw, err = json.Marshal(pending)
	if err != nil || !strings.Contains(string(raw), `"activated":false`) || !strings.Contains(string(raw), `"operationId":"pending-op"`) {
		t.Fatalf("pending release misreported as active: %s %v", raw, err)
	}
	if StatusFailed == StatusActive || StatusPending == StatusActive {
		t.Fatal("management state labels collapsed")
	}
	result.Activated = false
	if !errors.Is(result.Validate(), ErrInvalid) {
		t.Fatal("unprojected release was labeled active")
	}
}
