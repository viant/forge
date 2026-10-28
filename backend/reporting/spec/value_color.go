package reportspec

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

type ValueColorDomain struct {
	Mode      string   `json:"mode"`
	Center    *float64 `json:"center,omitempty"`
	FullRange *bool    `json:"fullRange,omitempty"`
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
}
type ValueColorSpec struct {
	Field   string           `json:"field"`
	Colors  []string         `json:"colors"`
	Domain  ValueColorDomain `json:"domain"`
	Reverse bool             `json:"reverse,omitempty"`
	Opacity *float64         `json:"opacity,omitempty"`
}
type ResolvedValueColor struct {
	Field   string    `json:"field"`
	Colors  []string  `json:"colors"`
	Domain  []float64 `json:"domain"`
	Opacity float64   `json:"opacity"`
}

var valueColorHex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func validateValueColorStops(field string, colors []string) error {
	if strings.TrimSpace(field) == "" || len(colors) < 2 || len(colors) > 64 {
		return fmt.Errorf("value color requires a field and 2–64 stops")
	}
	for _, color := range colors {
		if !valueColorHex.MatchString(color) {
			return fmt.Errorf("value color stops must be six-digit hex")
		}
	}
	return nil
}
func finiteColorValue(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func (c *ValueColorSpec) Validate() error {
	if c == nil {
		return nil
	}
	if err := validateValueColorStops(c.Field, c.Colors); err != nil {
		return err
	}
	if c.Opacity != nil && (!finiteColorValue(*c.Opacity) || *c.Opacity < 0 || *c.Opacity > 1) {
		return fmt.Errorf("invalid value color opacity")
	}
	d := c.Domain
	switch d.Mode {
	case "extent":
		if d.Center != nil || d.FullRange != nil || d.Min != nil || d.Max != nil {
			return fmt.Errorf("extent color domain has no authored bounds")
		}
	case "diverging":
		if d.Center == nil || !finiteColorValue(*d.Center) || d.FullRange == nil || d.Min != nil || d.Max != nil || len(c.Colors)%2 != 1 {
			return fmt.Errorf("diverging domain requires center, fullRange and odd stop count")
		}
	case "fixed":
		if d.Min == nil || d.Max == nil || !finiteColorValue(*d.Min) || !finiteColorValue(*d.Max) || *d.Min >= *d.Max || d.Center != nil || d.FullRange != nil {
			return fmt.Errorf("fixed domain requires increasing finite bounds")
		}
	default:
		return fmt.Errorf("unknown value color domain")
	}
	return nil
}
func (c *ResolvedValueColor) Validate() error {
	if c == nil {
		return nil
	}
	if err := validateValueColorStops(c.Field, c.Colors); err != nil {
		return err
	}
	if !finiteColorValue(c.Opacity) || c.Opacity < 0 || c.Opacity > 1 {
		return fmt.Errorf("invalid resolved color opacity")
	}
	if c.Domain != nil {
		if len(c.Domain) != 2 && len(c.Domain) != 3 {
			return fmt.Errorf("invalid resolved color domain")
		}
		for i, v := range c.Domain {
			if !finiteColorValue(v) || i > 0 && v < c.Domain[i-1] {
				return fmt.Errorf("invalid resolved color bounds")
			}
		}
	}
	return nil
}
