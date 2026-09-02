package forgeui

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
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
		fieldsByRef: map[string]map[string]bool{},
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
	printContainers := containers
	headerSubtitle := ""
	if tabs := containersWithTabs(containers); len(tabs) > 0 {
		printContainers = tabs
		headerSubtitle = converter.headerSubtitle(containers, title)
	}
	blocks := converter.convertContainers(printContainers)
	if len(blocks) == 0 {
		return nil, fmt.Errorf("forge UI does not contain printable content")
	}
	scope := safeSegment("feed_"+reportID, "message")
	sequence := 1
	start := map[string]any{
		"version": 1, "scope": scope, "id": reportID, "sequence": sequence,
		"mode": "start", "grammar": "report-document-v1", "title": title, "blocks": blocks,
	}
	if headerSubtitle != "" {
		start["subtitle"] = headerSubtitle
	}
	sequence++
	fences := []fenced.Fence{{Kind: "forge-report", Index: 0, Payload: mustJSON(start)}}
	refs := converter.referencedDataSourceRefs(blocks)
	for _, ref := range refs {
		original := converter.originalRef(ref)
		rows := converter.filterRows(original, normalizeRows(request.DataSources[original]))
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

func containersWithTabs(containers []map[string]any) []map[string]any {
	result := make([]map[string]any, 0)
	for _, container := range containers {
		if tabs, ok := container["tabs"].(map[string]any); ok && tabs != nil {
			result = append(result, container)
		}
	}
	return result
}

type converter struct {
	dataSources map[string]json.RawMessage
	refMap      map[string]string
	usedIDs     map[string]int
	fieldsByRef map[string]map[string]bool
}

func (c *converter) convertContainers(containers []map[string]any) []any {
	var result []any
	for _, container := range containers {
		result = append(result, c.convertContainer(container)...)
	}
	return result
}

func (c *converter) convertContainer(container map[string]any) []any {
	if !c.visible(container) {
		return nil
	}
	kind := strings.TrimSpace(fmt.Sprint(container["kind"]))
	children := objectSlice(container["containers"])
	if tabs, ok := container["tabs"].(map[string]any); ok && tabs != nil {
		return c.tabBlocks(container, tabs, children)
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
	if chart, ok := container["chart"].(map[string]any); ok && chart != nil {
		if block := c.chartBlock(container, chart); block != nil {
			return []any{block}
		}
	}
	if schemaForm, ok := container["schemaBasedForm"].(map[string]any); ok && schemaForm != nil {
		if block := c.schemaFormBlock(container, schemaForm); block != nil {
			return []any{block}
		}
	}
	if len(objectSlice(container["items"])) > 0 {
		if block := c.itemsBlock(container); block != nil {
			return []any{block}
		}
	}
	if len(children) > 0 {
		return c.composite(container, children)
	}
	if ref := strings.TrimSpace(fmt.Sprint(container["dataSourceRef"])); ref != "" {
		return []any{c.tableBlock(container, ref)}
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
	return append([]any{map[string]any{
		"id": id, "kind": "sectionBlock", "title": text(container["title"], humanize(id)),
		"navigationLabel": text(container["title"], humanize(id)),
	}}, converted...)
}

func (c *converter) tabBlocks(container, tabs map[string]any, children []map[string]any) []any {
	if len(children) == 0 {
		return nil
	}
	sectionIDs := make([]any, 0, len(children))
	sections := make([]any, 0, len(children)*2)
	for _, tab := range children {
		id := c.uniqueID(text(tab["id"], text(tab["title"], "tab")), "tab")
		title := text(tab["title"], humanize(id))
		sectionIDs = append(sectionIDs, id)
		sections = append(sections, map[string]any{
			"id": id, "kind": "sectionBlock", "title": title, "navigationLabel": title,
		})
		if nested := objectSlice(tab["containers"]); len(nested) > 0 {
			sections = append(sections, c.convertContainers(nested)...)
		} else {
			sections = append(sections, c.convertContainer(withoutChildren(tab))...)
		}
	}
	defaultID := text(tabs["defaultSelectedTabId"], "")
	if defaultID == "" && len(sectionIDs) > 0 {
		defaultID = fmt.Sprint(sectionIDs[0])
	}
	groupID := c.uniqueID(text(container["id"], "tabs")+"_navigation", "tabs")
	group := map[string]any{
		"id": groupID, "kind": "tabGroupBlock", "title": text(container["title"], "Report sections"),
		"sectionIds": sectionIDs, "defaultSectionId": defaultID,
	}
	return append([]any{group}, sections...)
}

func (c *converter) visible(container map[string]any) bool {
	condition, _ := container["visibleWhen"].(map[string]any)
	if condition == nil {
		return true
	}
	field := text(condition["field"], "")
	if field == "" {
		return true
	}
	ref := text(container["dataSourceRef"], "")
	rows := normalizeRows(c.dataSources[ref])
	if len(rows) == 0 {
		return false
	}
	value := resolvePath(rows[0], field)
	return strings.TrimSpace(fmt.Sprint(value)) != ""
}

func (c *converter) headerSubtitle(containers []map[string]any, reportTitle string) string {
	parts := make([]string, 0)
	for _, container := range containers {
		if tabs, ok := container["tabs"].(map[string]any); ok && tabs != nil {
			continue
		}
		ref := text(container["dataSourceRef"], "")
		rows := normalizeRows(c.dataSources[ref])
		if len(rows) == 0 {
			continue
		}
		for _, item := range objectSlice(container["items"]) {
			field := text(item["dataField"], text(item["field"], text(item["id"], "")))
			if field == "" {
				continue
			}
			value := strings.TrimSpace(fmt.Sprint(printableValue(resolvePath(rows[0], field))))
			if value == "" || value == "—" {
				continue
			}
			label := text(item["label"], "")
			if strings.Contains(strings.ToLower(reportTitle), strings.ToLower(value)) {
				continue
			}
			if label == "" || strings.EqualFold(label, "Media plan") {
				parts = append(parts, value)
			} else {
				parts = append(parts, label+" "+value)
			}
		}
	}
	return strings.Join(parts, " · ")
}

func (c *converter) chartBlock(container, chart map[string]any) map[string]any {
	ref := text(container["dataSourceRef"], "")
	if ref == "" {
		return nil
	}
	series, _ := chart["series"].(map[string]any)
	nameKey := text(series["nameKey"], text(series["xField"], "label"))
	valueKey := text(series["valueKey"], "value")
	c.trackFields(ref, nameKey, valueKey)
	chartSpec := map[string]any{
		"type": text(chart["type"], "bar"), "title": text(container["title"], "Chart"),
		"xField": nameKey, "yFields": []any{valueKey},
	}
	if palette := series["palette"]; palette != nil {
		chartSpec["palette"] = palette
	}
	return map[string]any{
		"id": c.uniqueID(text(container["id"], "chart"), "chart"), "kind": "chartBlock",
		"title": text(container["title"], "Chart"), "datasetRef": c.dataRef(ref), "chartSpec": chartSpec,
	}
}

func (c *converter) itemsBlock(container map[string]any) map[string]any {
	ref := text(container["dataSourceRef"], "")
	rows := normalizeRows(c.dataSources[ref])
	if len(rows) == 0 {
		return nil
	}
	items := make([]any, 0)
	for _, item := range objectSlice(container["items"]) {
		field := text(item["dataField"], text(item["field"], text(item["id"], "")))
		if field == "" {
			continue
		}
		value := printableValue(resolvePath(rows[0], field))
		c.trackFields(ref, strings.Split(field, ".")[0])
		items = append(items, map[string]any{
			"id":    safeSegment(text(item["id"], field), "item"),
			"label": text(item["label"], humanize(field)), "value": value,
			"format": text(item["format"], ""), "tone": "info",
		})
	}
	if len(items) == 0 {
		return nil
	}
	title := text(container["title"], "")
	if title == "" {
		if first, ok := objectSlice(container["items"])[0]["label"].(string); ok {
			title = strings.TrimSpace(first)
		}
	}
	if title == "" {
		title = humanize(text(container["id"], "Details"))
	}
	return map[string]any{
		"id": c.uniqueID(text(container["id"], title), "details"), "kind": "badgesBlock",
		"title": title, "datasetRef": c.dataRef(ref), "items": items,
	}
}

func (c *converter) schemaFormBlock(container, schemaForm map[string]any) map[string]any {
	ref := text(schemaForm["dataSourceRef"], text(container["dataSourceRef"], ""))
	rows := normalizeRows(c.dataSources[ref])
	if len(rows) == 0 {
		return nil
	}
	schema, _ := schemaForm["schema"].(map[string]any)
	properties, _ := schema["properties"].(map[string]any)
	if len(properties) == 0 {
		return nil
	}
	keys := make([]string, 0, len(properties))
	for key := range properties {
		keys = append(keys, key)
	}
	sort.SliceStable(keys, func(i, j int) bool {
		left, _ := properties[keys[i]].(map[string]any)
		right, _ := properties[keys[j]].(map[string]any)
		return number(left["x-ui-order"]) < number(right["x-ui-order"])
	})
	items := make([]any, 0, len(keys))
	for _, key := range keys {
		property, _ := properties[key].(map[string]any)
		item := map[string]any{
			"id": safeSegment(key, "field"), "label": text(property["title"], humanize(key)),
			"value": printableSchemaValue(resolvePath(rows[0], key), property), "tone": "neutral",
		}
		if strings.Contains(strings.ToLower(key), "budget") {
			item["format"] = "currency"
		}
		items = append(items, item)
		c.trackFields(ref, key)
	}
	title := text(container["title"], text(schemaForm["title"], humanize(text(container["id"], "Details"))))
	return map[string]any{
		"id": c.uniqueID(text(container["id"], title), "details"), "kind": "badgesBlock",
		"title": title, "datasetRef": c.dataRef(ref), "items": items,
	}
}

func (c *converter) summaryBlocks(container map[string]any) []any {
	ref := strings.TrimSpace(fmt.Sprint(container["dataSourceRef"]))
	if ref == "" {
		return nil
	}
	datasetRef := c.dataRef(ref)
	metrics := objectSlice(container["metrics"])
	if len(metrics) == 0 {
		metrics = objectSlice(container["items"])
	}
	result := make([]any, 0, len(metrics))
	for index, metric := range metrics {
		field := strings.TrimPrefix(text(metric["selector"], text(metric["field"], text(metric["id"], "value"))), "0.")
		c.trackFields(ref, strings.Split(field, ".")[0])
		id := c.uniqueID(text(metric["id"], fmt.Sprintf("summary_%d", index+1)), "summary")
		label := text(metric["label"], humanize(field))
		block := map[string]any{
			"id": id, "kind": "kpiBlock", "title": label, "datasetRef": datasetRef,
			"valueField": field, "valueLabel": label,
		}
		if format := text(metric["format"], ""); format != "" {
			block["valueFormat"] = format
		}
		result = append(result, block)
	}
	return result
}

func (c *converter) tableBlock(container map[string]any, ref string) map[string]any {
	id := c.uniqueID(text(container["id"], text(container["title"], "table")), "table")
	columns := c.columns(container, ref)
	for _, raw := range columns {
		if column, ok := raw.(map[string]any); ok {
			c.trackFields(ref, text(column["key"], ""))
		}
	}
	return map[string]any{
		"id": id, "kind": "tableBlock", "title": text(container["title"], humanize(id)),
		"datasetRef": c.dataRef(ref), "columns": columns,
	}
}

func (c *converter) columns(container map[string]any, ref string) []any {
	var result []any
	columns := objectSlice(container["columns"])
	sort.SliceStable(columns, func(i, j int) bool {
		left, _ := columns[i]["frozen"].(bool)
		right, _ := columns[j]["frozen"].(bool)
		return left && !right
	})
	for _, column := range columns {
		key := text(column["key"], text(column["id"], text(column["name"], "")))
		if key == "" {
			continue
		}
		item := map[string]any{"key": key, "label": text(column["label"], text(column["name"], humanize(key)))}
		if format := text(column["format"], ""); format != "" {
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

func (c *converter) trackFields(ref string, fields ...string) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return
	}
	if c.fieldsByRef[ref] == nil {
		c.fieldsByRef[ref] = map[string]bool{}
	}
	for _, field := range fields {
		field = strings.TrimSpace(field)
		if field != "" {
			c.fieldsByRef[ref][field] = true
		}
	}
}

func (c *converter) filterRows(ref string, rows []any) []any {
	fields := c.fieldsByRef[strings.TrimSpace(ref)]
	if len(fields) == 0 {
		return rows
	}
	result := make([]any, 0, len(rows))
	for _, row := range rows {
		object, ok := row.(map[string]any)
		if !ok {
			result = append(result, row)
			continue
		}
		filtered := map[string]any{}
		for field := range fields {
			if value, exists := object[field]; exists {
				filtered[field] = value
			}
		}
		result = append(result, filtered)
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
		if rows, ok := object["collection"].([]any); ok {
			return rows
		}
		if form, ok := object["form"].(map[string]any); ok && len(form) > 0 {
			return []any{form}
		}
		return []any{object}
	}
	return []any{}
}

func resolvePath(value any, path string) any {
	current := value
	for _, part := range strings.Split(strings.TrimSpace(path), ".") {
		if part == "" {
			continue
		}
		object, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = object[part]
	}
	return current
}

func printableValue(value any) any {
	switch actual := value.(type) {
	case nil:
		return "—"
	case []any:
		parts := make([]string, 0, len(actual))
		for _, item := range actual {
			parts = append(parts, fmt.Sprint(printableValue(item)))
		}
		return strings.Join(parts, ", ")
	case map[string]any:
		start := text(actual["startDate"], text(actual["start"], ""))
		end := text(actual["endDate"], text(actual["end"], ""))
		if start != "" || end != "" {
			return strings.Trim(strings.TrimSpace(start)+" - "+strings.TrimSpace(end), " -")
		}
		data, _ := json.Marshal(actual)
		return string(data)
	default:
		return actual
	}
}

func printableSchemaValue(value any, property map[string]any) any {
	if text(property["type"], "") == "boolean" {
		if actual, ok := value.(bool); ok {
			if actual {
				return "Yes"
			}
			return "No"
		}
	}
	if options, ok := property["enum"].([]any); ok && len(options) > 0 {
		matched := false
		for _, option := range options {
			if fmt.Sprint(option) == fmt.Sprint(value) {
				matched = true
				break
			}
		}
		if !matched {
			return "—"
		}
	}
	return printableValue(value)
}

func number(value any) float64 {
	switch actual := value.(type) {
	case float64:
		return actual
	case float32:
		return float64(actual)
	case int:
		return float64(actual)
	case int64:
		return float64(actual)
	case json.Number:
		result, _ := actual.Float64()
		return result
	default:
		result, _ := strconv.ParseFloat(strings.TrimSpace(fmt.Sprint(actual)), 64)
		return result
	}
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
