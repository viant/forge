package fenced

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/viant/forge/backend/reporting/textwrap"
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
	subtitle := textValue(assembly.Source["subtitle"])
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
	normalizeBlockDatasetRefs(blocks, primaryDataSourceRef(assembly))
	blockOrder := make([]string, 0, len(blocks))
	items := make([]any, 0, len(blocks))
	layoutSizes := sourceLayoutSizes(assembly.Source)
	for _, block := range blocks {
		id := textValue(block["id"])
		blockOrder = append(blockOrder, id)
		item := map[string]any{"blockId": id}
		if size, ok := layoutSizes[id]; ok {
			item["size"] = size
		}
		items = append(items, item)
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
	if subtitle != "" {
		specObject["subtitle"] = subtitle
	}
	specRaw, _ := json.Marshal(specObject)
	if _, err = reportspec.DecodeJSON(specRaw); err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("compile fenced reportSpec: %w", err)
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
	printObject := buildPrint(title, subtitle, source, specRaw, fillRaw, fillBlocks, fillDatasets)
	printRaw, _ := json.Marshal(printObject)
	if _, err = reportprint.DecodeJSON(printRaw); err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("compile fenced reportPrint: %w", err)
	}
	documentObject := map[string]any{
		"version": 1, "kind": "reportDocument", "id": assembly.ID, "title": title,
		"source": source, "blocks": blocks,
		"layout": map[string]any{"type": "grid", "columns": 12, "items": items},
	}
	if subtitle != "" {
		documentObject["subtitle"] = subtitle
	}
	documentRaw, _ := json.Marshal(documentObject)
	return documentRaw, specRaw, fillRaw, printRaw, nil, nil
}

func sourceLayoutSizes(source map[string]any) map[string]string {
	result := map[string]string{}
	layout, _ := source["layout"].(map[string]any)
	rawItems, _ := layout["items"].([]any)
	for _, rawItem := range rawItems {
		item, _ := rawItem.(map[string]any)
		blockID := textValue(item["blockId"])
		if blockID == "" {
			continue
		}
		value := item["span"]
		if value == nil {
			value = item["w"]
		}
		number, ok := numberValue(value)
		span := int(number)
		if !ok || number != float64(span) || span < 1 || span > 12 {
			continue
		}
		sizes := map[int]string{3: "quarter", 4: "third", 6: "half", 8: "two-thirds", 12: "full"}
		if size := sizes[span]; size != "" {
			result[blockID] = size
		}
	}
	return result
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
			// Interactive navigation metadata has no meaning in a static export and
			// is intentionally outside the strict Go reportSpec schema.
			delete(block, "link")
			delete(block, "description")
			block["columns"] = normalizeColumns(block["columns"])
		case "chartBlock":
			delete(block, "description")
			delete(block, "link")
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
		case "geoMapBlock":
			delete(block, "description")
			delete(block, "link")
		}
	}
}

func normalizeBlockDatasetRefs(blocks []map[string]any, fallback string) {
	if strings.TrimSpace(fallback) == "" {
		return
	}
	dataBoundKinds := map[string]bool{
		"tableBlock": true, "chartBlock": true, "kpiBlock": true,
		"badgesBlock": true, "collectionBlock": true, "geoMapBlock": true,
	}
	for _, block := range blocks {
		if dataBoundKinds[textValue(block["kind"])] && textValue(block["datasetRef"]) == "" {
			block["datasetRef"] = fallback
		}
	}
}

