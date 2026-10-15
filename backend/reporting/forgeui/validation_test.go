package forgeui

import (
	"os"
	"testing"

	reportspec "github.com/viant/forge/backend/reporting/spec"
)

func TestNativeReportUsesForgeSchemaAndPublishedDatasourceClosure(t *testing.T) {
	data, err := os.ReadFile("testdata/native-report.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"valid", "wrong-kind", "missing-source", "missing-dataset-source", "unknown-dataset", "duplicate-dataset", "duplicate-block", "unknown-layout"} {
		t.Run(mode, func(t *testing.T) {
			report, err := reportspec.DecodeJSON(data)
			if err != nil {
				t.Fatal(err)
			}
			switch mode {
			case "wrong-kind":
				report.Kind = "report"
			case "missing-source":
				report.Source.DataSourceRef = "other"
			case "missing-dataset-source":
				report.Datasets[0].DataSourceRef = "other"
			case "unknown-dataset":
				report.Blocks[0].DatasetRef = "other"
			case "duplicate-dataset":
				report.Datasets = append(report.Datasets, report.Datasets[0])
			case "duplicate-block":
				report.Blocks = append(report.Blocks, report.Blocks[0])
			case "unknown-layout":
				report.LayoutIntent.BlockOrder = []string{"other"}
			}
			err = ValidateReport(report, map[string]bool{"records": true})
			if (err == nil) != (mode == "valid") {
				t.Fatalf("mode=%s error=%v", mode, err)
			}
		})
	}
}
