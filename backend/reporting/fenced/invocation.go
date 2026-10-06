package fenced

import (
	"encoding/json"
	"fmt"
	"strings"
)

func validateInvocationBinding(assembly *Assembly, binding *InvocationBinding) error {
	if binding == nil {
		return nil
	}
	for _, key := range []string{"kind", "containerId", "stateKey", "dataSourceRef"} {
		value, ok := binding.Source[key].(string)
		if !ok || strings.TrimSpace(value) == "" {
			return fmt.Errorf("invocation source.%s is required", key)
		}
	}
	if binding.Source["kind"] != "dashboard.reportBuilder" {
		return fmt.Errorf("invocation source.kind must be dashboard.reportBuilder")
	}
	if binding.Parameters == nil {
		return fmt.Errorf("invocation parameters are required")
	}
	if len(binding.Datasets) != len(assembly.DataSources) || len(binding.Datasets) == 0 {
		return fmt.Errorf("invocation datasets must exactly match materialized datasets")
	}
	seen := map[string]bool{}
	for _, dataset := range binding.Datasets {
		if seen[dataset.ID] {
			return fmt.Errorf("duplicate invocation dataset %q", dataset.ID)
		}
		seen[dataset.ID] = true
		if _, ok := assembly.DataSources[dataset.ID]; !ok {
			return fmt.Errorf("invocation dataset %q has no materialized rows", dataset.ID)
		}
		if strings.TrimSpace(dataset.DataSourceRef) == "" {
			return fmt.Errorf("invocation dataset %q dataSourceRef is required", dataset.ID)
		}
		var request map[string]any
		if err := json.Unmarshal(dataset.Request, &request); err != nil || len(request) == 0 {
			return fmt.Errorf("invocation dataset %q request must be a nonempty object", dataset.ID)
		}
	}
	return nil
}
