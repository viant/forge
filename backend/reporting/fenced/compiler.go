package fenced

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
)

// Compile assembles fences and lowers the committed report-document-v1
// artifact into the canonical Forge export models.
func Compile(request *CompileRequest) (*CompileResult, error) {
	if request == nil {
		return nil, fmt.Errorf("fenced report compile request is required")
	}
	fences := request.Fences
	if len(fences) == 0 {
		var err error
		fences, err = Parse(request.Content)
		if err != nil {
			return nil, err
		}
	}
	result, err := Assemble(fences, strings.TrimSpace(request.ReportID))
	if err != nil {
		return result, err
	}
	if result.Assembly == nil || result.Assembly.Status != "committed" {
		return result, fmt.Errorf("fenced report must have one committed assembly")
	}
	if result.Assembly.Grammar != "report-document-v1" {
		return result, fmt.Errorf("backend fenced compilation currently requires report-document-v1, got %q", result.Assembly.Grammar)
	}
	document, spec, fill, printArtifact, diagnostics, err := lowerAssembly(result.Assembly)
	result.Diagnostics = append(result.Diagnostics, diagnostics...)
	if err != nil {
		return result, err
	}
	result.ReportDocument = document
	result.ReportSpec = spec
	result.ReportFill = fill
	result.ReportPrint = printArtifact
	return result, nil
}

func lowerAssembly(assembly *Assembly) (json.RawMessage, json.RawMessage, json.RawMessage, json.RawMessage, []Diagnostic, error) {
	title := textValue(assembly.Source["title"])
	if title == "" {
		title = assembly.ID
	}
	source := map[string]any{
		"kind": "dashboard.reportBuilder", "containerId": assembly.ID,
		"stateKey": assembly.ID, "dataSourceRef": primaryDataSourceRef(assembly),
	}
	blocks, err := normalizeBlocks(assembly.Source["blocks"])
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	normalizeSpecBlocks(blocks)
	datasets, fillDatasets, err := buildDatasets(assembly)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	blockOrder := make([]string, 0, len(blocks))
	items := make([]any, 0, len(blocks))
	for _, block := range blocks {
		id := textValue(block["id"])
		blockOrder = append(blockOrder, id)
		items = append(items, map[string]any{"blockId": id})
	}
	specObject := map[string]any{
		"version": 1, "kind": "reportSpec", "source": source, "title": title,
		"parameters":   map[string]any{"viewMode": "table", "groupBy": "", "pageSize": 100, "orderField": "", "orderDir": "asc"},
		"layoutIntent": map[string]any{"kind": "single", "resultPanePosition": "left", "blockOrder": blockOrder, "items": items},
		"refinements":  []any{}, "calculatedFields": []any{}, "datasets": datasets, "blocks": blocks,
	}
	if theme, ok := assembly.Source["theme"].(map[string]any); ok {
		specObject["theme"] = theme
	}
	specRaw, _ := json.Marshal(specObject)
	if _, err = reportspec.DecodeJSON(specRaw); err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("compile fenced reportSpec: %w (document: %s)", err, specRaw)
	}
	fillBlocks := buildFillBlocks(blocks, fillDatasets)
	fillObject := map[string]any{
		"version": 1, "kind": "reportFill", "specVersion": 1, "specHash": hashJSON(specRaw),
		"source": source, "parameters": specObject["parameters"], "refinements": []any{},
		"calculatedFields": []any{}, "datasets": fillDatasets, "blocks": fillBlocks, "diagnostics": []any{},
	}
	fillRaw, _ := json.Marshal(fillObject)
	if _, err = reportfill.DecodeJSON(fillRaw); err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("compile fenced reportFill: %w", err)
	}
	printObject := buildPrint(title, source, specRaw, fillRaw, fillBlocks, fillDatasets)
	printRaw, _ := json.Marshal(printObject)
	if _, err = reportprint.DecodeJSON(printRaw); err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("compile fenced reportPrint: %w", err)
	}
	documentObject := map[string]any{
		"version": 1, "kind": "reportDocument", "id": assembly.ID, "title": title,
		"source": source, "blocks": blocks,
		"layout": map[string]any{"type": "grid", "columns": 12, "items": items},
	}
	documentRaw, _ := json.Marshal(documentObject)
	return documentRaw, specRaw, fillRaw, printRaw, nil, nil
}

