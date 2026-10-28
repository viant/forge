package reportspec

import (
	"fmt"
	"regexp"
	"strings"
)

var scopeControlPath = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$`)

func validateScopeControlBindings(r *ReportSpec) error {
	if r.Scope == nil {
		return nil
	}
	datasets := map[string]bool{}
	for _, d := range r.Datasets {
		datasets[d.ID] = true
	}
	occupied := map[string]string{}
	ids := map[string]int{}
	for _, p := range r.Scope.Params {
		ids[p.ID]++
	}
	for _, p := range r.Scope.Params {
		if len(p.FilterBindings) > 0 {
			if err := ValidateScopeParamValue(p); err != nil {
				return err
			}
		}
		if len(p.FilterBindings) > 0 && (p.ID == "" || ids[p.ID] != 1) {
			return fmt.Errorf("bound scope controls require unique nonempty IDs")
		}
		for _, b := range p.FilterBindings {
			if !datasets[b.DatasetRef] || !scopeControlPath.MatchString(b.Path) || (b.ValuePath != "" && !scopeControlPath.MatchString(b.ValuePath)) {
				return fmt.Errorf("scope control %q requires a declared dataset and safe filter path", p.ID)
			}
			for _, part := range strings.Split(b.Path+"."+b.ValuePath, ".") {
				if part == "__proto__" || part == "prototype" || part == "constructor" {
					return fmt.Errorf("scope control %q has an unsafe filter path", p.ID)
				}
			}
			key := b.DatasetRef + ":" + b.Path
			for prior, owner := range occupied {
				if key == prior || strings.HasPrefix(key, prior+".") || strings.HasPrefix(prior, key+".") {
					return fmt.Errorf("scope controls %q and %q have overlapping filter bindings", owner, p.ID)
				}
			}
			occupied[key] = p.ID
		}
	}
	return nil
}
