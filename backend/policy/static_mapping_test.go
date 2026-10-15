// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"testing"

	"github.com/viant/authz"
)

func TestStaticResourceMappingIsExactAndServerOwned(t *testing.T) {
	binding := ResourceBinding{Operation: OperationWindowView, CandidateID: "Window-A", Resource: authz.Resource{Kind: "window", ID: "Window-A", Version: "1", Tenant: "tenant"}, Action: "execute"}
	mapper, err := NewStaticResourceMapper([]ResourceBinding{binding})
	if err != nil {
		t.Fatal(err)
	}
	resource, action, err := mapper(context.Background(), OperationWindowView, Candidate{ID: "Window-A"})
	if err != nil || resource != binding.Resource || action != "execute" {
		t.Fatalf("mapping=%+v %q %v", resource, action, err)
	}
	if _, _, err := mapper(context.Background(), OperationWindowView, Candidate{ID: "window-a"}); err == nil {
		t.Fatal("case-folded candidate was mapped")
	}
	if _, _, err := mapper(context.Background(), OperationReportView, Candidate{ID: "Window-A"}); err == nil {
		t.Fatal("operation switched policy")
	}
	if _, err := NewStaticResourceMapper([]ResourceBinding{binding, binding}); err == nil {
		t.Fatal("duplicate binding accepted")
	}
}
