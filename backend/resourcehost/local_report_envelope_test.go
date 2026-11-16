package resource

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLocalReportEnvelopeReferenceFormat(t *testing.T) {
	native := json.RawMessage(`{"schemaVersion":2,"format":"forge.reportReferences","reportSpec":{"version":1},"dataSourceResources":{"events":{"resource":{"uri":"datasource://example/events"}}}}`)
	authored := json.RawMessage(`{"schemaVersion":2,"format":"forge.reportReferences","sourceFormat":"forge.authoredReport","reportDocument":{"title":"Example"},"builderRef":"example","builderDefinition":{}}`)
	require.NoError(t, ValidateReportEnvelope(2, native))
	require.NoError(t, ValidateReportEnvelope(2, authored))
	for _, raw := range []json.RawMessage{
		json.RawMessage(`{"schemaVersion":2,"reportSpec":{}}`),
		json.RawMessage(`{"schemaVersion":2,"format":"forge.reportReferences","sourceFormat":"unknown","reportSpec":{}}`),
		json.RawMessage(`{"schemaVersion":2,"format":"forge.reportReferences","sourceFormat":"forge.authoredReport","reportDocument":{}}`),
		json.RawMessage(`{"schemaVersion":2,"format":"forge.reportReferences","reportSpec":null}`),
		json.RawMessage(`{"schemaVersion":2,"format":"forge.reportReferences","reportSpec":{},"unexpected":true}`),
		append(append(json.RawMessage{}, native...), []byte(` {}`)...),
	} {
		require.Error(t, ValidateReportEnvelope(2, raw))
	}
	require.Error(t, ValidateReportEnvelope(1, native))
	require.Error(t, ValidateReportEnvelope(2, json.RawMessage(`{"schemaVersion":1,"reportSpec":{}}`)))
	require.NoError(t, ValidateReportEnvelope(1, json.RawMessage(`{"schemaVersion":1,"reportSpec":{}}`)))
}
