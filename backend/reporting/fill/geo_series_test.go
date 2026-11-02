package reportfill

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGeoSeriesGeometryIdentityAndCopies(t *testing.T) {
	var geo ResolvedGeo
	require.NoError(t, json.Unmarshal([]byte(`{"shape":"geojson","seriesField":"status","geometry":{"viewBox":[0,0,960,500],"features":[{"key":"North","label":"North","point":[480,250]}]},"regions":[{"key":"North","label":"North","markId":"[\"North\",null]","seriesValue":null,"symbol":{"rawValue":null,"displayValue":"No value","label":"Count","radius":0}},{"key":"North","label":"North","markId":"[\"North\",0]","seriesValue":0,"symbol":{"rawValue":null,"displayValue":"No value","label":"Count","radius":0}},{"key":"North","label":"North","markId":"[\"North\",\"0\"]","seriesValue":"0","symbol":{"rawValue":null,"displayValue":"No value","label":"Count","radius":0}}]}`), &geo))
	geo.Ranking = append([]ResolvedGeoRegion{}, geo.Regions...)
	geo.ActiveRegion = &geo.Regions[0]
	require.NoError(t, validateGeoGeometry(&geo))
	for name, mutate := range map[string]func(*ResolvedGeo){
		"missingValue":        func(g *ResolvedGeo) { g.Regions[0].SeriesValue = nil },
		"objectValue":         func(g *ResolvedGeo) { g.Regions[0].SeriesValue = json.RawMessage(`{}`) },
		"wrongTypedIdentity":  func(g *ResolvedGeo) { g.Regions[1].MarkID = `["North","0"]` },
		"duplicate":           func(g *ResolvedGeo) { g.Regions = append(g.Regions, g.Regions[0]) },
		"equivalentDuplicate": func(g *ResolvedGeo) { r := g.Regions[1]; r.MarkID = `["North",0.0]`; g.Regions = append(g.Regions, r) },
		"negativeZeroDuplicate": func(g *ResolvedGeo) {
			r := g.Regions[1]
			r.MarkID = `["North",-0]`
			r.SeriesValue = json.RawMessage(`-0`)
			g.Regions = append(g.Regions, r)
		},
		"unknownLocation": func(g *ResolvedGeo) { g.Regions[0].Key = "Unknown" },
		"wrongRanking":    func(g *ResolvedGeo) { g.Ranking[0].Label = "Other" },
		"wrongActive":     func(g *ResolvedGeo) { r := *g.ActiveRegion; r.Key = "Unknown"; g.ActiveRegion = &r },
		"legacyMetadata":  func(g *ResolvedGeo) { g.SeriesField = ""; g.seriesFieldPresent = false },
	} {
		t.Run(name, func(t *testing.T) {
			raw, err := json.Marshal(geo)
			require.NoError(t, err)
			var candidate ResolvedGeo
			require.NoError(t, json.Unmarshal(raw, &candidate))
			mutate(&candidate)
			require.Error(t, validateGeoGeometry(&candidate))
		})
	}
}
