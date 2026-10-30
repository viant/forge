package reporting

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"strings"
	"testing"
)

func TestReportConsumerWireKeepsDatasourcePinsPrivate(t *testing.T) {
	pins := map[string]identity.ResolvedResource{"rows": {URI: "datasource://example/rows", ResourceCandidate: identity.ResourceCandidate{ContentFingerprint: "private-source-hash"}}}
	values := []any{CompileRequest{DependencyPins: pins, DependencyToken: "private-operation-proof"}, CompileResult{DependencyPins: pins, DependencyToken: "private-operation-proof"}, ExecuteResourceRequest{DependencyPins: pins, DependencyToken: "private-operation-proof"}, ExecuteResourceResult{DependencyPins: pins, DependencyToken: "private-operation-proof"}}
	for _, value := range values {
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		for _, hidden := range []string{"dependencyPins", "private-source-hash", "private-operation-proof"} {
			if strings.Contains(string(raw), hidden) {
				t.Fatalf("%T leaked %s", value, hidden)
			}
		}
	}
}