func normalizeBlocks(value any) ([]map[string]any, error) {
	raw, ok := value.([]any)
	if !ok {
		if typed, ok := value.([]map[string]any); ok {
			return typed, nil
		}
		return nil, fmt.Errorf("report blocks must be an array")
	}
	result := make([]map[string]any, 0, len(raw))
	seen := map[string]bool{}
	for index, item := range raw {
		block, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("report block %d must be an object", index)
		}
		id, kind := textValue(block["id"]), textValue(block["kind"])
		if id == "" || kind == "" {
			return nil, fmt.Errorf("report block %d requires id and kind", index)
		}
		if seen[id] {
			return nil, fmt.Errorf("duplicate report block id %q", id)
		}
		seen[id] = true
		result = append(result, block)
	}
	return result, nil
}

func normalizeSpecBlocks(blocks []map[string]any) {
	for _, block := range blocks {
		id, kind := textValue(block["id"]), textValue(block["kind"])
		title := textValue(block["title"])
		if title == "" && kind != "tabGroupBlock" {
			title = humanize(id)
			block["title"] = title
		}
		switch kind {
		case "kpiBlock":
			if textValue(block["valueField"]) == "" && textValue(block["valueKey"]) != "" {
				block["valueField"] = block["valueKey"]
				delete(block, "valueKey")
			}
			if textValue(block["valueLabel"]) == "" {
				block["valueLabel"] = title
			}
		case "tableBlock":
			block["columns"] = normalizeColumns(block["columns"])
		case "chartBlock":
			chartSpec, _ := block["chartSpec"].(map[string]any)
			if chartSpec == nil {
				chartSpec = map[string]any{}
				block["chartSpec"] = chartSpec
			}
			if textValue(chartSpec["title"]) == "" {
				chartSpec["title"] = title
			}
			if textValue(chartSpec["type"]) == "" {
				chartSpec["type"] = "bar"
			}
			if model, _ := block["chartModel"].(map[string]any); len(model) == 0 {
				xField := textValue(chartSpec["xField"])
				yFields := stringSlice(chartSpec["yFields"])
				valueKey := ""
				if len(yFields) > 0 {
					valueKey = yFields[0]
				}
				block["chartModel"] = map[string]any{
					"type": chartSpec["type"], "xAxis": map[string]any{"dataKey": xField},
					"series": map[string]any{"valueKey": valueKey, "values": []any{map[string]any{"value": valueKey, "label": humanize(valueKey), "type": chartSpec["type"]}}},
				}
			}
		case "sectionBlock":
			if textValue(block["navigationLabel"]) == "" {
				block["navigationLabel"] = title
			}
		}
	}
}

