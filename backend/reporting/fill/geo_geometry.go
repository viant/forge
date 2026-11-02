package reportfill

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

var planarPath = regexp.MustCompile(`^(?:[MLZ0-9., -])+$`)

func validateGeoGeometry(geo *ResolvedGeo) error {
	if geo.Shape != "geojson" {
		return nil
	}
	g := geo.Geometry
	if g == nil || len(g.ViewBox) != 4 || g.ViewBox[0] != 0 || g.ViewBox[1] != 0 || g.ViewBox[2] != 960 || g.ViewBox[3] != 500 {
		return fmt.Errorf("geojson geometry requires viewBox [0,0,960,500]")
	}
	if len(g.Features) == 0 || len(g.Features) > 2000 || len(g.Features) != len(geo.Regions) {
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
		return nil
	}
	for _, r := range geo.Regions {
		if !keys[r.Key] {
			return fmt.Errorf("geojson region %q has no matching geometry", r.Key)
		}
		if err := validatePair(r); err != nil {
			return err
		}
		delete(keys, r.Key)
	}
	for i, r := range geo.Ranking {
		if err := validatePair(r); err != nil {
			return fmt.Errorf("ranking[%d]: %w", i, err)
		}
	}
	if geo.ActiveRegion != nil {
		if err := validatePair(*geo.ActiveRegion); err != nil {
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
