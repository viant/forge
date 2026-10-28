package reportspec

import (
	"fmt"
	"math"
)

func validateCompositeLayout(block Block) error {
	if raw, ok := block.Runtime["spacerHeight"]; ok {
		value, valid := raw.(float64)
		if !valid || value < 0 || value > 10000 || math.IsNaN(value) || len(block.ChildBlockIDs) > 0 || block.Runtime["chrome"] != "none" {
			return fmt.Errorf("composite spacerHeight requires finite nonnegative size, no children and chrome none")
		}
	}
	if chrome, ok := block.Runtime["chrome"]; ok && chrome != "none" && chrome != "panel" {
		return fmt.Errorf("composite chrome must be none or panel")
	}
	raw, ok := block.Runtime["childWeights"]
	if !ok {
		return nil
	}
	if block.Layout != "responsiveGrid" {
		return fmt.Errorf("composite childWeights require responsiveGrid layout")
	}
	weights, ok := raw.(map[string]any)
	if !ok || len(weights) != len(block.ChildBlockIDs) {
		return fmt.Errorf("composite childWeights require one weight per child")
	}
	total := 0.0
	for _, id := range block.ChildBlockIDs {
		value, ok := weights[id].(float64)
		if !ok || value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
			return fmt.Errorf("composite child %q requires a positive finite weight", id)
		}
		total += value
	}
	if math.IsInf(total, 0) {
		return fmt.Errorf("composite childWeights total is invalid")
	}
	return nil
}
