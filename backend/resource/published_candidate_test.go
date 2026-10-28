package resource

import "testing"

func TestPublishedCandidateUsesHashWithoutRevision(t *testing.T) {
	candidate := ResourceCandidate{Kind: PublishedCandidate, ContentFingerprint: ContentFingerprint([]byte(`{"synthetic":true}`))}
	if !candidate.Valid() || candidate.Selector() != "" {
		t.Fatal("published selection must be hash-only")
	}
	candidate.Revision = "7"
	if candidate.Valid() {
		t.Fatal("independent revision accepted")
	}
	candidate.Revision = ""
	candidate.ContentFingerprint = "invalid"
	if candidate.Valid() {
		t.Fatal("invalid hash accepted")
	}
}
