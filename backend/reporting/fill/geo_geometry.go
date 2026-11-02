package reportfill

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strings"
)

var planarPath = regexp.MustCompile(`^(?:[MLZ0-9., -])+$`)

func validateGeoGeometry(geo *ResolvedGeo) error {
	if geo.Shape != "geojson" {
		if geo.SeriesField != "" || geo.seriesFieldPresent {
			return fmt.Errorf("seriesField requires geojson Point geometry")
		}
		for _, r := range append(append([]ResolvedGeoRegion{}, geo.Regions...), geo.Ranking...) {
			if r.markIDPresent || r.MarkID != "" || r.SeriesValue != nil {
				return fmt.Errorf("legacy geo forbids series metadata")
			}
		}
		if geo.ActiveRegion != nil && (geo.ActiveRegion.markIDPresent || geo.ActiveRegion.MarkID != "" || geo.ActiveRegion.SeriesValue != nil) {
			return fmt.Errorf("legacy geo forbids series metadata")
		}
		return nil
	}
	g := geo.Geometry
	if g == nil || len(g.ViewBox) != 4 || g.ViewBox[0] != 0 || g.ViewBox[1] != 0 || g.ViewBox[2] != 960 || g.ViewBox[3] != 500 {
		return fmt.Errorf("geojson geometry requires viewBox [0,0,960,500]")
	}
	series := geo.SeriesField != "" || geo.seriesFieldPresent
	if series && strings.TrimSpace(geo.SeriesField) == "" {
		return fmt.Errorf("geojson seriesField requires a nonempty field")
	}
	if series && len(geo.Ranking) > 10000 {
		return fmt.Errorf("geojson supports at most 10000 ranked Point marks")
	}
	if len(g.Features) == 0 || len(g.Features) > 2000 || !series && len(g.Features) != len(geo.Regions) || series && len(geo.Regions) > 12000 {
		return fmt.Errorf("geojson geometry requires 1–2000 features with matching regions")
	}
	keys := map[string]bool{}
	points := map[string]bool{}
	for _, f := range g.Features {
		point := len(f.Point) == 2 && f.Path == "" && f.Point[0] >= 66 && f.Point[0] <= 894 && f.Point[1] >= 66 && f.Point[1] <= 434
		path := f.Point == nil && planarPath.MatchString(f.Path)
		if strings.TrimSpace(f.Key) == "" || keys[f.Key] || strings.TrimSpace(f.Label) == "" || (!point && !path) {
			return fmt.Errorf("geojson geometry has duplicate/empty keys, labels or invalid planar paths/points")
		}
		keys[f.Key] = true
		points[f.Key] = point
	}
	if series {
		hasPoint := false
		for _, point := range points {
			hasPoint = hasPoint || point
		}
		if !hasPoint {
			return fmt.Errorf("geojson seriesField requires Point geometry")
		}
	}
	validatePair := func(r ResolvedGeoRegion) error {
		point, exists := points[r.Key]
		if !exists {
			return fmt.Errorf("geojson region %q has no matching geometry", r.Key)
		}
		if point && r.Symbol == nil {
			return fmt.Errorf("geojson point %q requires a valid symbol", r.Key)
		}
		if !point && r.Symbol != nil {
			return fmt.Errorf("geojson polygon %q cannot have a symbol", r.Key)
		}
		if !series || !point {
			if r.markIDPresent || r.MarkID != "" || r.SeriesValue != nil {
				return fmt.Errorf("geojson region %q forbids series metadata", r.Key)
			}
		} else {
			var value any
			if r.MarkID == "" || r.SeriesValue == nil || json.Unmarshal(r.SeriesValue, &value) != nil {
				return fmt.Errorf("geojson point %q requires markId and scalar seriesValue", r.Key)
			}
			switch value.(type) {
			case nil, string, bool, float64:
			default:
				return fmt.Errorf("geojson seriesValue must be scalar")
			}
			var identity []any
			if json.Unmarshal([]byte(r.MarkID), &identity) != nil || len(identity) != 2 || identity[0] != r.Key || !reflect.DeepEqual(identity[1], value) {
				return fmt.Errorf("geojson point %q has invalid typed markId", r.Key)
			}
		}
		return nil
	}
	marks := map[string]ResolvedGeoRegion{}
	copyID := func(r ResolvedGeoRegion) string {
		if !points[r.Key] {
			return "location:" + r.Key
		}
		var identity []any
		_ = json.Unmarshal([]byte(r.MarkID), &identity)
		// JavaScript JSON.stringify gives -0 and +0 the same numeric identity.
		if value, ok := identity[1].(float64); ok && value == 0 {
			identity[1] = float64(0)
		}
		encoded, _ := json.Marshal(identity)
		return "mark:" + string(encoded)
	}
	markCount := 0
	for _, r := range geo.Regions {
		if !keys[r.Key] && (!series || !points[r.Key]) {
			return fmt.Errorf("geojson region %q has no matching geometry", r.Key)
		}
		if err := validatePair(r); err != nil {
			return err
		}
		if series && points[r.Key] {
			// Parse/re-encode to reject alternate spellings of the same identity.
			id := copyID(r)
			if _, exists := marks[id]; exists {
				return fmt.Errorf("geojson duplicate typed mark identity")
			}
			marks[id] = r
			markCount++
			if markCount > 10000 {
				return fmt.Errorf("geojson supports at most 10000 observed Point marks")
			}
		} else {
			delete(keys, r.Key)
			if series {
				marks[copyID(r)] = r
			}
		}
	}
	if series {
		for key := range keys {
			if !points[key] {
				return fmt.Errorf("geojson backdrop %q has no region", key)
			}
		}
	}
	validateCopy := func(r ResolvedGeoRegion) error {
		if err := validatePair(r); err != nil {
			return err
		}
		if series {
			region, found := marks[copyID(r)]
			if !found || !reflect.DeepEqual(region, r) {
				return fmt.Errorf("geojson selection/ranking must match a resolved mark or backdrop")
			}
		}
		return nil
	}
	ranked := map[string]bool{}
	for i, r := range geo.Ranking {
		if err := validateCopy(r); err != nil {
			return fmt.Errorf("ranking[%d]: %w", i, err)
		}
		if series {
			id := copyID(r)
			if ranked[id] {
				return fmt.Errorf("ranking[%d]: duplicate mark", i)
			}
			ranked[id] = true
		}
	}
	if geo.ActiveRegion != nil {
		if err := validateCopy(*geo.ActiveRegion); err != nil {
			return fmt.Errorf("activeRegion: %w", err)
		}
	}
	return nil
}

func validateGeoSymbol(s *ResolvedGeoSymbol) error {
	if s == nil {
		return nil
	}
	if math.IsNaN(s.Radius) || math.IsInf(s.Radius, 0) || s.Radius < 0 || s.Radius > 64 || strings.TrimSpace(s.Label) == "" || strings.TrimSpace(s.DisplayValue) == "" {
		return fmt.Errorf("invalid geo symbol radius, label or displayValue")
	}
	if s.RawValue != nil && (math.IsNaN(*s.RawValue) || math.IsInf(*s.RawValue, 0) || *s.RawValue < 0) {
		return fmt.Errorf("invalid geo symbol size")
	}
	positive := s.RawValue != nil && *s.RawValue > 0
	if positive != (s.Radius > 0) {
		return fmt.Errorf("geo symbol radius must be positive exactly when size is positive")
	}
	return nil
}
