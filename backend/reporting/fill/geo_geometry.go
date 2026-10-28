package reportfill

import (
	"fmt"
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
	for _, f := range g.Features {
		if strings.TrimSpace(f.Key) == "" || keys[f.Key] || strings.TrimSpace(f.Label) == "" || !planarPath.MatchString(f.Path) {
			return fmt.Errorf("geojson geometry has duplicate/empty keys, labels or invalid planar paths")
		}
		keys[f.Key] = true
	}
	for _, r := range geo.Regions {
		if !keys[r.Key] {
			return fmt.Errorf("geojson region %q has no matching geometry", r.Key)
		}
		delete(keys, r.Key)
	}
	return nil
}