func buildDatasets(assembly *Assembly) ([]any, []any, error) {
	ids := make([]string, 0, len(assembly.DataSources))
	for id := range assembly.DataSources {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	specDatasets := make([]any, 0, len(ids))
	fillDatasets := make([]any, 0, len(ids))
	for _, id := range ids {
		var rows []map[string]any
		if err := json.Unmarshal(assembly.DataSources[id], &rows); err != nil {
			return nil, nil, fmt.Errorf("datasource %q must contain a row array: %w", id, err)
		}
		keys := columnKeys(rows)
		limit, offset, rowCount := max(1, len(rows)), 0, len(rows)
		request := map[string]any{"kind": "staticJson", "format": "json", "rowCount": rowCount, "columnKeys": keys, "limit": limit, "offset": offset}
		specDatasets = append(specDatasets, map[string]any{"id": id, "dataSourceRef": id, "request": request})
		requestRaw, _ := json.Marshal(request)
		fillDatasets = append(fillDatasets, map[string]any{
			"id": id, "dataSourceRef": id, "request": request,
			"provenance": map[string]any{"requestHash": hashStableJSON(requestRaw), "rowCount": len(rows), "truncated": false, "hasMore": false, "diagnostics": []any{}},
			"rows":       rows,
		})
	}
	return specDatasets, fillDatasets, nil
}

func buildFillBlocks(blocks []map[string]any, datasets []any) []any {
	rowsByID := map[string][]map[string]any{}
	for _, item := range datasets {
		dataset := item.(map[string]any)
		rows, _ := dataset["rows"].([]map[string]any)
		rowsByID[textValue(dataset["id"])] = rows
	}
	result := make([]any, 0, len(blocks))
	blockByID := map[string]map[string]any{}
	for _, block := range blocks {
		blockByID[textValue(block["id"])] = block
	}
	for _, source := range blocks {
		block := cloneMap(source)
		kind, ref := textValue(block["kind"]), textValue(block["datasetRef"])
		rows := rowsByID[ref]
		switch kind {
		case "tableBlock":
			columns := normalizeColumns(block["columns"])
			block["columns"] = columns
			resolved := make([]any, 0, len(rows))
			for index, row := range rows {
				cells := make([]any, 0, len(columns))
				for _, column := range columns {
					key := textValue(column["key"])
					sourceKey := textValue(column["sourceKey"])
					if sourceKey == "" {
						sourceKey = key
					}
					displayKey := textValue(column["displayKey"])
					if displayKey == "" {
						displayKey = sourceKey
					}
					value := row[sourceKey]
					display := value
					if candidate, ok := row[displayKey]; ok {
						display = candidate
					}
					cells = append(cells, map[string]any{"key": key, "sourceKey": sourceKey, "displayKey": displayKey, "value": value, "displayValue": display, "visualState": nil})
				}
				resolved = append(resolved, map[string]any{"rowIndex": index, "cells": cells})
			}
			block["content"] = map[string]any{"columns": columns, "rowCount": len(rows), "resolvedRows": resolved}
		case "kpiBlock":
			field := textValue(block["valueField"])
			if field == "" {
				field = textValue(block["valueKey"])
				delete(block, "valueKey")
				block["valueField"] = field
			}
			value := any(nil)
			if len(rows) > 0 {
				value = rows[0][field]
			}
			block["content"] = map[string]any{
				"title": block["title"], "description": block["description"],
				"valueField": field, "valueLabel": block["valueLabel"], "valueFormat": block["valueFormat"],
				"value": value, "rowCount": len(rows), "secondaryValue": nil,
			}
		case "markdownBlock":
			block["content"] = map[string]any{"title": block["title"], "markdown": textValue(block["markdown"])}
		case "badgesBlock":
			items := normalizeBadgeItems(block["items"], rows)
			block["items"] = items
			block["content"] = map[string]any{"title": block["title"], "rowCount": len(rows), "items": items}
		case "chartBlock":
			chartSpec, _ := block["chartSpec"].(map[string]any)
			xField := textValue(chartSpec["xField"])
			yFields := stringSlice(chartSpec["yFields"])
			seriesField := textValue(chartSpec["seriesField"])
			kind, nameKey, valueKey := "directSeries", "", ""
			seriesKeys := append([]string(nil), yFields...)
			if seriesField != "" && len(yFields) > 0 {
				kind, nameKey, valueKey = "groupedSeries", seriesField, yFields[0]
				seriesKeys = distinctValues(rows, seriesField)
			}
			if len(seriesKeys) == 0 {
				seriesKeys = []string{"value"}
			}
			block["content"] = map[string]any{
				"chartSpec": block["chartSpec"], "chartModel": block["chartModel"], "rowCount": len(rows),
				"resolvedChart": map[string]any{
					"kind": kind, "type": textValue(chartSpec["type"]), "xAxisKey": xField,
					"nameKey": nameKey, "valueKey": valueKey, "seriesKeys": seriesKeys, "rows": rows,
				},
			}
		case "sectionBlock":
			block["content"] = map[string]any{
				"title": block["title"], "subtitle": block["subtitle"], "description": block["description"],
				"navigationLabel": block["navigationLabel"],
			}
		case "tabGroupBlock":
			sectionIDs := stringSlice(block["sectionIds"])
			tabs := make([]any, 0, len(sectionIDs))
			for _, sectionID := range sectionIDs {
				section := blockByID[sectionID]
				tabs = append(tabs, map[string]any{
					"id": sectionID, "title": textValue(section["title"]),
					"navigationLabel": textValue(section["navigationLabel"]),
				})
			}
			title := textValue(block["title"])
			if title == "" {
				title = "Report sections"
				block["title"] = title
			}
			block["content"] = map[string]any{
				"title": title, "sectionIds": sectionIDs,
				"defaultSectionId": block["defaultSectionId"], "tabs": tabs,
			}
		case "compositeBlock":
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "childBlockIds": block["childBlockIds"]}
		case "infoPanelBlock", "calloutBlock":
			block["content"] = map[string]any{
				"title": block["title"], "eyebrow": block["eyebrow"], "icon": block["icon"],
				"description": block["description"], "tone": block["tone"],
				"badges": block["badges"], "bodyFormat": block["bodyFormat"], "body": block["body"],
			}
		case "stepperBlock":
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "steps": block["steps"]}
		case "timelineBlock":
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "events": block["events"]}
		case "kanbanBlock":
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "columns": block["columns"]}
		}
		result = append(result, block)
	}
	return result
}

