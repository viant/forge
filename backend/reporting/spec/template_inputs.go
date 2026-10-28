package reportspec

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

type TemplateRequestLabel struct {
	Value any    `json:"value"`
	Label string `json:"label"`
}
type TemplateRequestInput struct {
	Path   string                 `json:"path"`
	Labels []TemplateRequestLabel `json:"labels"`
}

var templateInputAlias = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func validateTemplateRequestInputs(block Block) error {
	if len(block.TemplateRequestInputs) == 0 {
		return nil
	}
	if block.DatasetRef == "" {
		return fmt.Errorf("template request inputs require an explicit dataset")
	}
	for alias, input := range block.TemplateRequestInputs {
		if !templateInputAlias.MatchString(alias) || alias == "__proto__" || alias == "prototype" || alias == "constructor" || !scopeControlPath.MatchString(input.Path) || len(input.Labels) == 0 {
			return fmt.Errorf("invalid template request input")
		}
		for _, part := range strings.Split(input.Path, ".") {
			if part == "__proto__" || part == "prototype" || part == "constructor" {
				return fmt.Errorf("unsafe template request input path")
			}
		}
		seen := map[string]bool{}
		for _, label := range input.Labels {
			raw, err := json.Marshal(label.Value)
			if err != nil {
				return err
			}
			var scalar any
			if err = json.Unmarshal(raw, &scalar); err != nil {
				return err
			}
			switch scalar.(type) {
			case string, bool, float64:
			default:
				return fmt.Errorf("template request label value must be a scalar")
			}
			key := string(raw)
			if seen[key] || strings.TrimSpace(label.Label) == "" {
				return fmt.Errorf("duplicate or empty template request label")
			}
			seen[key] = true
			if err = ValidateScopeParamValue(ScopeParam{ID: alias, Value: label.Value}); err != nil {
				return err
			}
		}
	}
	return nil
}
