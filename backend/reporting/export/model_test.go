package reportexport

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"unicode/utf16"

	"github.com/stretchr/testify/require"
)

func TestDecodeJSON_CapacityDirectSeriesFixture(t *testing.T) {
	request := loadExportRequestFixture(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)

	require.Equal(t, 1, request.Version)
	require.Equal(t, "reportExportRequest", request.Kind)
	require.Equal(t, "pdf", request.Target.Format)
	require.Equal(t, "savedPayload", request.Source.From)
	require.Equal(t, "reportBuilder.savedReportPayload", request.Source.ArtifactKind)
	require.Equal(t, "Capacity KPI Blend Q3", request.Source.Title)
	require.NotNil(t, request.ReportSpecModel())
	require.NotNil(t, request.ReportFillModel())
	require.NotNil(t, request.ReportPrintModel())
	require.Equal(t, "reportSpec", request.ReportSpecModel().Kind)
	require.Equal(t, "Capacity KPI Blend Q3", request.ReportSpecModel().Title)
	require.Equal(t, "reportFill", request.ReportFillModel().Kind)
	require.Equal(t, "Capacity KPI Blend Q3", request.ReportPrintModel().Title)
	require.Len(t, request.ReportPrintModel().Pages, 3)
}

func TestDecodeJSON_PreservesOptionalMetadata(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	fixture["metadata"] = map[string]any{
		"conversationId": "conv-123",
		"workspaceId":    "steward",
		"renderHints": map[string]any{
			"theme": "print",
		},
	}
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	request, err := DecodeJSON(data)
	require.NoError(t, err)
	require.JSONEq(t, `{"conversationId":"conv-123","workspaceId":"steward","renderHints":{"theme":"print"}}`, string(request.Metadata))
}

func TestDecodeJSON_AudienceFixturePreservesOptionalReportPrintContract(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-audience-export-request-fixture.v1.json",
	)
	delete(fixture, "reportPrint")
	target := fixture["target"].(map[string]any)
	target["format"] = "csv"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	request, err := DecodeJSON(data)
	require.NoError(t, err)
	require.NotNil(t, request.ReportFillModel())
	require.Nil(t, request.ReportPrintModel())
}

func TestDecodeJSON_RejectsMissingReportPrintForPDF(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	delete(fixture, "reportPrint")
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportPrint is required for pdf exports")
}

func TestDecodeJSON_RejectsSavedPayloadWithoutPayloadID(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	source := fixture["source"].(map[string]any)
	delete(source, "payloadId")
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.source.payloadId is required for savedPayload sources")
}

func TestDecodeJSON_AllowsPresetSourceContract(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	source := fixture["source"].(map[string]any)
	source["from"] = "preset"
	delete(source, "payloadId")
	delete(source, "reportId")
	delete(source, "documentVersion")
	source["sourceArtifactId"] = "performance_inventory_brief"
	source["artifactKind"] = "reportBuilder.reportTemplate"
	source["artifactRef"] = "reportBuilder.reportTemplate://metricReportBuilder:performance_inventory_brief"
	source["windowKey"] = "metricReportBuilder"
	source["templateLabel"] = "Performance Inventory Brief"
	source["title"] = "Performance Inventory Brief"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	request, err := DecodeJSON(data)
	require.NoError(t, err)
	require.Equal(t, "preset", request.Source.From)
	require.Equal(t, "reportBuilder.reportTemplate", request.Source.ArtifactKind)
	require.Equal(t, "performance_inventory_brief", request.Source.SourceArtifactID)
	require.Equal(t, "metricReportBuilder", request.Source.WindowKey)
	require.Equal(t, "Performance Inventory Brief", request.Source.TemplateLabel)
}

func TestDecodeJSON_RejectsSavedViewWithWrongArtifactKind(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	source := fixture["source"].(map[string]any)
	source["from"] = "savedView"
	delete(source, "payloadId")
	source["sourceArtifactId"] = "saved_view_capacity_q3"
	source["artifactKind"] = "reportBuilder.savedReportPayload"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.source.artifactKind must be reportBuilder.savedView for savedView sources")
}