func buildDatasets(assembly *Assembly) ([]any, []any, error) {
	ids := make([]string, 0, len(assembly.DataSources))
	for id := range assembly.DataSources {
		ids = append(ids, id)
	}
	// Report documents may be entirely authored content (markdown, callouts,
	// sections, and other static blocks). The canonical export contract still
	// requires one dataset/source identity, so preserve those reports with an
	// empty static dataset instead of rejecting PDF export.
	if len(ids) == 0 {
		ids = append(ids, assembly.ID)
	}
	sort.Strings(ids)
	specDatasets := make([]any, 0, len(ids))
	fillDatasets := make([]any, 0, len(ids))
	for _, id := range ids {
		var rows []map[string]any
		rawRows, exists := assembly.DataSources[id]
		if !exists {
			rows = []map[string]any{}
		} else if err := json.Unmarshal(rawRows, &rows); err != nil {
			return nil, nil, fmt.Errorf("datasource %q must contain a row array: %w", id, err)
		}
		keys := columnKeys(rows)
		if len(keys) == 0 {
			// The export envelope requires a non-empty static schema even when the
			// authored report has no rows. This key is contract-only and is never
			// rendered as report content.
			keys = []string{"_placeholder"}
		}
		limit, offset, rowCount := max(1, len(rows)), 0, len(rows)
		request := map[string]any{"kind": "staticJson", "format": "json", "rowCount": rowCount, "columnKeys": keys, "limit": limit, "offset": offset}
		specDatasets = append(specDatasets, map[string]any{"id": id, "dataSourceRef": id, "request": request})
		requestForHash := cloneMap(request)
		if len(keys) == 0 {
			// RequestPayload intentionally omits an empty columnKeys slice while
			// hashing, even though the decoded static request retains the required
			// non-nil empty slice for validation.
			delete(requestForHash, "columnKeys")
		}
		requestRaw, _ := json.Marshal(requestForHash)
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
				"suffix": block["suffix"], "tone": block["tone"],
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
		case "infoPanelBlock":
			block["content"] = map[string]any{
				"title": block["title"], "eyebrow": block["eyebrow"],
				"description": block["description"], "tone": block["tone"],
				"bodyFormat": block["bodyFormat"], "body": block["body"],
			}
		case "calloutBlock":
			block["content"] = map[string]any{
				"title": block["title"], "icon": block["icon"],
				"description": block["description"], "tone": block["tone"],
				"badges": block["badges"], "bodyFormat": block["bodyFormat"], "body": block["body"],
			}
		case "stepperBlock":
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "steps": block["steps"]}
		case "timelineBlock":
			events, _ := block["events"].([]any)
			if len(events) == 0 {
				timeField := textValue(block["timeField"])
				titleField := textValue(block["titleField"])
				descriptionField := textValue(block["descriptionField"])
				for index, row := range rows {
					events = append(events, map[string]any{
						"id":    fmt.Sprintf("%s_event_%d", textValue(block["id"]), index+1),
						"date":  textValue(row[timeField]),
						"title": textValue(row[titleField]),
						"body":  textValue(row[descriptionField]),
					})
				}
			}
			block["events"] = events
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "events": events}
		case "kanbanBlock":
			block["content"] = map[string]any{"title": block["title"], "description": block["description"], "columns": block["columns"]}
		}
		result = append(result, block)
	}
	return result
}

