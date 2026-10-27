package reportfill

import "fmt"

func validateChartTooltipEntries(entries []ChartTooltipEntry) error {
	ids := map[string]bool{}
	for _, entry := range entries {
		if entry.ID == "" || ids[entry.ID] || entry.RowCount < 0 || len(entry.Fields) == 0 || len(entry.Fields) > 16 {
			return fmt.Errorf("resolvedChart.tooltipEntries requires unique ids, nonnegative rowCount and 1–16 fields")
		}
		ids[entry.ID] = true
		fields := map[string]bool{}
		for _, field := range entry.Fields {
			if field.Field == "" || field.Label == "" || fields[field.Field] {
				return fmt.Errorf("resolvedChart.tooltipEntries fields require unique field and nonempty label")
			}
			fields[field.Field] = true
			switch field.Aggregate {
			case "unique", "sum", "avg", "min", "max":
			default:
				return fmt.Errorf("unsupported chart tooltip aggregate %q", field.Aggregate)
			}
			switch field.State {
			case "value", "missing", "null", "mixed":
			default:
				return fmt.Errorf("unsupported chart tooltip state %q", field.State)
			}
		}
	}
	return nil
}
