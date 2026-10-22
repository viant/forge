package service

import (
	"context"
	"testing"
)

func TestWindowRoleLookupPreservesLiteralMembership(t *testing.T) {
	for _, tc := range []struct {
		name     string
		actual   []string
		required []string
		allowed  bool
	}{
		{"exact alternative", []string{"reader", "reader"}, []string{"other", "reader"}, true},
		{"case sensitive", []string{"Reader"}, []string{"reader"}, false},
		{"star does not grant everything", []string{"*"}, []string{"reader"}, false},
		{"star matches literally", []string{"*"}, []string{"*"}, true},
		{"empty roles deny", nil, []string{"reader"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			catalog := &MetadataWindowCatalog{roles: func(context.Context) ([]string, error) { return tc.actual, nil }}
			allowed, err := catalog.checkEntryAccess(context.Background(), SavedWindow{Roles: tc.required})
			if err != nil || allowed != tc.allowed {
				t.Fatalf("allowed=%v err=%v", allowed, err)
			}
		})
	}
}
