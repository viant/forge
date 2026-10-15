// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"github.com/viant/forge/backend/types"
	"slices"
	"strings"
)

// executionSelectors reverses only the native catalog's known browser-envelope
// projection. Window-owned selectors and services keep their declared meaning.
func executionSelectors(producer, inline types.DataSource, id string) *types.Selectors {
	if producer.Service != nil || inline.Service == nil || inline.Service.Endpoint != "agentlyAPI" || inline.Service.URI != "/v1/api/datasources/"+id+"/fetch" || !strings.EqualFold(inline.Service.Method, "POST") || inline.Selectors == nil {
		return inline.Selectors
	}
	projected := types.Selectors{}
	if producer.Selectors != nil {
		projected = *producer.Selectors
	}
	if strings.TrimSpace(projected.Data) == "" || strings.TrimSpace(projected.Data) == "data" {
		projected.Data = "rows"
	}
	if strings.TrimSpace(projected.DataInfo) == "" || strings.TrimSpace(projected.DataInfo) == "meta" {
		projected.DataInfo = "dataInfo"
	}
	if inline.Selectors.ValueColumn != projected.ValueColumn || inline.Selectors.Data != projected.Data || inline.Selectors.Scope != projected.Scope || inline.Selectors.DataInfo != projected.DataInfo || inline.Selectors.Metrics != projected.Metrics || !slices.Equal(inline.Selectors.DataFallbacks, projected.DataFallbacks) {
		return inline.Selectors
	}
	if producer.Selectors == nil {
		return nil
	}
	copy := *producer.Selectors
	copy.DataFallbacks = slices.Clone(producer.Selectors.DataFallbacks)
	return &copy
}
