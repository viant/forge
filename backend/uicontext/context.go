package uicontext

import (
	"encoding/json"
	"regexp"
	"sort"
	"strings"
)

// Context is advisory state exposed by Forge, never permission or tool
// input authority. Do not reconstruct it from arbitrary rows or form contents.
type Context struct {
	Version   int      `json:"version"`
	Revision  uint32   `json:"revision"`
	Tabs      []Tab    `json:"tabs"`
	Sources   []Source `json:"sources"`
	Dialogs   []Dialog `json:"dialogs"`
	Truncated bool     `json:"truncated,omitempty"`
}
type Tab struct {
	ContainerID string `json:"containerId"`
	TabID       string `json:"tabId"`
}
type Dialog struct {
	ID   string `json:"id"`
	Open bool   `json:"open"`
}
type Sort struct {
	Field     string `json:"field"`
	Direction string `json:"direction"`
}
type Source struct {
	DataSourceRef      string                   `json:"dataSourceRef"`
	SelectedIDs        []interface{}            `json:"selectedIds"`
	SelectedIdentities []map[string]interface{} `json:"selectedIdentities,omitempty"`
	Filters            map[string]interface{}   `json:"filters,omitempty"`
	Sort               []Sort                   `json:"sort,omitempty"`
	Page               int                      `json:"page,omitempty"`
	PageSize           int                      `json:"pageSize,omitempty"`
	Dirty              *bool                    `json:"dirty,omitempty"`
	ChangedFields      []string                 `json:"changedFields,omitempty"`
}

var sensitiveUIKey = regexp.MustCompile(`(?i)password|passwd|secret|token|credential|authorization|cookie|apikey|privatekey|accesskey|signingkey|sessionid|csrf|authheader|authz|localstateowner|authoritybinding|selectiontoken|executionproof|dependencypins|resourcetoken|targettoken`)
var credentialUIValue = regexp.MustCompile(`(?i)^(bearer\s|eyJ[A-Za-z0-9_-]+\.)`)

func SensitiveKey(key string) bool {
	return sensitiveUIKey.MatchString(strings.NewReplacer("_", "", "-", "", ".", "", " ", "").Replace(key))
}
func safeUIText(value string) bool {
	return value != "" && len(value) <= 128 && !credentialUIValue.MatchString(value) && !isCredentialText(value)
}
func safeUIScalar(value interface{}) (interface{}, bool) {
	switch v := value.(type) {
	case string:
		return v, safeUIText(v)
	case float64, bool, json.Number:
		return v, true
	case nil:
		return nil, false
	}
	return nil, false
}
func safeUIValue(value interface{}) (interface{}, bool) {
	if list, ok := value.([]interface{}); ok {
		out := []interface{}{}
		for i, v := range list {
			if i == 8 {
				break
			}
			if clean, ok := safeUIScalar(v); ok {
				out = append(out, clean)
			}
		}
		return out, true
	}
	return safeUIScalar(value)
}
func limitUIKeys(values map[string]interface{}) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	if len(keys) > 12 {
		keys = keys[:12]
	}
	return keys
}

type Input struct {
	SemanticContext map[string]interface{}
	DataSourceRefs  []string
	Metadata        map[string]interface{}
}

