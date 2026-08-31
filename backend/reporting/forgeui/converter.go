package forgeui

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/viant/forge/backend/reporting/fenced"
)

type Request struct {
	ReportID    string
	Title       string
	UI          json.RawMessage
	DataSources map[string]json.RawMessage
}

var unsafeSegment = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func BuildFences(request Request) ([]fenced.Fence, error) {
	var ui map[string]any
	if len(request.UI) == 0 || json.Unmarshal(request.UI, &ui) != nil {
		return nil, fmt.Errorf("forge UI must be a JSON object")
	}
	reportID := safeSegment(request.ReportID, "forge_ui_report")
	title := strings.TrimSpace(request.Title)
	if title == "" {
		title = text(ui["title"], "Forge UI report")
	}
	converter := &converter{
		dataSources: request.DataSources,
		refMap:      map[string]string{},
		usedIDs:     map[string]int{},
	}
	for ref := range request.DataSources {
		converter.refMap[ref] = safeSegment(ref, "data")
	}
	containers := objectSlice(ui["containers"])
	if view, ok := ui["view"].(map[string]any); ok {
		if content, ok := view["content"].(map[string]any); ok {
			containers = objectSlice(content["containers"])
		}
	}
	if content, ok := ui["content"].(map[string]any); ok {
		containers = objectSlice(content["containers"])
	}
	if len(containers) == 0 {
		containers = []map[string]any{ui}
	}
	blocks := converter.convertContainers(containers)
	if len(blocks) == 0 {
		return nil, fmt.Errorf("forge UI does not contain printable content")
	}
	scope := safeSegment("feed_"+reportID, "message")
	sequence := 1
	start := map[string]any{
		"version": 1, "scope": scope, "id": reportID, "sequence": sequence,
		"mode": "start", "grammar": "report-document-v1", "title": title, "blocks": blocks,
	}
	sequence++
	fences := []fenced.Fence{{Kind: "forge-report", Index: 0, Payload: mustJSON(start)}}
	refs := converter.referencedDataSourceRefs(blocks)
	for _, ref := range refs {
		rows := normalizeRows(request.DataSources[converter.originalRef(ref)])
		payload := map[string]any{
			"version": 2, "scope": scope, "reportRef": reportID, "sequence": sequence,
			"id": ref, "format": "json", "mode": "replace", "data": rows,
		}
		sequence++
		fences = append(fences, fenced.Fence{Kind: "forge-data", Index: len(fences), Payload: mustJSON(payload)})
	}
	fences = append(fences, fenced.Fence{Kind: "forge-report", Index: len(fences), Payload: mustJSON(map[string]any{
		"version": 1, "scope": scope, "id": reportID, "sequence": sequence, "mode": "commit",
	})})
	return fences, nil
}

type converter struct {
	dataSources map[string]json.RawMessage
	refMap      map[string]string
	usedIDs     map[string]int
}

func (c *converter) convertContainers(containers []map[string]any) []any {
	var result []any
	for _, container := range containers {
		result = append(result, c.convertContainer(container)...)
	}
	return result
}

func (c *converter) convertContainer(container map[string]any) []any {
	kind := strings.TrimSpace(fmt.Sprint(container["kind"]))
	children := objectSlice(container["containers"])
	if tabs, ok := container["tabs"].(map[string]any); ok && tabs != nil {
		var result []any
		for _, tab := range children {
			result = append(result, c.composite(tab, objectSlice(tab["containers"]))...)
		}
		return result
	}
	if kind == "dashboard.detail" || (kind == "dashboard.report" && len(children) > 0) {
		return c.composite(container, children)
	}
	if kind == "dashboard.filters" {
		return nil
	}
	if kind == "dashboard.summary" {
		if blocks := c.summaryBlocks(container); len(blocks) > 0 {
			return blocks
		}
	}
	if ref := strings.TrimSpace(fmt.Sprint(container["dataSourceRef"])); ref != "" {
		return []any{c.tableBlock(container, ref)}
	}
	if len(children) > 0 {
		return c.convertContainers(children)
	}
	title := text(container["title"], "")
	if title == "" {
		return nil
	}
	id := c.uniqueID(text(container["id"], title), "section")
	return []any{map[string]any{
		"id": id, "kind": "markdownBlock", "title": title,
		"markdown": text(container["subtitle"], title),
	}}
}

func (c *converter) composite(container map[string]any, children []map[string]any) []any {
	converted := c.convertContainers(children)
	if len(converted) == 0 {
		return c.convertContainer(withoutChildren(container))
	}
	id := c.uniqueID(text(container["id"], text(container["title"], "section")), "section")
	childIDs := make([]any, 0, len(converted))
	for _, block := range converted {
		if object, ok := block.(map[string]any); ok {
			childIDs = append(childIDs, object["id"])
		}
	}
	return append([]any{map[string]any{
		"id": id, "kind": "compositeBlock", "title": text(container["title"], humanize(id)),
		"childBlockIds": childIDs,
	}}, converted...)
}

