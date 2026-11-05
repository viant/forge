package reportspec

import (
	"fmt"
	"regexp"
	"strings"
)

var datePresetAlias = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*$`)

// Calendar metadata and caching are validated by the window host, which owns
// the datasource registry. The report contract admits only the shared declaration.
func validateScopeDatePresets(p ScopeParam, params []ScopeParam) error {
	d := p.DatePresets
	if d == nil {
		return nil
	}
	fail := func() error { return fmt.Errorf("scope control %q has invalid date-preset metadata", p.ID) }
	safe := func(s string) bool {
		return datePresetAlias.MatchString(s) && s != "__proto__" && s != "prototype" && s != "constructor" && s != "backend" && s != "credentials" && s != "secretRef" && s != "service" && s != "method" && s != "source"
	}
	path := func(s string) bool {
		if len(s) > 256 || len(strings.Split(s, ".")) > 8 {
			return false
		}
		for _, part := range strings.Split(s, ".") {
			if !safe(part) {
				return false
			}
		}
		return true
	}
	if p.Kind != "dateRange" || len(p.FilterBindings) == 0 || !safe(d.Calendar.DataSourceRef) || !safe(d.Calendar.Input.Name) || !safe(d.Calendar.Input.Parameter) || !path(d.Calendar.IdentityField) || !path(d.Calendar.TimeZoneField) || (d.Calendar.AnchorField != nil && !path(*d.Calendar.AnchorField)) || len(d.Options) < 1 || len(d.Options) > 16 {
		return fail()
	}
	if d.ValueParameter != "" {
		if !safe(d.ValueParameter) || d.ValueParameter == d.Calendar.Input.Parameter || d.ValueParameter == p.ID {
			return fail()
		}
		found := false
		for _, other := range params {
			if other.ID == d.ValueParameter && len(other.FilterBindings) > 0 && !other.Multiple && other.DatePresets == nil {
				if other.Kind == "text" {
					found = true
					continue
				}
				if len(other.Options) == 0 {
					continue
				}
				found = true
				for _, option := range d.Options {
					matches := false
					for _, choice := range other.Options {
						if value, ok := choice.Value.(string); ok && value == option.Value {
							matches = true
						}
					}
					if !matches {
						found = false
					}
				}
			}
		}
		if !found {
			return fail()
		}
	}
	seen := map[string]bool{}
	custom, defaultFound := false, false
	for _, option := range d.Options {
		folded := strings.ToLower(option.Value)
		if !safe(option.Value) || seen[folded] || strings.TrimSpace(option.Label) == "" || len(option.Label) > 160 {
			return fail()
		}
		seen[folded] = true
		if folded == "custom" {
			if option.Value != "custom" || option.Range != nil {
				return fail()
			}
			custom = true
		}
		if option.Value == d.Default && option.Value != "custom" {
			defaultFound = true
		}
		if r := option.Range; r != nil {
			if (r.Anchor != nil && *r.Anchor != "sourceDate") || (r.Anchor != nil && *r.Anchor == "sourceDate" && d.Calendar.AnchorField == nil) || r.Kind != "relativeDays" || r.StartOffset == nil || r.EndOffset == nil || *r.StartOffset < -36600 || *r.EndOffset > 0 || *r.StartOffset > *r.EndOffset {
				return fail()
			}
		} else if option.Value != "custom" && option.Value != "yesterday" && option.Value != "month_to_date" && option.Value != "last_month" {
			return fail()
		}
	}
	if !custom || !defaultFound {
		return fail()
	}
	return nil
}
