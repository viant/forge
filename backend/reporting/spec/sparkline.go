package reportspec

// KPISparklineSpec mirrors the canonical public KPI sparkline declaration.
// Resolution and admitted datasource execution remain with the report host.
type KPISparklineSpec struct {
	ValueColor           *ValueColorSpec `json:"valueColor,omitempty"`
	DatasetRef           string          `json:"datasetRef"`
	ValueField           string          `json:"valueField"`
	CategoryField        string          `json:"categoryField"`
	ComparisonDatasetRef string          `json:"comparisonDatasetRef,omitempty"`
	PeriodStartPath      string          `json:"periodStartPath,omitempty"`
	PeriodEndPath        string          `json:"periodEndPath,omitempty"`
}
