package textwrap

import (
	"reflect"
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

func TestMeasuredHeaderWhitespaceMatchesPrintModelBudget(t *testing.T) {
	for _, tc := range []struct {
		name, text string
		width      float64
		want       []string
	}{
		{"seven_lines", "Conversion Date Extrapolated Prior Period Control Conversion Sales Amount", 63.52179775280898, []string{"Conversion", "Date", "Extrapolated", "Prior Period", "Control", "Conversion", "Sales Amount"}},
		{"narrow_seven_lines", "Conversion Date Prior Period Control Conversion Sales Amount", 53.44179775280898, []string{"Conversion", "Date Prior", "Period", "Control", "Conversion", "Sales", "Amount"}},
		{"two_lines", "Conversion Date Prior Period Conversion Sales Amount", 141.85756097560977, []string{"Conversion Date Prior Period", "Conversion Sales Amount"}},
		{"five_lines", "Post Click Control Conversion Sales Amount", 51.57333333333333, []string{"Post Click", "Control", "Conversion", "Sales", "Amount"}},
		{"normalized_whitespace", "  Prior \t Period  \n \nSales   Amount  ", 63.52179775280898, []string{"Prior Period", "", "Sales Amount"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Lines(tc.text, tc.width, 9); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("wrapped lines = %#v, want measured %#v", got, tc.want)
			}
		})
	}
}

func TestWhitespaceBudgetPreservesNaturalBreaksAndLongTokens(t *testing.T) {
	for _, tc := range []struct {
		text  string
		width float64
		want  []string
	}{
		{"Alpha-Beta>Gamma<br>Delta Epsilon", 48, []string{"Alpha-", "Beta>", "Gamma", "Delta", "Epsilon"}},
		{"ABCDEFGHIJ", 18, []string{"ABC", "DEF", "GHI", "J"}},
		{"One\r\n\r\nTwo", 48, []string{"One", "", "Two"}},
	} {
		if got := Lines(tc.text, tc.width, 9); !reflect.DeepEqual(got, tc.want) {
			t.Fatalf("%q wrapped lines = %#v, want %#v", tc.text, got, tc.want)
		}
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
