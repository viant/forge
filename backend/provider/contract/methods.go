// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	"encoding/json"
	"fmt"
	identity "github.com/viant/forge/backend/resource"
)

func Plural(kind string) string {
	switch kind {
	case "lookup":
		return "lookups"
	case "mcp":
		return "mcps"
	case "navigation":
		return "navigations"
	case "toolfeed":
		return "toolfeeds"
	case "window":
		return "windows"
	case "report":
		return "reports"
	case "intent":
		return "intents"
	case "template":
		return "templates"
	case "datasource":
		return "datasources"
	case "skill":
		return "skills"
	case "eval":
		return "evals"
	case "prompt":
		return "prompts"
	}
	return ""
}
func Kind(plural string) string {
	for _, kind := range []string{"navigation", "toolfeed", "window", "report", "intent", "template", "datasource", "skill", "eval", "prompt", "mcp", "lookup"} {
		if Plural(kind) == plural {
			return kind
		}
	}
	return ""
}
func Methods(kind string, operations []string) map[string]string {
	plural := Plural(kind)
	if !identity.ValidResourceKind(kind) {
		return nil
	}
	out := map[string]string{}
	for _, operation := range operations {
		out[operation] = plural + "/" + operation
	}
	return out
}

type ListResult struct {
	Resources  []*ResourceState `json:"resources"`
	NextCursor string           `json:"nextCursor,omitempty"`
	Complete   bool             `json:"complete"`
}

// DecodeList normalizes an explicitly declared typed primitive list result.
// Native skill manifests use AuthoringResourcesMeta instead; this helper never
// guesses a canonical URI from a sealed package path or opaque transport ID.
func DecodeList(raw []byte, kind string) (ListResult, error) {
	plural := Plural(kind)
	if plural == "" {
		return ListResult{}, fmt.Errorf("unknown primitive list kind")
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return ListResult{}, fmt.Errorf("invalid primitive list")
	}
	var rows json.RawMessage
	if plural != "" {
		rows = fields[plural]
	}
	if len(rows) == 0 {
		rows = fields["resources"]
	}
	if len(rows) == 0 {
		return ListResult{}, fmt.Errorf("primitive list collection missing")
	}
	out := ListResult{Resources: []*ResourceState{}}
	if json.Unmarshal(rows, &out.Resources) != nil {
		return ListResult{}, fmt.Errorf("invalid primitive rows")
	}
	if len(fields["nextCursor"]) > 0 && json.Unmarshal(fields["nextCursor"], &out.NextCursor) != nil {
		return ListResult{}, fmt.Errorf("invalid primitive cursor")
	}
	if len(fields["complete"]) > 0 {
		if json.Unmarshal(fields["complete"], &out.Complete) != nil {
			return ListResult{}, fmt.Errorf("invalid list completeness")
		}
	} else {
		return ListResult{}, fmt.Errorf("primitive completeness missing")
	}
	if out.Complete == (out.NextCursor != "") {
		return ListResult{}, fmt.Errorf("inconsistent primitive completeness")
	}
	for _, row := range out.Resources {
		if row == nil {
			return ListResult{}, fmt.Errorf("nil primitive row")
		}
		uri, e := identity.ParseResourceURI(row.URI)
		if e != nil || uri.Kind != kind || row.Kind != "" && row.Kind != kind || row.Namespace != "" && row.Namespace != uri.Namespace {
			return ListResult{}, fmt.Errorf("primitive identity mismatch")
		}
		row.Kind, row.Namespace, row.Name = uri.Kind, uri.Namespace, uri.Name
	}
	return out, nil
}
