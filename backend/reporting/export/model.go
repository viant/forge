package reportexport

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode/utf16"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
)

var allowedExportFormats = map[string]struct{}{
	"pdf":  {},
	"csv":  {},
	"xlsx": {},
	"html": {},
}

var allowedExportSourceKinds = map[string]struct{}{
	"draft":             {},
	"savedPayload":      {},
	"savedView":         {},
	"publishedSnapshot": {},
}

type ReportExportRequest struct {
	Version     int             `json:"version"`
	Kind        string          `json:"kind"`
	Target      Target          `json:"target"`
	Source      Source          `json:"source"`
	ReportSpec  json.RawMessage `json:"reportSpec"`
	ReportFill  json.RawMessage `json:"reportFill"`
	ReportPrint json.RawMessage `json:"reportPrint,omitempty"`

	reportSpecValue  *reportspec.ReportSpec
	reportFillValue  *reportfill.ReportFill
	reportPrintValue *reportprint.ReportPrint
}

type Target struct {
	Format string `json:"format"`
}

type Source struct {
	From             string `json:"from"`
	ArtifactKind     string `json:"artifactKind"`
	ArtifactRef      string `json:"artifactRef"`
	Title            string `json:"title"`
	ReportID         string `json:"reportId,omitempty"`
	PayloadID        string `json:"payloadId,omitempty"`
	SourceArtifactID string `json:"sourceArtifactId,omitempty"`
	DocumentVersion  *int   `json:"documentVersion,omitempty"`
}

type rawReportExportRequest struct {
	Version     int             `json:"version"`
	Kind        string          `json:"kind"`
	Target      Target          `json:"target"`
	Source      Source          `json:"source"`
	ReportSpec  json.RawMessage `json:"reportSpec"`
	ReportFill  json.RawMessage `json:"reportFill"`
	ReportPrint json.RawMessage `json:"reportPrint,omitempty"`
}

func DecodeJSON(data []byte) (*ReportExportRequest, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var raw rawReportExportRequest
	if err := decoder.Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode reportExportRequest: %w", err)
	}
	if err := rejectTrailingJSON(decoder, "reportExportRequest"); err != nil {
		return nil, err
	}
	request := &ReportExportRequest{
		Version:     raw.Version,
		Kind:        raw.Kind,
		Target:      raw.Target,
		Source:      raw.Source,
		ReportSpec:  raw.ReportSpec,
		ReportFill:  raw.ReportFill,
		ReportPrint: raw.ReportPrint,
	}
	if err := request.Validate(); err != nil {
		return nil, err
	}
	return request, nil
}

func (r *ReportExportRequest) Validate() error {
	if r == nil {
		return fmt.Errorf("reportExportRequest is required")
	}
	if r.Version < 1 {
		return fmt.Errorf("reportExportRequest.version must be >= 1")
	}
	if strings.TrimSpace(r.Kind) != "reportExportRequest" {
		return fmt.Errorf("reportExportRequest.kind must be reportExportRequest")
	}
	if _, ok := allowedExportFormats[strings.TrimSpace(r.Target.Format)]; !ok {
		return fmt.Errorf("reportExportRequest.target.format %q is not supported", r.Target.Format)
	}
	if _, ok := allowedExportSourceKinds[strings.TrimSpace(r.Source.From)]; !ok {
		return fmt.Errorf("reportExportRequest.source.from %q is not supported", r.Source.From)
	}
	if strings.TrimSpace(r.Source.ArtifactKind) == "" {
		return fmt.Errorf("reportExportRequest.source.artifactKind is required")
	}
	if strings.TrimSpace(r.Source.ArtifactRef) == "" {
		return fmt.Errorf("reportExportRequest.source.artifactRef is required")
	}
	if strings.TrimSpace(r.Source.Title) == "" {
		return fmt.Errorf("reportExportRequest.source.title is required")
	}
	if r.Source.DocumentVersion != nil && *r.Source.DocumentVersion < 1 {
		return fmt.Errorf("reportExportRequest.source.documentVersion must be >= 1")
	}
	if err := validateExportSourceContract(r.Source); err != nil {
		return err
	}
	if err := r.ensureReportSpecValue(); err != nil {
		return err
	}
	if err := r.ensureReportFillValue(); err != nil {
		return err
	}
	if requiresRenderedReportPrint(r.Target.Format) && len(bytes.TrimSpace(r.ReportPrint)) == 0 {
		return fmt.Errorf("reportExportRequest.reportPrint is required for %s exports", strings.TrimSpace(r.Target.Format))
	}
	if err := r.ensureReportPrintValue(); err != nil {
		return err
	}
	if err := r.validateArtifactConformance(); err != nil {
		return err
	}
	return nil
}

