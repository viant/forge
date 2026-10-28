package reportprint

import (
	"strconv"
	"strings"
)

// TextEmphasis interprets the existing print fontWeight contract consistently
// across exports, including combined values such as "bold italic".
func TextEmphasis(weight string) (bold, italic bool) {
	normalized := strings.ToLower(strings.TrimSpace(weight))
	bold = strings.Contains(normalized, "bold")
	italic = strings.Contains(normalized, "italic") || strings.Contains(normalized, "oblique")
	for _, token := range strings.Fields(normalized) {
		if numeric, err := strconv.Atoi(token); err == nil && numeric >= 600 {
			bold = true
		}
	}
	return
}
