package reportprint

import "testing"

func TestTextEmphasis(t *testing.T) {
	for _, tc := range []struct {
		value        string
		bold, italic bool
	}{
		{"", false, false}, {"normal", false, false}, {"400", false, false},
		{"600", true, false}, {"800", true, false}, {"bold", true, false},
		{"italic", false, true}, {"oblique", false, true},
		{"bold italic", true, true}, {" 700 OBLIQUE ", true, true},
	} {
		t.Run(tc.value, func(t *testing.T) {
			bold, italic := TextEmphasis(tc.value)
			if bold != tc.bold || italic != tc.italic {
				t.Fatalf("got (%v,%v), want (%v,%v)", bold, italic, tc.bold, tc.italic)
			}
		})
	}
}
