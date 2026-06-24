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
	return &meta.TargetContext{
		Platform:     strings.TrimSpace(query.Get("platform")),
		FormFactor:   strings.TrimSpace(query.Get("formFactor")),
		Surface:      strings.TrimSpace(query.Get("surface")),
		Capabilities: capabilityValuesFromQuery(query["capabilities"]),
	}
}

func capabilityValuesFromQuery(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				result = append(result, trimmed)
			}
		}
	}
	return result
}