func buildPrint(title, subtitle string, source map[string]any, specRaw, fillRaw json.RawMessage, blocks, datasets []any) map[string]any {
	width, height := 612.0, 792.0
	for _, item := range blocks {
		block := item.(map[string]any)
		if textValue(block["kind"]) == "tableBlock" && len(normalizeColumns(block["columns"])) >= 6 {
			width, height = 792, 612
			break
		}
	}
	const margin = 36.0
	contentBottom := height - 48
	pages := []any{}
	bookmarks := []any{}
	pageNumber, y := 1, 84.0
	elements := []any{}
	flush := func() {
		headerElements := []any{
			textElement(fmt.Sprintf("page_%d__header_title", pageNumber), margin, 36, width-2*margin, 28, title, 18, "700"),
			lineElement(fmt.Sprintf("page_%d__header_rule", pageNumber), margin, 70, width-2*margin),
		}
		if subtitle != "" {
			subtitleElement := textElement(fmt.Sprintf("page_%d__header_subtitle", pageNumber), margin, 56, width-2*margin, 12, subtitle, 9, "")
			subtitleElement["color"] = "#667085"
			headerElements = []any{
				textElement(fmt.Sprintf("page_%d__header_title", pageNumber), margin, 34, width-2*margin, 20, title, 18, "700"),
				subtitleElement,
				lineElement(fmt.Sprintf("page_%d__header_rule", pageNumber), margin, 70, width-2*margin),
			}
		}
		pages = append(pages, map[string]any{
			"number": pageNumber, "elements": elements,
			"headerElements": headerElements,
			"footerElements": []any{
				lineElement(fmt.Sprintf("page_%d__footer_rule", pageNumber), margin, height-38, width-2*margin),
				alignTextElement(fmt.Sprintf("page_%d__footer_page_number", pageNumber), margin, height-34, width-2*margin, 16, fmt.Sprintf("Page %d", pageNumber), 11, "", "right"),
			},
		})
		pageNumber++
		y = 84
		elements = []any{}
	}
	ensure := func(required float64) {
		if y+required > contentBottom {
			flush()
		}
	}
	rowsByID := map[string][]map[string]any{}
	for _, item := range datasets {
		ds := item.(map[string]any)
		rowsByID[textValue(ds["id"])], _ = ds["rows"].([]map[string]any)
	}
	pendingKPIs := 0
	kpiColumns := 3
	if width >= 700 {
		kpiColumns = 4
	}
	kpiCardHeight, kpiAdvance := 44.0, 52.0
	tabSections := map[string]bool{}
	for _, item := range blocks {
		block := item.(map[string]any)
		if textValue(block["kind"]) != "tabGroupBlock" {
			continue
		}
		for _, sectionID := range stringSlice(block["sectionIds"]) {
			tabSections[sectionID] = true
		}
	}
	for _, item := range blocks {
		block := item.(map[string]any)
		kind, id, blockTitle := textValue(block["kind"]), textValue(block["id"]), textValue(block["title"])
		if kind == "tabGroupBlock" || kind == "compositeBlock" {
			continue
		}
		if kind != "kpiBlock" && pendingKPIs > 0 {
			y += kpiAdvance
			pendingKPIs = 0
		}
		if blockTitle == "" {
			blockTitle = humanize(id)
		}
		switch kind {
		case "sectionBlock":
			if tabSections[id] && len(elements) > 0 {
				flush()
			}
			ensure(44)
			titleID := id + "__title"
			elements = append(elements, rectElement(id+"__rule", margin, y, 4, 28, "#2563eb"))
			elements = append(elements, textElement(titleID, margin+12, y+3, width-2*margin-12, 24, blockTitle, 16, "700"))
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			y += 40
		case "tableBlock":
			columns := normalizeColumns(block["columns"])
			rows := rowsByID[textValue(block["datasetRef"])]
			columnX, columnWidths := resolveColumnLayout(columns, rows, margin, width-2*margin)
			headerHeight := 24.0
			for index, column := range columns {
				lines := estimatedWrappedLineCount(textValue(column["label"]), columnWidths[index]-12, 9)
				headerHeight = math.Max(headerHeight, 8+float64(lines)*11)
			}
			ensure(24 + headerHeight + 24)
			renderTableHeading := func(continued bool) {
				titleID := id + "__title"
				title := blockTitle
				if continued {
					title += " (continued)"
					titleID += fmt.Sprintf("__page_%d", pageNumber)
				}
				elements = append(elements, textElement(titleID, margin, y, width-2*margin, 20, title, 14, "600"))
				if !continued {
					bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
				}
				y += 24
				elements = append(elements, rectElement(fmt.Sprintf("%s__header_bg_%d", id, pageNumber), margin, y, width-2*margin, headerHeight, "#f8fafc"))
				for index, column := range columns {
					header := textElement(fmt.Sprintf("%s__header_%s_%d", id, textValue(column["key"]), pageNumber), columnX[index]+6, y+4, columnWidths[index]-12, headerHeight-8, textValue(column["label"]), 9, "600")
					header["wrap"] = true
					header["verticalAlign"] = "top"
					elements = append(elements, header)
				}
				y += headerHeight
			}
			renderTableHeading(false)
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
			for rowIndex := 0; rowIndex < len(rows); rowIndex++ {
				row := rows[rowIndex]
				displayValues := make([]string, len(columns))
				rowHeight := 24.0
				for columnIndex, column := range columns {
					key := textValue(column["key"])
					displayValues[columnIndex] = formatValue(row[key], textValue(column["format"]))
					lines := estimatedWrappedLineCount(displayValues[columnIndex], columnWidths[columnIndex]-12, 8.5)
					rowHeight = math.Max(rowHeight, 8+float64(lines)*11)
				}
				if y+rowHeight > contentBottom {
					flush()
					renderTableHeading(true)
				}
				for columnIndex, column := range columns {
					key := textValue(column["key"])
					colWidth := columnWidths[columnIndex]
					colX := columnX[columnIndex]
					cellVisual, _ := column["cellVisual"].(map[string]any)
					if textValue(cellVisual["kind"]) == "dataBar" {
						value, _ := numberValue(row[key])
						maximum := columnMax[key]
						if maximum <= 0 {
							maximum = 1
						}
						backgroundColor, fillColor := dataBarColors(cellVisual)
						elements = append(elements, map[string]any{
							"id": fmt.Sprintf("%s__r%d_%s_bar", id, rowIndex, key), "kind": "tableCellDataBar",
							"box":    map[string]any{"x": colX + 4, "y": y + 7, "width": colWidth - 8, "height": 10},
							"rowKey": fmt.Sprintf("row_%d", rowIndex), "columnKey": key,
							"value": value, "min": 0, "max": maximum,
							"fillColor": fillColor, "backgroundColor": backgroundColor,
						})
					}
					cell := textElement(fmt.Sprintf("%s__r%d_%s", id, rowIndex, key), colX+6, y+4, colWidth-12, rowHeight-8, displayValues[columnIndex], 8.5, "")
					cell["wrap"] = true
					cell["verticalAlign"] = "top"
					elements = append(elements, cell)
				}
				y += rowHeight
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
			ensure(68)
			renderBadgeTitle := func(continued bool) {
				title := blockTitle
				titleID := id + "__title"
				if continued {
					title += " (continued)"
					titleID += fmt.Sprintf("__page_%d", pageNumber)
				}
				elements = append(elements, textElement(titleID, margin, y, width-2*margin, 20, title, 14, "600"))
				if !continued {
					bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
				}
				y += 26
			}
			renderBadgeTitle(false)
			fullWidth := width - 2*margin
			halfWidth := (fullWidth - 8) / 2
			columnIndex := 0
			rowHeight := 0.0
			for index, rawItem := range items {
				badge := rawItem.(map[string]any)
				label := textValue(badge["label"])
				value := textValue(badge["displayValue"])
				badgeText := strings.TrimSpace(label + ": " + value)
				spanFull := estimatedWrappedLineCount(badgeText, halfWidth-24, 10) > 2
				if spanFull && columnIndex != 0 {
					y += rowHeight + 8
					columnIndex = 0
					rowHeight = 0
				}
				badgeWidth := halfWidth
				if spanFull {
					badgeWidth = fullWidth
				}
				lineCount := estimatedWrappedLineCount(badgeText, badgeWidth-24, 10)
				badgeHeight := math.Max(32, 14+float64(lineCount)*12)
				if y+badgeHeight > contentBottom {
					flush()
					renderBadgeTitle(true)
					columnIndex = 0
					rowHeight = 0
				}
				x := margin + float64(columnIndex)*(halfWidth+8)
				background, border, foreground := badgeToneColors(textValue(badge["tone"]))
				rect := rectElement(fmt.Sprintf("%s__badge_%d", id, index), x, y, badgeWidth, badgeHeight, background)
				rect["strokeColor"] = border
				rect["radius"] = 10
				elements = append(elements, rect)
				text := textElement(fmt.Sprintf("%s__badge_text_%d", id, index), x+12, y+7, badgeWidth-24, badgeHeight-14, badgeText, 10, "600")
				text["color"] = foreground
				text["wrap"] = true
				text["verticalAlign"] = "top"
				elements = append(elements, text)
				if spanFull {
					y += badgeHeight + 8
					columnIndex = 0
					rowHeight = 0
					continue
				}
				rowHeight = math.Max(rowHeight, badgeHeight)
				columnIndex++
				if columnIndex == 2 {
					y += rowHeight + 8
					columnIndex = 0
					rowHeight = 0
				}
			}
			if columnIndex != 0 {
				y += rowHeight + 8
			}
		case "kpiBlock":
			if pendingKPIs == 0 {
				ensure(kpiAdvance)
			}
			rows := rowsByID[textValue(block["datasetRef"])]
			field := textValue(block["valueField"])
			value := any(nil)
			if len(rows) > 0 {
				value = rows[0][field]
			}
			const gap = 8.0
			cardWidth := (width - 2*margin - gap*float64(kpiColumns-1)) / float64(kpiColumns)
			x := margin + float64(pendingKPIs)*(cardWidth+gap)
			titleID := id + "__title"
			background, border, foreground := kpiToneColors(textValue(block["tone"]))
			card := rectElement(id+"__card", x, y, cardWidth, kpiCardHeight, background)
			card["strokeColor"] = border
			elements = append(elements, card)
			elements = append(elements, textElement(titleID, x+10, y+5, cardWidth-20, 14, fitTableText(blockTitle, cardWidth-20, 9), 9, "600"))
			displayValue := formatValue(value, textValue(block["valueFormat"])) + textValue(block["suffix"])
			valueElement := textElement(id+"__value", x+10, y+20, cardWidth-20, 20, fitTableText(displayValue, cardWidth-20, 16), 16, "700")
			valueElement["color"] = foreground
			elements = append(elements, valueElement)
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			pendingKPIs++
			if pendingKPIs == kpiColumns {
				y += kpiAdvance
				pendingKPIs = 0
			}
		case "calloutBlock":
			body := textValue(block["body"])
			if body == "" {
				body = textValue(block["description"])
			}
			lines := wrapPlain(stripMarkdown(body), 76)
			if len(lines) == 0 {
				lines = []string{"No additional detail."}
			}
			panelHeight := 54.0 + float64(len(lines))*15
			ensure(panelHeight + 12)
			background, border, accent := calloutToneColors(textValue(block["tone"]))
			panel := rectElement(id+"__panel", margin, y, width-2*margin, panelHeight, background)
			panel["strokeColor"] = border
			panel["radius"] = 12
			elements = append(elements, panel)
			accentRule := rectElement(id+"__accent", margin, y, 5, panelHeight, accent)
			accentRule["strokeColor"] = accent
			accentRule["radius"] = 3
			elements = append(elements, accentRule)
			titleID := id + "__title"
			titleText := textElement(titleID, margin+18, y+12, width-2*margin-34, 22, blockTitle, 14, "600")
			titleText["color"] = "#182026"
			elements = append(elements, titleText)
			bookmarks = append(bookmarks, bookmark(id, blockTitle, pageNumber, titleID, y))
			textY := y + 39
			for index, line := range lines {
				lineText := textElement(fmt.Sprintf("%s__line_%d", id, index), margin+18, textY, width-2*margin-34, 14, line, 10, "")
				lineText["color"] = "#30404d"
				elements = append(elements, lineText)
				textY += 15
			}
			y += panelHeight + 12
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
		"fillVersion": 1, "fillHash": hashJSON(fillRaw), "source": source, "title": title, "subtitle": subtitle,
		"pageGeometry": map[string]any{"width": width, "height": height, "marginTop": margin, "marginRight": margin, "marginBottom": margin, "marginLeft": margin, "headerHeight": 36, "footerHeight": 24},
		"pages":        pages, "bookmarks": bookmarks, "diagnostics": []any{},
	}
}

func dataBarColors(cellVisual map[string]any) (string, string) {
	backgroundColor, fillColor := "#eff6ff", "#93c5fd"
	rawPalette, _ := cellVisual["palette"].([]any)
	palette := make([]string, 0, len(rawPalette))
	for _, value := range rawPalette {
		if color := strings.TrimSpace(textValue(value)); color != "" {
			palette = append(palette, color)
		}
	}
	if len(palette) > 0 {
		backgroundColor = palette[0]
		fillColor = palette[len(palette)-1]
	}
	return backgroundColor, fillColor
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
		raw = make([]any, len(typed))
		for index := range typed {
			raw[index] = typed[index]
		}
	}
	result := make([]map[string]any, 0, len(raw))
	allowed := map[string]bool{
		"key": true, "sourceKey": true, "displayKey": true, "label": true,
		"kind": true, "format": true, "align": true, "cellVisual": true,
		"runtimeFilterable": true,
	}
	for _, item := range raw {
		if column, ok := item.(map[string]any); ok {
			normalized := map[string]any{}
			for key, itemValue := range column {
				if allowed[key] {
					normalized[key] = itemValue
				}
			}
			if _, exists := normalized["kind"]; !exists && column["type"] != nil {
				normalized["kind"] = column["type"]
			}
			key := textValue(normalized["key"])
			if textValue(normalized["label"]) == "" {
				normalized["label"] = humanize(key)
			}
			result = append(result, normalized)
		}
	}
	return result
}

func normalizeBadgeItems(value any, rows []map[string]any) []any {
	raw, _ := value.([]any)
	result := make([]any, 0, len(raw))
	for _, item := range raw {
		source, ok := item.(map[string]any)
		if !ok {
			continue
		}
		next := cloneMap(source)
		value := next["value"]
		if field := textValue(next["valueField"]); field != "" && len(rows) > 0 {
			value = rows[0][field]
		}
		next["value"] = value
		if rule := matchingBadgeRule(next["rules"], value); rule != nil {
			if label := textValue(rule["label"]); label != "" {
				next["displayValue"] = label
			}
			if tone := textValue(rule["tone"]); tone != "" {
				next["tone"] = tone
			}
		}
		if textValue(next["displayValue"]) == "" {
			next["displayValue"] = formatValue(value, textValue(next["format"]))
		}
		result = append(result, next)
	}
	return result
}

func matchingBadgeRule(value any, actual any) map[string]any {
	rules, _ := value.([]any)
	for _, item := range rules {
		rule, ok := item.(map[string]any)
		if ok && fmt.Sprint(rule["value"]) == fmt.Sprint(actual) {
			return rule
		}
	}
	return nil
}

func kpiToneColors(tone string) (background, border, foreground string) {
	return badgeToneColors(tone)
}

func badgeToneColors(tone string) (background, border, foreground string) {
	switch strings.ToLower(strings.TrimSpace(tone)) {
	case "success", "good":
		return "#eef8f0", "#cfe7d6", "#0f6b3a"
	case "warning", "caution":
		return "#fff7e1", "#f5d28c", "#8a5d00"
	case "danger", "error":
		return "#fff1f0", "#f5c2c0", "#a82a2a"
	case "info":
		return "#eef4fb", "#cfdced", "#21538f"
	default:
		return "#f7fafc", "#d8e2eb", "#486581"
	}
}

func calloutToneColors(tone string) (background, border, accent string) {
	switch strings.ToLower(strings.TrimSpace(tone)) {
	case "success", "good":
		return "#eef9ef", "#b6e2be", "#1e6e37"
	case "warning", "caution":
		return "#fff8e3", "#f2d98b", "#92620c"
	case "danger", "error":
		return "#fdeded", "#f0bbbb", "#99293a"
	case "info", "setup", "restriction", "accent":
		return "#f0eeff", "#c8c4f5", "#5147a6"
	default:
		return "#f2f4f7", "#d8dee6", "#475467"
	}
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
	number, numeric := numberValue(value)
	if numeric {
		switch strings.ToLower(format) {
		case "currency":
			return "$" + formatGroupedFixed(number, 2)
		case "percent":
			return fmt.Sprintf("%.1f%%", number)
		case "percentfraction":
			return fmt.Sprintf("%.1f%%", number*100)
		case "integer":
			return formatGroupedFixed(number, 0)
		case "compact", "compactnumber":
			return formatCompactNumber(number)
		case "number":
			return formatTrimmedFixed(number, 3)
		case "number5":
			return formatTrimmedFixed(number, 5)
		default:
			if math.Trunc(number) == number {
				return formatGroupedFixed(number, 0)
			}
			return formatTrimmedFixed(number, 3)
		}
	}
	return fmt.Sprint(value)
}

func formatTrimmedFixed(value float64, precision int) string {
	formatted := strconv.FormatFloat(value, 'f', precision, 64)
	return strings.TrimRight(strings.TrimRight(formatted, "0"), ".")
}

func formatCompactNumber(value float64) string {
	absolute := math.Abs(value)
	divisor, suffix := 1.0, ""
	switch {
	case absolute >= 1_000_000_000:
		divisor, suffix = 1_000_000_000, "B"
	case absolute >= 1_000_000:
		divisor, suffix = 1_000_000, "M"
	case absolute >= 1_000:
		divisor, suffix = 1_000, "K"
	}
	if suffix == "" {
		if math.Trunc(value) == value {
			return formatGroupedFixed(value, 0)
		}
		return strconv.FormatFloat(value, 'f', 3, 64)
	}
	scaled := value / divisor
	precision := 2
	if math.Abs(scaled) >= 100 {
		precision = 0
	} else if math.Abs(scaled) >= 10 {
		precision = 1
	}
	formatted := strconv.FormatFloat(scaled, 'f', precision, 64)
	if strings.Contains(formatted, ".") {
		formatted = strings.TrimRight(strings.TrimRight(formatted, "0"), ".")
	}
	return formatted + suffix
}

func formatGroupedFixed(value float64, precision int) string {
	formatted := strconv.FormatFloat(value, 'f', precision, 64)
	parts := strings.SplitN(formatted, ".", 2)
	sign, whole := "", parts[0]
	if strings.HasPrefix(whole, "-") {
		sign, whole = "-", strings.TrimPrefix(whole, "-")
	}
	for index := len(whole) - 3; index > 0; index -= 3 {
		whole = whole[:index] + "," + whole[index:]
	}
	if len(parts) == 2 {
		return sign + whole + "." + parts[1]
	}
	return sign + whole
}

func fitTableText(value string, width, fontSize float64) string {
	runes := []rune(value)
	maxRunes := int(width / (fontSize * 0.54))
	if maxRunes < 2 || len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes-1]) + "…"
}

