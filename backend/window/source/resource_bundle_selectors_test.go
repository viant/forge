// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestExecutionSelectorsPreserveProducerPathsWithoutChangingBrowserMetadata(t *testing.T) {
	producer := types.DataSource{Selectors: &types.Selectors{Data: "data", DataInfo: "meta"}}
	browser := types.DataSource{Service: &types.Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/items/fetch", Method: "POST"}, Selectors: &types.Selectors{Data: "rows", DataInfo: "dataInfo"}}
	result := executionSelectors(producer, browser, "items")
	if result.Data != "data" || result.DataInfo != "meta" {
		t.Fatalf("producer projection overwritten: %#v", result)
	}
	result.Data = "changed"
	if producer.Selectors.Data != "data" || browser.Selectors.Data != "rows" {
		t.Fatal("shared selectors mutated")
	}
	browser.Selectors = &types.Selectors{Data: "custom.rows", DataInfo: "custom.info"}
	if result = executionSelectors(producer, browser, "items"); result != browser.Selectors {
		t.Fatal("window-owned custom selectors replaced")
	}
	browser.Selectors = &types.Selectors{Data: "rows", DataInfo: "dataInfo"}
	producer.Service = &types.Service{URI: "/custom"}
	if result = executionSelectors(producer, browser, "items"); result != browser.Selectors {
		t.Fatal("explicit producer service replaced")
	}
}

func TestExecutionSelectorsKeepOrderedDataFallbacksAndCloneProducerMetadata(t *testing.T) {
	producer := types.DataSource{Selectors: &types.Selectors{Data: "data", DataInfo: "meta", DataFallbacks: []string{"legacy.rows", "backup.rows"}}}
	browser := types.DataSource{Service: &types.Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/items/fetch", Method: "POST"}, Selectors: &types.Selectors{Data: "rows", DataInfo: "dataInfo", DataFallbacks: []string{"legacy.rows", "backup.rows"}}}
	result := executionSelectors(producer, browser, "items")
	if result.Data != "data" || len(result.DataFallbacks) != 2 || result.DataFallbacks[0] != "legacy.rows" {
		t.Fatal("producer alternative selectors were discarded")
	}
	result.DataFallbacks[0] = "changed"
	if producer.Selectors.DataFallbacks[0] != "legacy.rows" || browser.Selectors.DataFallbacks[0] != "legacy.rows" {
		t.Fatal("fallback metadata aliases shared definition")
	}
	browser.Selectors.DataFallbacks = []string{"backup.rows", "legacy.rows"}
	if result = executionSelectors(producer, browser, "items"); result != browser.Selectors {
		t.Fatal("window-owned alternative order replaced")
	}
}

func TestExecutionSelectorsPreserveValueColumnOnlyOverride(t *testing.T) {
	for _, original := range []*types.Selectors{nil, {Data: "data", DataInfo: "meta", ValueColumn: "producerValue"}} {
		producer := types.DataSource{Selectors: original}
		browser := types.DataSource{Service: &types.Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/items/fetch", Method: "POST"}, Selectors: &types.Selectors{Data: "rows", DataInfo: "dataInfo", ValueColumn: "windowValue"}}
		if result := executionSelectors(producer, browser, "items"); result != browser.Selectors {
			t.Fatalf("ValueColumn-only authored override was discarded: %#v", result)
		}
	}
}