func TestDecodeJSON_RejectsPresetWithoutSourceArtifactID(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	source := fixture["source"].(map[string]any)
	source["from"] = "preset"
	delete(source, "payloadId")
	delete(source, "reportId")
	delete(source, "documentVersion")
	delete(source, "sourceArtifactId")
	source["artifactKind"] = "reportBuilder.reportTemplate"
	source["artifactRef"] = "reportBuilder.reportTemplate://metricReportBuilder:performance_inventory_brief"
	source["windowKey"] = "metricReportBuilder"
	source["templateLabel"] = "Performance Inventory Brief"
	source["title"] = "Performance Inventory Brief"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.source.sourceArtifactId is required for preset sources")
}

func TestDecodeJSON_AllowsSavedViewWithoutReportPrintForCSV(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	source := fixture["source"].(map[string]any)
	source["from"] = "savedView"
	delete(source, "payloadId")
	source["sourceArtifactId"] = "saved_view_capacity_q3"
	source["artifactKind"] = "reportBuilder.savedView"
	source["artifactRef"] = "reportBuilder.savedView://saved_view_capacity_q3"
	source["reportId"] = "capacityQ3"
	source["documentVersion"] = 8
	source["title"] = "Capacity Q3 Saved View"
	target := fixture["target"].(map[string]any)
	target["format"] = "csv"
	delete(fixture, "reportPrint")
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	request, err := DecodeJSON(data)
	require.NoError(t, err)
	require.Equal(t, "savedView", request.Source.From)
	require.Nil(t, request.ReportPrintModel())
}

func TestDecodeJSON_RejectsPublishedSnapshotWithoutSourceArtifactID(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	source := fixture["source"].(map[string]any)
	source["from"] = "publishedSnapshot"
	delete(source, "payloadId")
	delete(source, "sourceArtifactId")
	source["artifactKind"] = "reportBuilder.publishedSnapshot"
	source["artifactRef"] = "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3"
	source["reportId"] = "capacityQ3"
	source["documentVersion"] = 9
	source["title"] = "Capacity Q3 Published Snapshot"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.source.sourceArtifactId is required for publishedSnapshot sources")
}

func TestDecodeJSON_RejectsReportFillSpecVersionMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportFill := fixture["reportFill"].(map[string]any)
	reportFill["specVersion"] = 99
	syncExportRequestFixtureHashes(fixture)
	reportFill["specVersion"] = 99

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportFill.specVersion must match reportSpec.version")
}

func TestDecodeJSON_RejectsReportFillSourceMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportFill := fixture["reportFill"].(map[string]any)
	source := reportFill["source"].(map[string]any)
	source["stateKey"] = "otherBuilder"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportFill.source must match reportSpec.source")
}

func TestDecodeJSON_RejectsReportFillSpecHashMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportFill := fixture["reportFill"].(map[string]any)
	syncExportRequestFixtureHashes(fixture)
	reportFill["specHash"] = "fnv1a:deadbeef"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportFill.specHash must match reportSpec")
}

func TestDecodeJSON_RejectsReportPrintFillVersionMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportPrint := fixture["reportPrint"].(map[string]any)
	syncExportRequestFixtureHashes(fixture)
	reportPrint["fillVersion"] = 7

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportPrint.fillVersion must match reportFill.version")
}

func TestDecodeJSON_RejectsReportPrintSpecHashMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportPrint := fixture["reportPrint"].(map[string]any)
	syncExportRequestFixtureHashes(fixture)
	reportPrint["specHash"] = "fnv1a:deadbeef"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportPrint.specHash must match reportSpec")
}

func TestDecodeJSON_RejectsReportPrintFillHashMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportPrint := fixture["reportPrint"].(map[string]any)
	syncExportRequestFixtureHashes(fixture)
	reportPrint["fillHash"] = "fnv1a:feedface"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportPrint.fillHash must match reportFill")
}

