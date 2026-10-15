package reporting

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/viant/toolbox"
)

func expandReportSpecTimeSemantics(document json.RawMessage, now time.Time) (json.RawMessage, error) {
	var root map[string]interface{}
	if err := json.Unmarshal(document, &root); err != nil {
		return nil, err
	}
	datasets, _ := root["datasets"].([]interface{})
	for _, item := range datasets {
		dataset, _ := item.(map[string]interface{})
		scope, _ := dataset["scope"].(map[string]interface{})
		relative, _ := scope["relativeDateRange"].(map[string]interface{})
		request, _ := dataset["request"].(map[string]interface{})
		if relative == nil || request == nil {
			continue
		}
		startExpression, endExpression := reportDateRangeExpressions(relative)
		if startExpression == "" || endExpression == "" {
			continue
		}
		start, err := resolveReportSemanticTime(now, startExpression, reportTimeString(relative["format"]))
		if err != nil {
			return nil, fmt.Errorf("dataset %q relative date start: %w", reportTimeString(dataset["id"]), err)
		}
		end, err := resolveReportSemanticTime(now, endExpression, reportTimeString(relative["format"]))
		if err != nil {
			return nil, fmt.Errorf("dataset %q relative date end: %w", reportTimeString(dataset["id"]), err)
		}
		if err = setReportRequestPath(request, reportTimeString(relative["startParamPath"]), start); err != nil {
			return nil, err
		}
		if err = setReportRequestPath(request, reportTimeString(relative["endParamPath"]), end); err != nil {
			return nil, err
		}
	}
	result, err := json.Marshal(root)
	return json.RawMessage(result), err
}

func reportDateRangeExpressions(relative map[string]interface{}) (string, string) {
	if start, end := reportTimeString(relative["startExpression"]), reportTimeString(relative["endExpression"]); start != "" && end != "" {
		return start, end
	}
	switch strings.ToLower(strings.ReplaceAll(reportTimeString(relative["preset"]), "_", "")) {
	case "today":
		return "today", "today"
	case "yesterday":
		return "yesterday", "yesterday"
	case "last3days", "3d":
		return "2 days ago", "today"
	case "last7days", "7d":
		return "6 days ago", "today"
	case "last30days", "30d":
		return "29 days ago", "today"
	default:
		return "", ""
	}
}

func resolveReportSemanticTime(now time.Time, expression, format string) (string, error) {
	expression = strings.TrimSpace(expression)
	if strings.HasPrefix(strings.ToLower(expression), "today") {
		expression = "now" + expression[len("today"):]
	}
	value, err := toolbox.TimeDiff(now, expression)
	if err != nil {
		return "", err
	}
	if strings.EqualFold(strings.TrimSpace(format), "dateTime") {
		return value.Format(time.RFC3339), nil
	}
	return value.Format("2006-01-02"), nil
}

func setReportRequestPath(target map[string]interface{}, path string, value interface{}) error {
	parts := strings.Split(strings.TrimSpace(path), ".")
	if len(parts) == 0 || strings.TrimSpace(path) == "" {
		return fmt.Errorf("relative date request path is required")
	}
	cursor := target
	for _, part := range parts[:len(parts)-1] {
		part = strings.TrimSpace(part)
		if part == "" {
			return fmt.Errorf("invalid relative date request path %q", path)
		}
		next, _ := cursor[part].(map[string]interface{})
		if next == nil {
			next = map[string]interface{}{}
			cursor[part] = next
		}
		cursor = next
	}
	cursor[strings.TrimSpace(parts[len(parts)-1])] = value
	return nil
}

func reportTimeString(value interface{}) string {
	result, _ := value.(string)
	return strings.TrimSpace(result)
}
