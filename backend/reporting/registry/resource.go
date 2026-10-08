package registry

import (
	"encoding/json"
	primitive "github.com/viant/agently-core/protocol/primitive"
)

const AuthoredReportFormat = "forge.authoredReport"
const ResourceReportFormat = "forge.reportReferences"

type ReportDependency struct {
	Kind               string `json:"kind"`
	ID                 string `json:"id"`
	ContentFingerprint string `json:"contentFingerprint"`
}

// ReportEnvelope is the complete trusted definition pinned by one resource.
// Native reports omit Format and contain ReportSpec. Authored reports require
// explicit trusted compilation; a document patch never pretends to be a spec.
type ReportEnvelope struct {
	SchemaVersion       int                                      `json:"schemaVersion"`
	Format              string                                   `json:"format,omitempty"`
	SourceFormat        string                                   `json:"sourceFormat,omitempty"`
	ReportDocument      json.RawMessage                          `json:"reportDocument"`
	ReportSpec          json.RawMessage                          `json:"reportSpec,omitempty"`
	BuilderRef          string                                   `json:"builderRef,omitempty"`
	BuilderDefinition   json.RawMessage                          `json:"builderDefinition,omitempty"`
	State               json.RawMessage                          `json:"state,omitempty"`
	DataSources         map[string]json.RawMessage               `json:"dataSources,omitempty"`
	DataSourceResources map[string]primitive.DataSourceReference `json:"dataSourceResources,omitempty"`
	Dependencies        []ReportDependency                       `json:"dependencies,omitempty"`
}
