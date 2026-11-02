package reportfill

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"math"
	"testing"
)

func TestGeoPointResolvedBounds(t *testing.T) {
	geo := &ResolvedGeo{Shape: "geojson", Geometry: &ResolvedGeoGeometry{ViewBox: []float64{0, 0, 960, 500}, Features: []ResolvedGeoFeature{{Key: "A", Label: "A", Point: []float64{66, 434}}}}, Regions: []ResolvedGeoRegion{{Key: "A", Symbol: &ResolvedGeoSymbol{}}}}
	require.NoError(t, validateGeoGeometry(geo))
	for _, point := range [][]float64{{65, 250}, {895, 250}, {480, 65}, {480, 435}, {math.NaN(), 250}, {480, math.Inf(1)}, {480}, {480, 250, 1}} {
		geo.Geometry.Features[0].Point = point
		require.Error(t, validateGeoGeometry(geo))
	}
	geo.Geometry.Features[0].Point = []float64{480, 250}
	geo.Geometry.Features[0].Path = "M0,0 L1,1 Z"
	require.Error(t, validateGeoGeometry(geo), "point and path are exclusive")
	geo.Geometry.Features[0].Path = ""
	geo.Regions[0].Symbol = nil
	require.Error(t, validateGeoGeometry(geo), "points require a symbol")
}

func TestGeoSymbolStrictDecodeAndValidation(t *testing.T) {
	for _, raw := range []string{
		`{"rawValue":0,"displayValue":"0","label":"Count","radius":0}`,
		`{"rawValue":null,"displayValue":"No row","label":"Count","radius":0}`,
		`{"rawValue":10,"displayValue":"10","label":"Count","radius":24}`,
	} {
		var symbol ResolvedGeoSymbol
		require.NoError(t, json.Unmarshal([]byte(raw), &symbol))
		require.NoError(t, validateGeoSymbol(&symbol))
	}
	for _, raw := range []string{
		`{"rawValue":0,"displayValue":"0","label":"Count"}`,
		`{"displayValue":"No row","label":"Count","radius":0}`,
		`{"rawValue":0,"displayValue":"0","label":"Count","radius":null}`,
		`{"rawValue":0,"displayValue":"0","label":"Count","radius":0,"extra":1}`,
	} {
		var symbol ResolvedGeoSymbol
		require.Error(t, json.Unmarshal([]byte(raw), &symbol))
	}
	for _, raw := range []string{
		`{"rawValue":-1,"displayValue":"-1","label":"Count","radius":1}`,
		`{"rawValue":0,"displayValue":"0","label":"Count","radius":1}`,
		`{"rawValue":null,"displayValue":"No row","label":"Count","radius":1}`,
		`{"rawValue":1,"displayValue":"1","label":"Count","radius":0}`,
		`{"rawValue":1,"displayValue":"1","label":"Count","radius":65}`,
	} {
		var symbol ResolvedGeoSymbol
		require.NoError(t, json.Unmarshal([]byte(raw), &symbol))
		require.Error(t, validateGeoSymbol(&symbol))
	}
}
