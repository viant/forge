package materializer

// AuthoredDependencyClosureError identifies an incomplete source dependency
// closure. It contains no authored identifiers, fingerprints or private text.
// It does not permit a caller to reconstruct or bypass source provenance.
type AuthoredDependencyClosureError struct{}

func (*AuthoredDependencyClosureError) Error() string {
	return "incomplete authored report dependency closure"
}

// AuthoredDependencyClosureMissing exposes a code-owned category to hosts
// without requiring them to inspect private error messages.
func (*AuthoredDependencyClosureError) AuthoredDependencyClosureMissing() bool {
	return true
}
