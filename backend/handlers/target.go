package handlers

import (
	"net/http"
	"strings"

	"github.com/viant/forge/backend/service/meta"
)

func targetContextFromRequest(r *http.Request) *meta.TargetContext {
	if r == nil {
		return nil
	}
	query := r.URL.Query()
	capabilities := query["capabilities"]
	if len(capabilities) == 1 && strings.Contains(capabilities[0], ",") {
		capabilities = strings.Split(capabilities[0], ",")
	}
	for index, value := range capabilities {
		capabilities[index] = strings.TrimSpace(value)
	}
	return &meta.TargetContext{
		Platform:     strings.TrimSpace(query.Get("platform")),
		FormFactor:   strings.TrimSpace(query.Get("formFactor")),
		Surface:      strings.TrimSpace(query.Get("surface")),
		Capabilities: compactStrings(capabilities),
	}
}

func compactStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
