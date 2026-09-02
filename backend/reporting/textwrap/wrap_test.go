package textwrap

import (
	"strings"
	"testing"
)

func TestLinesUsesExplicitAndNaturalBreakPointsWithoutDroppingText(t *testing.T) {
	input := "Alpha-Beta>Gamma<br>Delta Epsilon"
	lines := Lines(input, 48, 10)
	joined := strings.ReplaceAll(strings.Join(lines, ""), " ", "")
	if joined != "Alpha-Beta>GammaDeltaEpsilon" {
		t.Fatalf("wrapped text = %q from %#v", joined, lines)
	}
	if len(lines) < 3 {
		t.Fatalf("lines = %#v, want multiple delimiter-aware lines", lines)
	}
}
