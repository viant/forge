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
		if strings.EqualFold(strings.ReplaceAll(reportTimeString(relative["preset"]), "_", ""), "previousperiod") {
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
	entries := make([]map[string]interface{}, 0, len(datasets))
	for _, item := range datasets {
		dataset, _ := item.(map[string]interface{})
		entries = append(entries, dataset)
	}
	if err := applyReportPreviousPeriods(entries); err != nil {
		return nil, err
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

// The comparison interval is anchored to the primary request, never the clock or
// the secondary dataset's already-resolved dates, so recompilation is idempotent.
func resolveReportPreviousPeriod(start, end string) (string, string, error) {
	from, err := time.Parse("2006-01-02", start)
	if err != nil {
		return "", "", fmt.Errorf("previous period requires a valid bounded civil date range")
	}
	to, err := time.Parse("2006-01-02", end)
	if err != nil || from.After(to) {
		return "", "", fmt.Errorf("previous period requires a valid bounded civil date range")
	}
	days := int((to.Unix()-from.Unix())/86400) + 1
	prior := from.AddDate(0, 0, -days)
	if prior.Year() < 1 {
		return "", "", fmt.Errorf("previous period exceeds the supported civil date range")
	}
	return prior.Format("2006-01-02"), from.AddDate(0, 0, -1).Format("2006-01-02"), nil
}

func reportRequestPath(request map[string]interface{}, path string) string {
	var value interface{} = request
	for _, part := range strings.Split(path, ".") {
		object, _ := value.(map[string]interface{})
		value = object[part]
	}
	return reportTimeString(value)
}

// Also called after execution parameter binding: filters submitted with a fresh
// run must update both periods before datasource admission and dispatch.
func applyReportPreviousPeriods(datasets []map[string]interface{}) error {
	var primaryRequest map[string]interface{}
	for _, dataset := range datasets {
		if reportTimeString(dataset["id"]) == "primary" {
			primaryRequest, _ = dataset["request"].(map[string]interface{})
		}
	}
	for _, dataset := range datasets {
		scope, _ := dataset["scope"].(map[string]interface{})
		relative, _ := scope["relativeDateRange"].(map[string]interface{})
		if !strings.EqualFold(strings.ReplaceAll(reportTimeString(relative["preset"]), "_", ""), "previousperiod") {
			continue
		}
		if reportTimeString(dataset["id"]) == "primary" || reportTimeString(scope["mode"]) != "override" {
			return fmt.Errorf("previous period requires a secondary dataset with scope mode override")
		}
		request, _ := dataset["request"].(map[string]interface{})
		if request == nil {
			return fmt.Errorf("previous period requires a dataset request")
		}
		startPath, endPath := reportTimeString(relative["startParamPath"]), reportTimeString(relative["endParamPath"])
		start, end, err := resolveReportPreviousPeriod(reportRequestPath(primaryRequest, startPath), reportRequestPath(primaryRequest, endPath))
		if err != nil {
			return fmt.Errorf("dataset %q: %w", reportTimeString(dataset["id"]), err)
		}
		if err = setReportRequestPath(request, startPath, start); err != nil {
			return err
		}
		if err = setReportRequestPath(request, endPath, end); err != nil {
			return err
		}
	}
	return nil
}