func (r *ReportExportRequest) ReportSpecModel() *reportspec.ReportSpec {
	return r.reportSpecValue
}

func (r *ReportExportRequest) ReportFillModel() *reportfill.ReportFill {
	return r.reportFillValue
}

func (r *ReportExportRequest) ReportPrintModel() *reportprint.ReportPrint {
	return r.reportPrintValue
}

func (r *ReportExportRequest) ensureReportSpecValue() error {
	if len(bytes.TrimSpace(r.ReportSpec)) == 0 {
		return fmt.Errorf("reportExportRequest.reportSpec is required")
	}
	if r.reportSpecValue != nil {
		return nil
	}
	spec, err := reportspec.DecodeJSON(r.ReportSpec)
	if err != nil {
		return fmt.Errorf("reportExportRequest.reportSpec: %w", err)
	}
	r.reportSpecValue = spec
	return nil
}

func (r *ReportExportRequest) ensureReportFillValue() error {
	if len(bytes.TrimSpace(r.ReportFill)) == 0 {
		return fmt.Errorf("reportExportRequest.reportFill is required")
	}
	if r.reportFillValue != nil {
		return nil
	}
	fill, err := reportfill.DecodeJSON(r.ReportFill)
	if err != nil {
		return fmt.Errorf("reportExportRequest.reportFill: %w", err)
	}
	r.reportFillValue = fill
	return nil
}

func (r *ReportExportRequest) ensureReportPrintValue() error {
	if len(bytes.TrimSpace(r.ReportPrint)) == 0 {
		r.reportPrintValue = nil
		return nil
	}
	if r.reportPrintValue != nil {
		return nil
	}
	print, err := reportprint.DecodeJSON(r.ReportPrint)
	if err != nil {
		return fmt.Errorf("reportExportRequest.reportPrint: %w", err)
	}
	r.reportPrintValue = print
	return nil
}

func rejectTrailingJSON(decoder *json.Decoder, label string) error {
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("decode %s: trailing content after top-level object", label)
		}
		return fmt.Errorf("decode %s: %w", label, err)
	}
	return nil
}

func requiresRenderedReportPrint(format string) bool {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "pdf", "html":
		return true
	default:
		return false
	}
}

func validateExportSourceContract(source Source) error {
	from := strings.TrimSpace(source.From)
	switch from {
	case "savedPayload":
		if strings.TrimSpace(source.ArtifactKind) != "reportBuilder.savedReportPayload" {
			return fmt.Errorf("reportExportRequest.source.artifactKind must be reportBuilder.savedReportPayload for savedPayload sources")
		}
		if strings.TrimSpace(source.PayloadID) == "" {
			return fmt.Errorf("reportExportRequest.source.payloadId is required for savedPayload sources")
		}
		if strings.TrimSpace(source.ReportID) == "" {
			return fmt.Errorf("reportExportRequest.source.reportId is required for savedPayload sources")
		}
		if source.DocumentVersion == nil {
			return fmt.Errorf("reportExportRequest.source.documentVersion is required for savedPayload sources")
		}
	case "savedView":
		if strings.TrimSpace(source.ArtifactKind) != "reportBuilder.savedView" {
			return fmt.Errorf("reportExportRequest.source.artifactKind must be reportBuilder.savedView for savedView sources")
		}
		if strings.TrimSpace(source.SourceArtifactID) == "" {
			return fmt.Errorf("reportExportRequest.source.sourceArtifactId is required for savedView sources")
		}
		if strings.TrimSpace(source.ReportID) == "" {
			return fmt.Errorf("reportExportRequest.source.reportId is required for savedView sources")
		}
		if source.DocumentVersion == nil {
			return fmt.Errorf("reportExportRequest.source.documentVersion is required for savedView sources")
		}
	case "publishedSnapshot":
		if strings.TrimSpace(source.ArtifactKind) != "reportBuilder.publishedSnapshot" {
			return fmt.Errorf("reportExportRequest.source.artifactKind must be reportBuilder.publishedSnapshot for publishedSnapshot sources")
		}
		if strings.TrimSpace(source.SourceArtifactID) == "" {
			return fmt.Errorf("reportExportRequest.source.sourceArtifactId is required for publishedSnapshot sources")
		}
		if strings.TrimSpace(source.ReportID) == "" {
			return fmt.Errorf("reportExportRequest.source.reportId is required for publishedSnapshot sources")
		}
		if source.DocumentVersion == nil {
			return fmt.Errorf("reportExportRequest.source.documentVersion is required for publishedSnapshot sources")
		}
	}
	return nil
}