func estimatedWrappedLineCount(value string, width, fontSize float64) int {
	return max(1, len(textwrap.Lines(value, width, fontSize)))
}

func resolveColumnLayout(columns []map[string]any, rows []map[string]any, left, totalWidth float64) ([]float64, []float64) {
	if len(columns) == 0 {
		return []float64{left}, []float64{totalWidth}
	}
	weights := make([]float64, len(columns))
	totalWeight := 0.0
	for index, column := range columns {
		key := textValue(column["key"])
		numeric := isNumericFormat(textValue(column["format"]))
		for _, row := range rows[:min(50, len(rows))] {
			if _, ok := numberValue(row[key]); ok {
				numeric = true
				break
			}
		}
		longest := len([]rune(textValue(column["label"])))
		if numeric {
			longest = min(12, longest)
		}
		for _, row := range rows[:min(50, len(rows))] {
			displayValue := formatValue(row[key], textValue(column["format"]))
			length := len([]rune(displayValue))
			if length > longest {
				longest = length
			}
		}
		limit := 30
		if numeric {
			limit = 18
			// Preserve at least a signed, grouped 7.2 numeric display atomically.
			longest = max(longest, 13)
		}
		weight := float64(max(7, min(limit, longest)))
		weights[index] = weight
		totalWeight += weight
	}
	positions := make([]float64, len(columns))
	widths := make([]float64, len(columns))
	baseWidth := math.Min(64, (totalWidth/float64(max(1, len(columns))))*0.7)
	flexibleWidth := math.Max(0, totalWidth-(baseWidth*float64(len(columns))))
	x := left
	for index, weight := range weights {
		positions[index] = x
		widths[index] = baseWidth + (flexibleWidth * weight / math.Max(1, totalWeight))
		x += widths[index]
	}
	return positions, widths
}

