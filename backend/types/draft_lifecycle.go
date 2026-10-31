package types

import (
	"fmt"
	"strings"
)

func validateDraftLifecycle(window *Window, draft *DraftFormSpec, fallback string, validateDataSources bool) error {
	if draft == nil || draft.Lifecycle == nil {
		return nil
	}
	lifecycle := draft.Lifecycle
	groups := [][]map[string]interface{}{lifecycle.Key, lifecycle.Defaults}
	if lifecycle.Source != nil {
		source := lifecycle.Source
		ref := strings.TrimSpace(source.DataSourceRef)
		if ref == "" {
			return fmt.Errorf("draft lifecycle source requires dataSourceRef")
		}
		target := draft.DataSourceRef
		if target == "" {
			target = fallback
		}
		if ref == target {
			return fmt.Errorf("draft lifecycle source must differ from draft datasource")
		}
		if validateDataSources {
			if _, ok := window.DataSource[ref]; !ok {
				return fmt.Errorf("draft lifecycle references unknown datasource %s", ref)
			}
		}
		groups = append(groups, source.Parameters, source.Defaults, source.Watch)
	}
	for _, rows := range groups {
		for _, row := range rows {
			name, _ := row["name"].(string)
			if strings.TrimSpace(name) == "" {
				return fmt.Errorf("draft lifecycle parameter requires name")
			}
			if row["direction"] == "out" || row["output"] == true {
				return fmt.Errorf("draft lifecycle parameters must be inbound")
			}
		}
	}
	return nil
}
