package types

import "github.com/tiendc/go-deepcopy"

// cloneJSONMetadata detaches an already decoded JSON metadata tree. Callers must
// supply only JSON-origin values; source types cannot contain cycles or executable
// values. The existing copier preserves native numbers, raw bytes and pointers.
func cloneJSONMetadata[T any](source T) (T, error) {
	var copy T
	err := deepcopy.Copy(&copy, &source, deepcopy.CopyViaCopyingMethod(false))
	return copy, err
}