func buildPrint(title string, source map[string]any, specRaw, fillRaw json.RawMessage, blocks, datasets []any) map[string]any {
	const width, height, margin = 612.0, 792.0, 36.0
	pages := []any{}
	bookmarks := []any{}
	pageNumber, y := 1, 84.0
	elements := []any{}
	flush := func() {
		pages = append(pages, map[string]any{
			"number": pageNumber, "elements": elements,
			"headerElements": []any{
				textElement(fmt.Sprintf("page_%d__header_title", pageNumber), margin, 36, width-2*margin, 28, title, 18, "700"),
				lineElement(fmt.Sprintf("page_%d__header_rule", pageNumber), margin, 70, width-2*margin),
			},
			"footerElements": []any{
				lineElement(fmt.Sprintf("page_%d__footer_rule", pageNumber), margin, 754, width-2*margin),
				alignTextElement(fmt.Sprintf("page_%d__footer_page_number", pageNumber), margin, 758, width-2*margin, 16, fmt.Sprintf("Page %d", pageNumber), 11, "", "right"),
			},
		})
		pageNumber++
		y = 84
		elements = []any{}
	}
	ensure := func(required float64) {
		if y+required > 744 {
			flush()
		}
	}
	rowsByID := map[string][]map[string]any{}
	for _, item := range datasets {
		ds := item.(map[string]any)
		rowsByID[textValue(ds["id"])], _ = ds["rows"].([]map[string]any)
	}
	for _, item := range blocks {
		block := item.(map[string]any)
		kind, id, blockTitle := textValue(block["kind"]), textValue(block["id"]), textValue(block["title"])
		if kind == "tabGroupBlock" || kind == "compositeBlock" {
			continue
		}
		if blockTitle == "" {
			blockTitle = humanize(id)
		}
		switch kind {
		case "sectionBlock":
			ensure(44)
			titleID := id + "__title"
			elements = append(elements, rectElement(id+"__rule", margin, y, 4, 28, "#2563eb"))
			elements = append(elements, textElement(titleID, margin+12, y+3, width-2*margin-12, 24, blockTitle, 16, "700"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 40
		case "tableBlock":
			columns := normalizeColumns(block["columns"])
			rows := rowsByID[textValue(block["datasetRef"])]
			rowLimit := len(rows)
			if rowLimit > 20 {
				rowLimit = 20
			}
			required := 48.0 + float64(rowLimit)*24
			ensure(required)
			titleID := id + "__title"
			elements = append(elements, textElement(titleID, margin, y, width-2*margin, 20, blockTitle, 14, "600"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 24
			colWidth := (width - 2*margin) / float64(max(1, len(columns)))
			elements = append(elements, rectElement(id+"__header_bg", margin, y, width-2*margin, 24, "#f8fafc"))
			for index, column := range columns {
				elements = append(elements, textElement(id+"__header_"+textValue(column["key"]), margin+float64(index)*colWidth+6, y+4, colWidth-12, 16, textValue(column["label"]), 10, "600"))
			}
			y += 24
			columnMax := map[string]float64{}
			for _, column := range columns {
				key := textValue(column["key"])
				cellVisual, _ := column["cellVisual"].(map[string]any)
				if textValue(cellVisual["kind"]) != "dataBar" {
					continue
				}
				for _, row := range rows {
					if value, ok := numberValue(row[key]); ok && value > columnMax[key] {
						columnMax[key] = value
					}
				}
			}
			for rowIndex := 0; rowIndex < rowLimit; rowIndex++ {
				row := rows[rowIndex]
				for columnIndex, column := range columns {
					key := textValue(column["key"])
					cellVisual, _ := column["cellVisual"].(map[string]any)
					if textValue(cellVisual["kind"]) == "dataBar" {
						value, _ := numberValue(row[key])
						maximum := columnMax[key]
						if maximum <= 0 {
							maximum = 1
						}
						elements = append(elements, map[string]any{
							"id": fmt.Sprintf("%s__r%d_%s_bar", id, rowIndex, key), "kind": "tableCellDataBar",
							"box":    map[string]any{"x": margin + float64(columnIndex)*colWidth + 4, "y": y + 7, "width": colWidth - 8, "height": 10},
							"rowKey": fmt.Sprintf("row_%d", rowIndex), "columnKey": key,
							"value": value, "min": 0, "max": maximum,
							"fillColor": "#93c5fd", "backgroundColor": "#eff6ff",
						})
					}
					elements = append(elements, textElement(fmt.Sprintf("%s__r%d_%s", id, rowIndex, key), margin+float64(columnIndex)*colWidth+6, y+4, colWidth-12, 16, formatValue(row[key], textValue(column["format"])), 9, ""))
				}
				y += 24
				elements = append(elements, lineElement(fmt.Sprintf("%s__rule_%d", id, rowIndex), margin, y, width-2*margin))
			}
			y += 12
		case "chartBlock":
			rows := rowsByID[textValue(block["datasetRef"])]
			chartSpec, _ := block["chartSpec"].(map[string]any)
			ensure(210)
			titleID := id + "__title"
			elements = append(elements, textElement(titleID, margin, y, width-2*margin, 20, blockTitle, 14, "600"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 26
			elements = append(elements, map[string]any{
				"id": id + "__chart", "kind": "svg",
				"box": map[string]any{"x": margin, "y": y, "width": width - 2*margin, "height": 168},
				"svg": buildChartSVG(rows, chartSpec, width-2*margin, 168),
			})
			y += 180
		case "badgesBlock":
			items := normalizeBadgeItems(block["items"], rowsByID[textValue(block["datasetRef"])])
			if len(items) == 0 {
				continue
			}
			ensure(72)
			titleID := id + "__title"
			elements = append(elements, textElement(titleID, margin, y, width-2*margin, 20, blockTitle, 14, "600"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 26
			badgeWidth := (width - 2*margin - float64(len(items)-1)*8) / float64(len(items))
			for index, rawItem := range items {
				badge := rawItem.(map[string]any)
				x := margin + float64(index)*(badgeWidth+8)
				elements = append(elements, rectElement(fmt.Sprintf("%s__badge_%d", id, index), x, y, badgeWidth, 34, "#f7faff"))
				label := textValue(badge["label"])
				value := textValue(badge["displayValue"])
				elements = append(elements, textElement(fmt.Sprintf("%s__badge_text_%d", id, index), x+8, y+9, badgeWidth-16, 16, strings.TrimSpace(label+": "+value), 10, "600"))
			}
			y += 46
		case "kpiBlock":
			ensure(76)
			rows := rowsByID[textValue(block["datasetRef"])]
			field := textValue(block["valueField"])
			value := any(nil)
			if len(rows) > 0 {
				value = rows[0][field]
			}
			titleID := id + "__title"
			elements = append(elements, rectElement(id+"__card", margin, y, width-2*margin, 64, "#f7faff"))
			elements = append(elements, textElement(titleID, margin+12, y+8, width-2*margin-24, 16, blockTitle, 11, "600"))
			elements = append(elements, textElement(id+"__value", margin+12, y+28, width-2*margin-24, 28, formatValue(value, textValue(block["valueFormat"])), 20, "700"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 76
		default:
			body := textValue(block["markdown"])
			if body == "" {
				body = textValue(block["body"])
			}
			lines := wrapPlain(stripMarkdown(body), 82)
			if len(lines) == 0 {
				description := textValue(block["description"])
				if description == "" {
					description = "No additional detail."
				}
				lines = []string{description}
			}
			required := 32.0 + float64(len(lines))*15
			ensure(required)
			titleID := id + "__title"
			elements = append(elements, textElement(titleID, margin, y, width-2*margin, 20, blockTitle, 14, "600"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 24
			for index, line := range lines {
				elements = append(elements, textElement(fmt.Sprintf("%s__line_%d", id, index), margin, y, width-2*margin, 14, line, 10, ""))
				y += 15
			}
			y += 12
		}
	}
	if len(elements) > 0 || len(pages) == 0 {
		flush()
	}
	return map[string]any{
		"version": 1, "kind": "reportPrint", "specVersion": 1, "specHash": hashJSON(specRaw),
		"fillVersion": 1, "fillHash": hashJSON(fillRaw), "source": source, "title": title,
		"pageGeometry": map[string]any{"width": width, "height": height, "marginTop": margin, "marginRight": margin, "marginBottom": margin, "marginLeft": margin, "headerHeight": 36, "footerHeight": 24},
		"pages":        pages, "bookmarks": bookmarks, "diagnostics": []any{},
	}
}

func primaryDataSourceRef(a *Assembly) string {
	ids := make([]string, 0, len(a.DataSources))
	for id := range a.DataSources {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	if len(ids) > 0 {
		return ids[0]
	}
	return a.ID
}

func columnKeys(rows []map[string]any) []string {
	set := map[string]bool{}
	for _, row := range rows {
		for key := range row {
			set[key] = true
		}
	}
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func normalizeColumns(value any) []map[string]any {
	raw, _ := value.([]any)
	if typed, ok := value.([]map[string]any); ok {
		return typed
	}
	result := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if column, ok := item.(map[string]any); ok {
			key := textValue(column["key"])
			if textValue(column["label"]) == "" {
				column["label"] = humanize(key)
			}
			result = append(result, column)
		}
	}
	return result
}

func normalizeBadgeItems(value any, rows []map[string]any) []any {
	raw, _ := value.([]any)
	result := make([]any, 0, len(raw))
	for index, item := range raw {
		source, ok := item.(map[string]any)
		if !ok {
			continue
		}
		next := cloneMap(source)
		if textValue(next["id"]) == "" {
			next["id"] = fmt.Sprintf("badge_%d", index+1)
		}
		value := next["value"]
		if field := textValue(next["valueField"]); field != "" && len(rows) > 0 {
			value = rows[0][field]
		}
		next["value"] = value
		next["displayValue"] = formatValue(value, textValue(next["format"]))
		result = append(result, next)
	}
	return result
}

func stringSlice(value any) []string {
	raw, _ := value.([]any)
	if typed, ok := value.([]string); ok {
		return append([]string(nil), typed...)
	}
	result := make([]string, 0, len(raw))
	for _, item := range raw {
		if text := textValue(item); text != "" {
			result = append(result, text)
		}
	}
	return result
}

func distinctValues(rows []map[string]any, field string) []string {
	seen := map[string]bool{}
	var result []string
	for _, row := range rows {
		value := textValue(row[field])
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func hashJSON(raw json.RawMessage) string {
	var compact bytes.Buffer
	_ = json.Compact(&compact, raw)
	// Match the frontend hash, which applies FNV-1a to UTF-16 code units.
	var value uint32 = 2166136261
	for _, unit := range utf16.Encode([]rune(compact.String())) {
		value ^= uint32(unit)
		value *= 16777619
	}
	return fmt.Sprintf("fnv1a:%08x", value)
}

func hashStableJSON(raw json.RawMessage) string {
	var value any
	_ = json.Unmarshal(raw, &value)
	stable, _ := json.Marshal(value)
	return hashJSON(stable)
}

func cloneMap(input map[string]any) map[string]any {
	raw, _ := json.Marshal(input)
	var result map[string]any
	_ = json.Unmarshal(raw, &result)
	return result
}

func textValue(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}
func humanize(value string) string {
	value = strings.NewReplacer("_", " ", "-", " ").Replace(value)
	if value == "" {
		return "Report"
	}
	return strings.ToUpper(value[:1]) + value[1:]
}
func stripMarkdown(value string) string {
	return strings.TrimSpace(strings.NewReplacer("**", "", "__", "", "`", "", "### ", "", "## ", "", "# ", "", "- ", "").Replace(value))
}
func wrapPlain(value string, width int) []string {
	words := strings.Fields(value)
	var result []string
	var line string
	for _, word := range words {
		if len(line)+len(word)+1 > width && line != "" {
			result = append(result, line)
			line = ""
		}
		if line != "" {
			line += " "
		}
		line += word
	}
	if line != "" {
		result = append(result, line)
	}
	return result
}
func formatValue(value any, format string) string {
	if value == nil {
		return "—"
	}
	number, numeric := value.(float64)
	if numeric {
		switch strings.ToLower(format) {
		case "currency":
			return fmt.Sprintf("$%.2f", number)
		case "percent":
			return fmt.Sprintf("%.1f%%", number)
		default:
			return strconv.FormatFloat(number, 'f', 3, 64)
		}
	}
	return fmt.Sprint(value)
}

func buildChartSVG(rows []map[string]any, chartSpec map[string]any, width, height float64) string {
	xField := textValue(chartSpec["xField"])
	yFields := stringSlice(chartSpec["yFields"])
	if len(yFields) == 0 {
		return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f"><text x="12" y="24" font-size="12" fill="#667085">No chart measures configured</text></svg>`, width, height)
	}
	const left, top, right, bottom = 48.0, 12.0, 12.0, 30.0
	plotWidth, plotHeight := width-left-right, height-top-bottom
	maxValue := 0.0
	for _, row := range rows {
		for _, field := range yFields {
			if value, ok := numberValue(row[field]); ok && value > maxValue {
				maxValue = value
			}
		}
	}
	if maxValue <= 0 {
		maxValue = 1
	}
	var svg strings.Builder
	fmt.Fprintf(&svg, `<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f">`, width, height)
	fmt.Fprintf(&svg, `<rect width="%.0f" height="%.0f" rx="6" fill="#ffffff" stroke="#d0d5dd"/>`, width, height)
	fmt.Fprintf(&svg, `<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#98a2b3"/>`, left, top+plotHeight, left+plotWidth, top+plotHeight)
	palette := []string{"#2563eb", "#16a34a", "#f59e0b", "#7c3aed"}
	chartType := strings.ToLower(textValue(chartSpec["type"]))
	if chartType == "bar" || chartType == "column" {
		count := max(1, len(rows)*len(yFields))
		barWidth := plotWidth / float64(count) * 0.72
		slot := plotWidth / float64(count)
		index := 0
		for _, row := range rows {
			for seriesIndex, field := range yFields {
				value, _ := numberValue(row[field])
				barHeight := value / maxValue * plotHeight
				x := left + float64(index)*slot + (slot-barWidth)/2
				y := top + plotHeight - barHeight
				fmt.Fprintf(&svg, `<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" rx="2"/>`, x, y, barWidth, barHeight, palette[seriesIndex%len(palette)])
				index++
			}
		}
	} else {
		for seriesIndex, field := range yFields {
			points := make([]string, 0, len(rows))
			for rowIndex, row := range rows {
				value, _ := numberValue(row[field])
				x := left
				if len(rows) > 1 {
					x += float64(rowIndex) * plotWidth / float64(len(rows)-1)
				}
				y := top + plotHeight - value/maxValue*plotHeight
				points = append(points, fmt.Sprintf("%.1f,%.1f", x, y))
			}
			if len(points) > 0 {
				fmt.Fprintf(&svg, `<polyline points="%s" fill="none" stroke="%s" stroke-width="2.5"/>`, strings.Join(points, " "), palette[seriesIndex%len(palette)])
			}
		}
	}
	labelCount := min(len(rows), 6)
	for index := 0; index < labelCount; index++ {
		rowIndex := index
		if labelCount > 1 && len(rows) > labelCount {
			rowIndex = index * (len(rows) - 1) / (labelCount - 1)
		}
		x := left
		if len(rows) > 1 {
			x += float64(rowIndex) * plotWidth / float64(len(rows)-1)
		}
		label := html.EscapeString(textValue(rows[rowIndex][xField]))
		fmt.Fprintf(&svg, `<text x="%.1f" y="%.1f" text-anchor="middle" font-size="9" fill="#667085">%s</text>`, x, height-10, label)
	}
	svg.WriteString(`</svg>`)
	return svg.String()
}

func numberValue(value any) (float64, bool) {
	switch actual := value.(type) {
	case float64:
		return actual, true
	case float32:
		return float64(actual), true
	case int:
		return float64(actual), true
	case int64:
		return float64(actual), true
	case json.Number:
		number, err := actual.Float64()
		return number, err == nil
	default:
		number, err := strconv.ParseFloat(strings.TrimSpace(fmt.Sprint(value)), 64)
		return number, err == nil
	}
}

func textElement(id string, x, y, width, height float64, text string, size float64, weight string) map[string]any {
	result := map[string]any{"id": id, "kind": "text", "box": map[string]any{"x": x, "y": y, "width": width, "height": height}, "text": text, "fontSize": size, "color": "#101828"}
	if weight != "" {
		result["fontWeight"] = weight
	}
	return result
}
func alignTextElement(id string, x, y, width, height float64, text string, size float64, weight, align string) map[string]any {
	result := textElement(id, x, y, width, height, text, size, weight)
	result["align"] = align
	return result
}
func lineElement(id string, x, y, width float64) map[string]any {
	return map[string]any{"id": id, "kind": "line", "box": map[string]any{"x": x, "y": y, "width": width, "height": 0}, "strokeColor": "#d0d5dd", "strokeWidth": 1}
}
func rectElement(id string, x, y, width, height float64, color string) map[string]any {
	return map[string]any{"id": id, "kind": "rect", "box": map[string]any{"x": x, "y": y, "width": width, "height": height}, "fillColor": color, "strokeColor": "#d0d5dd", "strokeWidth": 1, "radius": 4}
}
func bookmark(id, title string, page int, elementID string, y float64) map[string]any {
	return map[string]any{"id": "bookmark." + id, "title": title, "pageNumber": page, "level": 1, "elementId": elementID, "y": y}
}
