package types

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestColumnTimeZoneBindingRoundTrip(t *testing.T) {
	var column Column
	require.NoError(t, yaml.Unmarshal([]byte("id: started\nname: Started\nformat: dateTime24\ntimeZoneSelector: campaignTimeZone\ntimeZoneBinding: {dataSourceRef: header, scope: metrics, dataField: timeZone.ianaTimezoneStr}\n"), &column))
	require.NotNil(t, column.TimeZoneBinding)
	require.Equal(t, "header", column.TimeZoneBinding.DataSourceRef)
	require.Equal(t, "metrics", column.TimeZoneBinding.Scope)
	require.Equal(t, "timeZone.ianaTimezoneStr", column.TimeZoneBinding.DataField)
	raw, err := json.Marshal(column)
	require.NoError(t, err)
	var decoded Column
	require.NoError(t, json.Unmarshal(raw, &decoded))
	require.Equal(t, column, decoded)
}