// Project validates and redacts the UI-exposed current-state contract. The host
// must independently bind its input to the current verified actor/chat/window.
func Project(win *Input) *Context {
	if win == nil || len(win.SemanticContext) == 0 {
		return nil
	}
	raw, err := json.Marshal(win.SemanticContext)
	if err != nil || len(raw) > 32768 {
		return nil
	}
	var supplied Context
	if json.Unmarshal(raw, &supplied) != nil || supplied.Version != 1 {
		return nil
	}
	out := &Context{Version: 1, Revision: supplied.Revision, Tabs: []Tab{}, Sources: []Source{}, Dialogs: []Dialog{}, Truncated: supplied.Truncated}
	for i, tab := range supplied.Tabs {
		if i == 12 {
			break
		}
		if safeUIText(tab.ContainerID) && safeUIText(tab.TabID) {
			out.Tabs = append(out.Tabs, tab)
		}
	}
	sensitive, complete := collectSensitiveFields(win.Metadata)
	if !complete {
		return nil
	}
	declaredSources := map[string]bool{}
	for _, ref := range win.DataSourceRefs {
		declaredSources[ref] = true
	}
	for i, source := range supplied.Sources {
		if i == 12 {
			out.Truncated = true
			break
		}
		if !declaredSources[source.DataSourceRef] {
			continue
		}
		if !safeUIText(source.DataSourceRef) || SensitiveKey(source.DataSourceRef) {
			continue
		}
		clean := Source{DataSourceRef: source.DataSourceRef, SelectedIDs: []interface{}{}, Dirty: source.Dirty}
		for i, id := range source.SelectedIDs {
			if i == 12 {
				break
			}
			if id, ok := safeUIScalar(id); ok {
				clean.SelectedIDs = append(clean.SelectedIDs, id)
			}
		}
		for i, identity := range source.SelectedIdentities {
			if i == 12 {
				break
			}
			if len(identity) == 0 || len(identity) > 8 {
				continue
			}
			safe := map[string]interface{}{}
			for key, value := range identity {
				if !safeUIText(key) || SensitiveKey(key) {
					continue
				}
				if value, ok := safeUIScalar(value); ok {
					safe[key] = value
				}
			}
			if len(safe) == len(identity) {
				clean.SelectedIdentities = append(clean.SelectedIdentities, safe)
			}
		}
		clean.Filters = map[string]interface{}{}
		for _, key := range limitUIKeys(source.Filters) {
			if !safeUIText(key) || SensitiveKey(key) || sensitive[source.DataSourceRef][key] {
				continue
			}
			if value, ok := safeUIValue(source.Filters[key]); ok {
				clean.Filters[key] = value
			}
		}
		for i, sort := range source.Sort {
			if i == 8 {
				break
			}
			if safeUIText(sort.Field) && !SensitiveKey(sort.Field) && (sort.Direction == "asc" || sort.Direction == "desc") {
				clean.Sort = append(clean.Sort, sort)
			}
		}
		if source.Page > 0 && source.Page <= 1000000 {
			clean.Page = source.Page
		}
		if source.PageSize > 0 && source.PageSize <= 10000 {
			clean.PageSize = source.PageSize
		}
		for i, field := range source.ChangedFields {
			if i == 12 {
				break
			}
			if safeUIText(field) && !SensitiveKey(field) && !sensitive[source.DataSourceRef][field] {
				clean.ChangedFields = append(clean.ChangedFields, field)
			}
		}
		out.Sources = append(out.Sources, clean)
		if data, _ := json.Marshal(out); len(data) > 8192 {
			out.Sources = out.Sources[:len(out.Sources)-1]
			out.Truncated = true
			break
		}
	}
	for i, dialog := range supplied.Dialogs {
		if i == 12 {
			break
		}
		if safeUIText(dialog.ID) {
			out.Dialogs = append(out.Dialogs, dialog)
		}
	}
	for encoded, _ := json.Marshal(out); len(encoded) > 8192; encoded, _ = json.Marshal(out) {
		out.Truncated = true
		if len(out.Sources) > 0 {
			out.Sources = out.Sources[:len(out.Sources)-1]
		} else if len(out.Dialogs) > 0 {
			out.Dialogs = out.Dialogs[:len(out.Dialogs)-1]
		} else if len(out.Tabs) > 0 {
			out.Tabs = out.Tabs[:len(out.Tabs)-1]
		} else {
			break
		}
	}
	return out
}

func SensitiveFields(metadata map[string]interface{}) map[string]map[string]bool {
	result, _ := collectSensitiveFields(metadata)
	return result
}
func collectSensitiveFields(metadata map[string]interface{}) (map[string]map[string]bool, bool) {
	result := map[string]map[string]bool{}
	remaining := 12000
	complete := true
	var walk func(map[string]interface{}, string, int)
	walk = func(node map[string]interface{}, ref string, depth int) {
		if depth > 48 || remaining <= 0 {
			complete = false
			return
		}
		remaining--
		if value, ok := node["dataSourceRef"].(string); ok {
			ref = value
		}
		id, _ := node["id"].(string)
		field, _ := node["dataField"].(string)
		if field == "" {
			field, _ = node["bindingPath"].(string)
		}
		if field == "" {
			field = id
		}
		typ, _ := node["type"].(string)
		properties, _ := node["properties"].(map[string]interface{})
		propertyType, _ := properties["type"].(string)
		format, _ := properties["format"].(string)
		inputType, _ := properties["inputType"].(string)
		if field != "" && (node["sensitive"] == true || node["secret"] == true || properties["sensitive"] == true || properties["secret"] == true || SensitiveKey(format) || SensitiveKey(id) || SensitiveKey(field) || SensitiveKey(typ) || SensitiveKey(propertyType) || SensitiveKey(inputType)) {
			if result[ref] == nil {
				result[ref] = map[string]bool{}
			}
			result[ref][field] = true
			if id != "" {
				result[ref][id] = true
			}
			if position := strings.LastIndex(field, "."); position >= 0 {
				result[ref][field[position+1:]] = true
			}
		}
		for _, key := range []string{"view", "content", "table", "toolbar"} {
			if child, ok := node[key].(map[string]interface{}); ok {
				walk(child, ref, depth+1)
			}
		}
		for _, key := range []string{"items", "containers", "controls"} {
			if list, ok := node[key].([]interface{}); ok {
				for _, entry := range list {
					if child, ok := entry.(map[string]interface{}); ok {
						walk(child, ref, depth+1)
					}
				}
			}
		}
	}
	walk(metadata, "", 0)
	return result, complete
}
