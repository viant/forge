// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
)

func TestPolicyIDUsesExactCompactTupleAndAccountBinding(t *testing.T) {
	workspace, err := WorkspacePolicyID("tenant", "account", "ai<studio", "w1")
	if err != nil {
		t.Fatal(err)
	}
	payload := []byte(`["tenant","account","ai<studio","w1","workspace",""]`)
	want := sha256.Sum256(payload)
	if workspace.ID != hex.EncodeToString(want[:]) || workspace.Tuple != [6]string{"tenant", "account", "ai<studio", "w1", "workspace", ""} || PolicyVersion != "logical" {
		t.Fatalf("workspace policy mapping=%+v", workspace)
	}
	otherAccount, err := WorkspacePolicyID("tenant", "other", "ai<studio", "w1")
	if err != nil || otherAccount.ID == workspace.ID {
		t.Fatalf("account lost from policy identity: %+v %v", otherAccount, err)
	}
	report, err := ObjectPolicyID("tenant", "account", "ai<studio", "w1", "report", "r1")
	if err != nil || report.ID == workspace.ID {
		t.Fatalf("object policy identity=%+v err=%v", report, err)
	}
	window, err := ObjectPolicyID("tenant", "account", "ai<studio", "w1", "window", "r1")
	if err != nil || window.ID == report.ID {
		t.Fatalf("kind lost from policy identity: %+v err=%v", window, err)
	}
}

func TestPolicyIDRejectsMalformedInternalKeys(t *testing.T) {
	for _, input := range []struct{ tenant, account, kind, object string }{
		{"", "account", "report", "r1"},
		{"tenant", "a b", "report", "r1"},
		{"tenant", "account", "report", ""},
		{"tenant", "account", "DataSource", "r1"},
		{"tenant", "accóunt", "report", "r1"},
	} {
		if _, err := ObjectPolicyID(input.tenant, input.account, "studio", "w1", input.kind, input.object); !errors.Is(err, ErrInvalid) {
			t.Fatalf("malformed identity %+v accepted: %v", input, err)
		}
	}
}