func (c *converter) summaryBlocks(container map[string]any) []any {
	ref := strings.TrimSpace(fmt.Sprint(container["dataSourceRef"]))
	if ref == "" {
		return nil
	}
	datasetRef := c.dataRef(ref)
	metrics := objectSlice(container["metrics"])
	result := make([]any, 0, len(metrics))
	for index, metric := range metrics {
		field := strings.TrimPrefix(text(metric["selector"], "value"), "0.")
		id := c.uniqueID(text(metric["id"], fmt.Sprintf("summary_%d", index+1)), "summary")
		label := text(metric["label"], humanize(field))
		block := map[string]any{
			"id": id, "kind": "kpiBlock", "title": label, "datasetRef": datasetRef,
			"valueField": field, "valueLabel": label,
		}
		if format := strings.TrimSpace(fmt.Sprint(metric["format"])); format != "" {
			block["valueFormat"] = format
		}
		result = append(result, block)
	}
	return result
}

func (c *converter) tableBlock(container map[string]any, ref string) map[string]any {
	id := c.uniqueID(text(container["id"], text(container["title"], "table")), "table")
	return map[string]any{
		"id": id, "kind": "tableBlock", "title": text(container["title"], humanize(id)),
		"datasetRef": c.dataRef(ref), "columns": c.columns(container, ref),
	}
}

func (c *converter) columns(container map[string]any, ref string) []any {
	var result []any
	for _, column := range objectSlice(container["columns"]) {
		key := text(column["key"], text(column["id"], text(column["name"], "")))
		if key == "" {
			continue
		}
		item := map[string]any{"key": key, "label": text(column["label"], text(column["name"], humanize(key)))}
		if format := strings.TrimSpace(fmt.Sprint(column["format"])); format != "" {
			item["format"] = format
		}
		result = append(result, item)
	}
	if len(result) > 0 {
		return result
	}
	rows := normalizeRows(c.dataSources[ref])
	keys := map[string]bool{}
	for _, row := range rows {
		if object, ok := row.(map[string]any); ok {
			for key := range object {
				keys[key] = true
			}
		}
	}
	ordered := make([]string, 0, len(keys))
	for key := range keys {
		ordered = append(ordered, key)
	}
	sort.Strings(ordered)
	if len(ordered) == 0 {
		ordered = []string{"value"}
	}
	for _, key := range ordered {
		result = append(result, map[string]any{"key": key, "label": humanize(key)})
	}
	return result
}

func (c *converter) dataRef(ref string) string {
	if mapped := c.refMap[ref]; mapped != "" {
		return mapped
	}
	mapped := safeSegment(ref, "data")
	c.refMap[ref] = mapped
	return mapped
}

func (c *converter) originalRef(mapped string) string {
	for original, candidate := range c.refMap {
		if candidate == mapped {
			return original
		}
	}
	return mapped
}

func (c *converter) uniqueID(value, fallback string) string {
	base := safeSegment(value, fallback)
	c.usedIDs[base]++
	if c.usedIDs[base] == 1 {
		return base
	}
	return fmt.Sprintf("%s_%d", base, c.usedIDs[base])
}

func (c *converter) referencedDataSourceRefs(blocks []any) []string {
	set := map[string]bool{}
	for _, block := range blocks {
		if object, ok := block.(map[string]any); ok {
			if value, exists := object["datasetRef"]; exists {
				ref := text(value, "")
				if ref == "" {
					continue
				}
				set[ref] = true
			}
		}
	}
	result := make([]string, 0, len(set))
	for ref := range set {
		result = append(result, ref)
	}
	sort.Strings(result)
	return result
}

func normalizeRows(raw json.RawMessage) []any {
	if len(raw) == 0 {
		return []any{}
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return []any{}
	}
	if rows, ok := value.([]any); ok {
		return rows
	}
	if object, ok := value.(map[string]any); ok {
		if rows, ok := object["collection"].([]any); ok && len(rows) > 0 {
			return rows
		}
		if form, ok := object["form"].(map[string]any); ok && len(form) > 0 {
			return []any{form}
		}
		return []any{object}
	}
	return []any{}
}

func objectSlice(value any) []map[string]any {
	values, _ := value.([]any)
	result := make([]map[string]any, 0, len(values))
	for _, value := range values {
		if object, ok := value.(map[string]any); ok {
			result = append(result, object)
		}
	}
	return result
}

func withoutChildren(source map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range source {
		if key != "containers" && key != "tabs" {
			result[key] = value
		}
	}
	return result
}

func safeSegment(value, fallback string) string {
	value = strings.Trim(unsafeSegment.ReplaceAllString(strings.TrimSpace(value), "_"), "_")
	if value == "" {
		return fallback
	}
	return value
}

func text(value any, fallback string) string {
	result := strings.TrimSpace(fmt.Sprint(value))
	if result == "" || result == "<nil>" {
		return fallback
	}
	return result
}

func humanize(value string) string {
	value = strings.TrimSpace(strings.NewReplacer("_", " ", "-", " ").Replace(value))
	if value == "" {
		return "Value"
	}
	return strings.ToUpper(value[:1]) + value[1:]
}

func mustJSON(value any) json.RawMessage {
	data, _ := json.Marshal(value)
	return data
}