func TestDecodeJSON_RejectsReportPrintSourceMismatch(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportPrint := fixture["reportPrint"].(map[string]any)
	source := reportPrint["source"].(map[string]any)
	source["containerId"] = "otherContainer"
	syncExportRequestFixtureHashes(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportPrint.source must match reportSpec.source")
}

func TestDecodeJSON_RejectsUnknownTopLevelField(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	fixture["unexpected"] = true

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unknown field")
}

func TestDecodeJSON_RejectsInvalidTargetFormat(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	target := fixture["target"].(map[string]any)
	target["format"] = "zip"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), `reportExportRequest.target.format "zip" is not supported`)
}

func TestDecodeJSON_RejectsInvalidReportSpecKind(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportSpec := fixture["reportSpec"].(map[string]any)
	reportSpec["kind"] = "reportView"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportSpec: reportSpec.kind must be reportSpec")
}

func TestDecodeJSON_RejectsInvalidEmbeddedReportPrint(t *testing.T) {
	fixture := loadExportRequestFixtureMap(
		t,
		"capacity-direct-series-export-request-fixture.v1.json",
	)
	reportPrint := fixture["reportPrint"].(map[string]any)
	reportPrint["kind"] = "reportPreview"
	syncExportRequestFixtureHashes(fixture)
	reportPrint["kind"] = "reportPreview"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportExportRequest.reportPrint")
	require.Contains(t, err.Error(), "reportPrint.kind must be reportPrint")
}

func TestDecodeJSON_RejectsTrailingContent(t *testing.T) {
	data := append(loadExportRequestFixtureBytes(t, "capacity-direct-series-export-request-fixture.v1.json"), []byte("\n{}")...)

	_, err := DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "trailing content after top-level object")
}

func loadExportRequestFixture(t *testing.T, filename string) *ReportExportRequest {
	t.Helper()
	data := loadExportRequestFixtureBytes(t, filename)
	request, err := DecodeJSON(data)
	require.NoError(t, err)
	return request
}

func loadExportRequestFixtureMap(t *testing.T, filename string) map[string]any {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal(loadExportRequestFixtureBytes(t, filename), &value))
	return value
}

func loadExportRequestFixtureBytes(t *testing.T, filename string) []byte {
	t.Helper()
	_, currentFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	fixturePath := filepath.Join(
		filepath.Dir(currentFile),
		"..", "..", "..",
		"src", "reporting", "fixtures", filename,
	)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)
	return data
}

func syncExportRequestFixtureHashes(fixture map[string]any) {
	spec, ok := fixture["reportSpec"]
	if !ok {
		return
	}
	specHash := hashFixtureValue(spec)
	if reportFillValue, ok := fixture["reportFill"]; ok {
		if reportFill, ok := reportFillValue.(map[string]any); ok {
			syncReportFillFixtureProvenance(reportFill)
			reportFill["specHash"] = specHash
			fillHash := hashFixtureValue(reportFill)
			if reportPrintValue, ok := fixture["reportPrint"]; ok {
				if reportPrint, ok := reportPrintValue.(map[string]any); ok {
					reportPrint["specHash"] = specHash
					reportPrint["fillHash"] = fillHash
				}
			}
		}
	}
}

func syncReportFillFixtureProvenance(reportFill map[string]any) {
	datasets, ok := reportFill["datasets"].([]any)
	if !ok {
		return
	}
	for _, datasetValue := range datasets {
		dataset, ok := datasetValue.(map[string]any)
		if !ok {
			continue
		}
		request := dataset["request"]
		provenance, ok := dataset["provenance"].(map[string]any)
		if !ok {
			continue
		}
		provenance["requestHash"] = hashFixtureValue(request)
		if rows, ok := dataset["rows"].([]any); ok {
			provenance["rowCount"] = len(rows)
		}
	}
}

func hashFixtureValue(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	var hash uint32 = 2166136261
	for _, codeUnit := range utf16.Encode([]rune(string(data))) {
		hash ^= uint32(codeUnit)
		hash *= 16777619
	}
	return fmt.Sprintf("fnv1a:%08x", hash)
}
