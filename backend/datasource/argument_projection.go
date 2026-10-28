package datasource

import (
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"strings"
)

func mcpToolArguments(backend *dsproto.Backend, logical map[string]interface{}) map[string]interface{} {
	if len(backend.Args) == 0 {
		return logical
	}
	// Remove logical-only metadata before selectors run, including when a mapping
	// attempts to alias it under another transport key. Pinned authored values win.
	inputs := transportArguments(logical, backend.RequestMetadata)
	args := map[string]interface{}{}
	for target, selector := range backend.Args {
		// The existing presence-aware selector preserves omitted producer inputs
		// separately from an explicit null, false, zero or empty collection.
		if value, present := lookupDataPath(strings.TrimPrefix(selector, "inputs."), inputs); present {
			args[target] = value
		}
	}
	return expandNestedArgs(mergeArgs(args, backend.Pinned))
}
