package reportspec

import (
	"fmt"
	"strings"
)

// KPISparklineSpec mirrors the canonical public KPI sparkline declaration.
// Resolution and admitted datasource execution remain with the report host.
type KPISparklineSpec struct {
	Details              *KPISparklineDetails `json:"details,omitempty"`
	ValueColor           *ValueColorSpec      `json:"valueColor,omitempty"`
	DatasetRef           string               `json:"datasetRef"`
	ValueField           string               `json:"valueField"`
	CategoryField        string               `json:"categoryField"`
	ComparisonDatasetRef string               `json:"comparisonDatasetRef,omitempty"`
	PeriodStartPath      string               `json:"periodStartPath,omitempty"`
	PeriodEndPath        string               `json:"periodEndPath,omitempty"`
}

// Details is opt-in, display-only point metadata with an explicit print policy.
type KPISparklineDetails struct {
	CategoryLabel   string `json:"categoryLabel"`
	CategoryFormat  string `json:"categoryFormat"`
	ValueLabel      string `json:"valueLabel"`
	ValueFormat     string `json:"valueFormat"`
	Unit            string `json:"unit,omitempty"`
	SeriesLabel     string `json:"seriesLabel,omitempty"`
	ComparisonLabel string `json:"comparisonLabel,omitempty"`
	Print           string `json:"print"`
}

func (d *KPISparklineDetails) Validate() error {
	if d == nil {
		return nil
	}
	if strings.TrimSpace(d.CategoryLabel) == "" || strings.TrimSpace(d.ValueLabel) == "" || (d.CategoryFormat != "text" && d.CategoryFormat != "date") || (d.Print != "details" && d.Print != "omit") {
		return fmt.Errorf("invalid sparkline detail labels, category format or print policy")
	}
	if (d.SeriesLabel != "" && strings.TrimSpace(d.SeriesLabel) == "") || (d.ComparisonLabel != "" && strings.TrimSpace(d.ComparisonLabel) == "") {
		return fmt.Errorf("sparkline series labels must not be blank")
	}
	switch d.ValueFormat {
	case "number", "number2", "number5", "currency", "currency2", "percent", "percentFraction", "percentFraction2", "compactNumber":
		return nil
	}
	return fmt.Errorf("invalid sparkline detail numeric format")
}
