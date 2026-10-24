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

func TestNarrowHeaderDoesNotAssumeEightCharactersFit(t *testing.T) {
	lines := Lines("Campaign ID", 18, 9)
	if strings.Join(lines, "") != "CampaignID" {
		t.Fatalf("lost header text: %#v", lines)
	}
	for _, line := range lines {
		if len([]rune(line)) > 3 {
			t.Fatalf("header chunk %q exceeds the narrow-cell wrapping budget", line)
		}
	}
}