func isNumericFormat(format string) bool {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "number", "integer", "currency", "percent", "percentage", "compact", "compactnumber":
		return true
	default:
		return false
	}
}

func buildChartSVG(rows []map[string]any, chartSpec map[string]any, width, height float64) string {
	xField := textValue(chartSpec["xField"])
	yFields := stringSlice(chartSpec["yFields"])
	if len(yFields) == 0 {
		return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f"><text x="12" y="24" font-size="12" fill="#667085">No chart measures configured</text></svg>`, width, height)
	}
	chartType := strings.ToLower(textValue(chartSpec["type"]))
	if chartType == "donut" || chartType == "pie" {
		return buildDonutChartSVG(rows, chartSpec, width, height)
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

func buildDonutChartSVG(rows []map[string]any, chartSpec map[string]any, width, height float64) string {
	xField := textValue(chartSpec["xField"])
	yFields := stringSlice(chartSpec["yFields"])
	if len(yFields) == 0 {
		return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f"><text x="12" y="24" font-size="12" fill="#667085">No chart measure configured</text></svg>`, width, height)
	}
	valueField := yFields[0]
	total := 0.0
	values := make([]float64, len(rows))
	for index, row := range rows {
		value, _ := numberValue(row[valueField])
		if value < 0 {
			value = 0
		}
		values[index] = value
		total += value
	}
	if total <= 0 {
		total = 1
	}
	palette := stringSlice(chartSpec["palette"])
	if len(palette) == 0 {
		palette = []string{"#3857d6", "#2aa198", "#f0a43c", "#d65b7b", "#7b61c9"}
	}
	cx, cy := width*0.32, height*0.48
	radius := math.Min(width*0.18, height*0.31)
	strokeWidth := math.Max(14, radius*0.36)
	startAngle := -math.Pi / 2
	var svg strings.Builder
	fmt.Fprintf(&svg, `<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f">`, width, height)
	fmt.Fprintf(&svg, `<rect width="%.0f" height="%.0f" rx="8" fill="#ffffff" stroke="#dfe6ef"/>`, width, height)
	for index, value := range values {
		if value <= 0 {
			continue
		}
		endAngle := startAngle + (value/total)*2*math.Pi
		steps := max(3, int(math.Ceil((endAngle-startAngle)/(math.Pi/32))))
		points := make([]string, 0, steps+1)
		for step := 0; step <= steps; step++ {
			angle := startAngle + (endAngle-startAngle)*float64(step)/float64(steps)
			points = append(points, fmt.Sprintf("%.2f %.2f", cx+radius*math.Cos(angle), cy+radius*math.Sin(angle)))
		}
		fmt.Fprintf(&svg, `<path d="M %s" fill="none" stroke="%s" stroke-width="%.1f"/>`, strings.Join(points, " L "), palette[index%len(palette)], strokeWidth)
		startAngle = endAngle
	}
	fmt.Fprintf(&svg, `<circle cx="%.2f" cy="%.2f" r="%.2f" fill="#ffffff"/>`, cx, cy, math.Max(1, radius-strokeWidth*0.62))
	legendX, legendY := width*0.61, 28.0
	for index, row := range rows {
		if index >= 8 {
			break
		}
		label := html.EscapeString(textValue(row[xField]))
		pct := values[index] / total * 100
		y := legendY + float64(index)*19
		fmt.Fprintf(&svg, `<rect x="%.1f" y="%.1f" width="10" height="10" rx="2" fill="%s"/>`, legendX, y-8, palette[index%len(palette)])
		fmt.Fprintf(&svg, `<text x="%.1f" y="%.1f" font-size="10" fill="#344054">%s %.0f%%</text>`, legendX+16, y, label, pct)
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
	// Authored tables can legitimately contain blank cells. ReportPrint text
	// elements, however, require non-empty text. Render missing display values
	// with the same em dash used by formatValue(nil, ...) so a sparse dataset
	// cannot invalidate the entire PDF export.
	if strings.TrimSpace(text) == "" {
		text = "—"
	}
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
