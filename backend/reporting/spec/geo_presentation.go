package reportspec

import "fmt"

// ValidateGeoPresentation validates opt-in presentation metadata independently of
// the producer's geometry and metric semantics.
func ValidateGeoPresentation(geo map[string]any) error {
	if value, exists := geo["summary"]; exists {
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("geo.summary must be boolean")
		}
	}
	if color, ok := geo["color"].(map[string]any); ok {
		if value, exists := color["legendScope"]; exists && value != "declared" && value != "observed" {
			return fmt.Errorf("geo.color.legendScope must be declared or observed")
		}
	}
	return nil
}
