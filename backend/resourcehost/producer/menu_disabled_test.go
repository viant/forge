package provider

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMenuDisabledLabelsRemainVisibleWithoutExecutableActions(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"reports","menus":[{"id":"pending","title":"Pending report","disabled":true,"description":"Not available","iconSvg":{"viewBox":[0,0,24,24],"paths":["M1 1L2 2"]}},{"id":"live","action":{"resourceUri":"window://example/live","parameterBindings":{"AccountId":{"from":["accountId"]}}}}]}]}`)
	require.NoError(t, ValidateMenu(1, raw))
	var envelope struct {
		Applications []json.RawMessage `json:"applications"`
	}
	require.NoError(t, json.Unmarshal(raw, &envelope))
	var checked []json.RawMessage
	filtered, err := filterMenuNodes(context.Background(), envelope.Applications, func(action json.RawMessage) (bool, error) {
		checked = append(checked, action)
		return false, nil
	}, 0)
	require.NoError(t, err)
	require.Len(t, checked, 1, "only an executable action needs action visibility")
	encoded, err := json.Marshal(filtered)
	require.NoError(t, err)
	require.JSONEq(t, `[{"id":"reports","menus":[{"id":"pending","title":"Pending report","disabled":true,"description":"Not available","iconSvg":{"viewBox":[0,0,24,24],"paths":["M1 1L2 2"]}}]}]`, string(encoded))
}

func TestMenuDisabledLabelsDoNotBypassActionValidation(t *testing.T) {
	for _, leaf := range []string{
		`{"id":"missing"}`,
		`{"id":"enabled","disabled":false}`,
		`{"id":"truthy","disabled":"true"}`,
		`{"id":"numeric","disabled":1}`,
		`{"id":"null","disabled":true,"action":null}`,
		`{"id":"string","disabled":true,"action":"invalid"}`,
	} {
		raw := json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"reports","menus":[` + leaf + `]}]}`)
		require.Error(t, ValidateMenu(1, raw), leaf)
	}
	checked := 0
	filtered, err := filterMenuNodes(context.Background(), []json.RawMessage{json.RawMessage(`{"disabled":true,"action":{"resourceUri":"window://example/protected"}}`)}, func(json.RawMessage) (bool, error) {
		checked++
		return false, nil
	}, 0)
	require.NoError(t, err)
	require.Equal(t, 1, checked, "disabled presentation never exempts an authored action from authorization")
	require.Empty(t, filtered)
}