func (r *ReportExportRequest) validateArtifactConformance() error {
	if r.reportSpecValue == nil || r.reportFillValue == nil {
		return nil
	}
	specHash, err := computeJSONFNV1aHash(r.ReportSpec)
	if err != nil {
		return fmt.Errorf("reportExportRequest.reportSpec: %w", err)
	}
	fillHash, err := computeJSONFNV1aHash(r.ReportFill)
	if err != nil {
		return fmt.Errorf("reportExportRequest.reportFill: %w", err)
	}
	if r.reportFillValue.SpecVersion != r.reportSpecValue.Version {
		return fmt.Errorf("reportExportRequest.reportFill.specVersion must match reportSpec.version")
	}
	if strings.TrimSpace(r.reportFillValue.SpecHash) != specHash {
		return fmt.Errorf("reportExportRequest.reportFill.specHash must match reportSpec")
	}
	if !sameArtifactSource(
		r.reportSpecValue.Source.Kind,
		r.reportSpecValue.Source.ContainerID,
		r.reportSpecValue.Source.StateKey,
		r.reportSpecValue.Source.DataSourceRef,
		r.reportFillValue.Source.Kind,
		r.reportFillValue.Source.ContainerID,
		r.reportFillValue.Source.StateKey,
		r.reportFillValue.Source.DataSourceRef,
	) {
		return fmt.Errorf("reportExportRequest.reportFill.source must match reportSpec.source")
	}
	if r.reportPrintValue == nil {
		return nil
	}
	if r.reportPrintValue.SpecVersion != r.reportSpecValue.Version {
		return fmt.Errorf("reportExportRequest.reportPrint.specVersion must match reportSpec.version")
	}
	if strings.TrimSpace(r.reportPrintValue.SpecHash) != specHash {
		return fmt.Errorf("reportExportRequest.reportPrint.specHash must match reportSpec")
	}
	if r.reportPrintValue.FillVersion != r.reportFillValue.Version {
		return fmt.Errorf("reportExportRequest.reportPrint.fillVersion must match reportFill.version")
	}
	if strings.TrimSpace(r.reportPrintValue.FillHash) != fillHash {
		return fmt.Errorf("reportExportRequest.reportPrint.fillHash must match reportFill")
	}
	if !sameArtifactSource(
		r.reportSpecValue.Source.Kind,
		r.reportSpecValue.Source.ContainerID,
		r.reportSpecValue.Source.StateKey,
		r.reportSpecValue.Source.DataSourceRef,
		r.reportPrintValue.Source.Kind,
		r.reportPrintValue.Source.ContainerID,
		r.reportPrintValue.Source.StateKey,
		r.reportPrintValue.Source.DataSourceRef,
	) {
		return fmt.Errorf("reportExportRequest.reportPrint.source must match reportSpec.source")
	}
	return nil
}

func sameArtifactSource(kindA, containerIDA, stateKeyA, dataSourceRefA, kindB, containerIDB, stateKeyB, dataSourceRefB string) bool {
	return strings.TrimSpace(kindA) == strings.TrimSpace(kindB) &&
		strings.TrimSpace(containerIDA) == strings.TrimSpace(containerIDB) &&
		strings.TrimSpace(stateKeyA) == strings.TrimSpace(stateKeyB) &&
		strings.TrimSpace(dataSourceRefA) == strings.TrimSpace(dataSourceRefB)
}

func computeJSONFNV1aHash(payload json.RawMessage) (string, error) {
	trimmed := bytes.TrimSpace(payload)
	if len(trimmed) == 0 {
		return "", fmt.Errorf("payload is required")
	}
	buffer := new(bytes.Buffer)
	if err := json.Compact(buffer, trimmed); err != nil {
		return "", fmt.Errorf("compact json: %w", err)
	}
	var hash uint32 = 2166136261
	for _, codeUnit := range utf16.Encode([]rune(buffer.String())) {
		hash ^= uint32(codeUnit)
		hash *= 16777619
	}
	return fmt.Sprintf("fnv1a:%08x", hash), nil
}
