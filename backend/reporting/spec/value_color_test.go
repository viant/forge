package reportspec

import "testing"

func TestValueColorExplicitDomain(t *testing.T) {
	c := &ValueColorSpec{Field: "amount", Colors: []string{"#000000", "#808080", "#ffffff"}, Domain: ValueColorDomain{Mode: "extent"}}
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
	center, full := 0.0, false
	c.Domain = ValueColorDomain{Mode: "diverging", Center: &center, FullRange: &full}
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
	c.Domain.FullRange = nil
	if c.Validate() == nil {
		t.Fatal("missing explicit range policy accepted")
	}
	r := &ResolvedValueColor{Field: "amount", Colors: c.Colors, Domain: []float64{-100, 0, 100}, Opacity: 0.5}
	if err := r.Validate(); err != nil {
		t.Fatal(err)
	}
	min, max := 0.0, 10.0
	c.Domain = ValueColorDomain{Mode: "fixed", Min: &min, Max: &max}
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
	c.Domain.Mode = "unknown"
	if c.Validate() == nil {
		t.Fatal("unknown mode accepted")
	}
	c.Domain.Mode = "fixed"
	opacity := 2.0
	c.Opacity = &opacity
	if c.Validate() == nil {
		t.Fatal("invalid opacity accepted")
	}
	r.Domain = []float64{100, 0}
	if r.Validate() == nil {
		t.Fatal("descending domain accepted")
	}
}
