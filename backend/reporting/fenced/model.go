// Package fenced assembles progressive forge-report and forge-data fences for
// backend report compilation.
package fenced

import "encoding/json"

const (
	ReportFence = "forge-report"
	DataFence   = "forge-data"
)

type Fence struct {
	Kind    string          `json:"kind"`
	Index   int             `json:"index,omitempty"`
	Payload json.RawMessage `json:"payload"`
}

type CompileRequest struct {
	Content    string             `json:"content,omitempty"`
	Fences     []Fence            `json:"fences,omitempty"`
	ReportID   string             `json:"reportId,omitempty"`
	Invocation *InvocationBinding `json:"invocation,omitempty"`
}

type Diagnostic struct {
	Code         string `json:"code,omitempty"`
	Severity     string `json:"severity,omitempty"`
	Path         string `json:"path,omitempty"`
	Message      string `json:"message,omitempty"`
	SuggestedFix string `json:"suggestedFix,omitempty"`
	ReportID     string `json:"reportId,omitempty"`
	Sequence     int    `json:"sequence,omitempty"`
}

type Assembly struct {
	Scope       string                     `json:"scope"`
	ID          string                     `json:"id"`
	Grammar     string                     `json:"grammar"`
	Status      string                     `json:"status"`
	Sequence    int                        `json:"sequence"`
	Source      map[string]any             `json:"source"`
	DataSources map[string]json.RawMessage `json:"dataSources"`
}

type CompileResult struct {
	Assembly       *Assembly       `json:"assembly,omitempty"`
	ReportDocument json.RawMessage `json:"reportDocument,omitempty"`
	ReportSpec     json.RawMessage `json:"reportSpec,omitempty"`
	ReportFill     json.RawMessage `json:"reportFill,omitempty"`
	ReportPrint    json.RawMessage `json:"reportPrint,omitempty"`
	Diagnostics    []Diagnostic    `json:"diagnostics,omitempty"`
}

// InvocationBinding binds already-materialized rows to their admitted source and
// requests. Compilation never fetches data or changes these request scopes.
type InvocationBinding struct {
	Source     map[string]any   `json:"source"`
	Parameters map[string]any   `json:"parameters"`
	Datasets   []DatasetBinding `json:"datasets"`
}
type DatasetBinding struct {
	ID            string          `json:"id"`
	DataSourceRef string          `json:"dataSourceRef"`
	Request       json.RawMessage `json:"request"`
}
