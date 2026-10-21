// Package uimetadata projects an already-authorized, selected Forge definition
// into bounded declarative UI metadata. It never evaluates conditions, loads
// options, fetches business data, opens windows or invokes actions.
package uimetadata

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/viant/forge/backend/types"
)

const MaxNodes = 100
const MaxScan = 12000
const MaxDepth = 48
const MaxOptions = 20
const MaxText = 240
const MaxPageBytes = 32768

// Query selects one subtree by a returned metadata path, or an unambiguous
// authored id. Paths are structural identifiers, never filesystem locations.
// Target is the public target selector only; runtime proof and dependency pins
// never enter metadata tool inputs or outputs.
type Target struct {
	Platform     string   `json:"platform,omitempty"`
	FormFactor   string   `json:"formFactor,omitempty"`
	Surface      string   `json:"surface,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
}

func PublicTarget(target *types.WindowTarget) *Target {
	if target == nil {
		return nil
	}
	return &Target{Platform: target.Platform, FormFactor: target.FormFactor, Surface: target.Surface, Capabilities: append([]string(nil), target.Capabilities...)}
}
func (t *Target) WindowTarget() *types.WindowTarget {
	if t == nil {
		return nil
	}
	return &types.WindowTarget{Platform: t.Platform, FormFactor: t.FormFactor, Surface: t.Surface, Capabilities: append([]string(nil), t.Capabilities...)}
}

type Query struct {
	Path     string `json:"path,omitempty"`
	ID       string `json:"id,omitempty"`
	Cursor   string `json:"cursor,omitempty"`
	MaxNodes int    `json:"maxNodes,omitempty"`
}
type Option struct {
	Label         string `json:"label,omitempty"`
	Value         any    `json:"value"`
	ValueOmitted  bool   `json:"valueOmitted,omitempty"`
	TextTruncated bool   `json:"textTruncated,omitempty"`
}
type Options struct {
	Source    string   `json:"source"`
	Loaded    bool     `json:"loaded"`
	Items     []Option `json:"items,omitempty"`
	Truncated bool     `json:"truncated,omitempty"`
	Path      string   `json:"path,omitempty"`
	Total     int      `json:"total,omitempty"`
}
type Node struct {
	Path         string         `json:"path"`
	ParentPath   string         `json:"parentPath,omitempty"`
	ID           string         `json:"id,omitempty"`
	Kind         string         `json:"kind"`
	Label        string         `json:"label,omitempty"`
	Field        string         `json:"field,omitempty"`
	DataType     string         `json:"dataType,omitempty"`
	ControlType  string         `json:"controlType,omitempty"`
	Constraints  map[string]any `json:"constraints,omitempty"`
	ReadOnly     bool           `json:"readOnly,omitempty"`
	Disabled     bool           `json:"disabled,omitempty"`
	Conditional  []string       `json:"conditional,omitempty"`
	Availability string         `json:"availability"`
	Options      *Options       `json:"options,omitempty"`
	Option       *Option        `json:"option,omitempty"`
	// DeclaredActions describe authored intent, not currently registered actions.
	// Operate must obtain current control state before an action can execute.
	DeclaredActions []string `json:"declaredActions,omitempty"`
	Sensitive       bool     `json:"sensitive,omitempty"`
	HasChildren     bool     `json:"hasChildren,omitempty"`
}
type Page struct {
	WindowKey                           string `json:"windowKey,omitempty"`
	Title                               string `json:"title,omitempty"`
	Nodes                               []Node `json:"nodes"`
	NextCursor                          string `json:"nextCursor,omitempty"`
	Truncated                           bool   `json:"truncated,omitempty"`
	Coverage                            string `json:"coverage"`
	ExecutionRequiresCurrentControlRead bool   `json:"executionRequiresCurrentControlRead"`
}
type cursor struct {
	Revision string `json:"r"`
	Scope    string `json:"s"`
	Offset   int    `json:"o"`
}
type projector struct {
	nodes      []Node
	visited    int
	truncated  bool
	schemas    map[string]types.ResourceSchema
	models     map[string]types.ResourceModel
	sources    map[string]string
	optionSets map[string][]any
}

// Project accepts trusted selected definition bytes only. The embedding host is
// responsible for user/conversation/resource admission on EVERY request/page.
func Project(window *types.Window, query Query) (*Page, error) {
	if window == nil {
		return nil, errors.New("selected window definition is required")
	}
	if len(query.ID) > MaxText {
		return nil, errors.New("metadata node id is too long")
	}
	if query.MaxNodes < 0 || query.MaxNodes > MaxNodes {
		return nil, fmt.Errorf("maxNodes must be between 1 and %d", MaxNodes)
	}
	if query.Path != "" && query.ID != "" {
		return nil, errors.New("select path or id, not both")
	}
	if err := validatePath(query.Path); err != nil {
		return nil, err
	}
	limit := query.MaxNodes
	if limit == 0 {
		limit = 25
	}
	p := &projector{schemas: window.Schemas, models: window.ResourceModels, sources: map[string]string{}, optionSets: map[string][]any{}}
	for id, source := range window.DataSource {
		for _, model := range window.ResourceModels {
			if model.Read != nil && model.Read.DataSourceRef == id {
				p.sources[id] = model.SchemaRef
			}
		}
		if model, ok := window.ResourceModels[source.ResourceModelRef]; ok {
			p.sources[id] = model.SchemaRef
		}
	}
	// Marshal UI shape only: never serialize datasource backends, code, authority
	// bindings, execution hooks, parameters or live values into the result.
	raw, err := json.Marshal(struct {
		View       types.View               `json:"view"`
		Dialogs    []types.Dialog           `json:"dialogs,omitempty"`
		Parameters []map[string]interface{} `json:"parameters,omitempty"`
	}{window.View, window.Dialogs, window.Parameters})
	if err != nil {
		return nil, errors.New("invalid selected UI metadata")
	}
	var root map[string]any
	if err = json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	p.walk(root, "", "", 0, "window", "")
	scope := query.Path
	if query.ID != "" {
		for _, node := range p.nodes {
			if node.ID == query.ID {
				if scope != "" {
					return nil, errors.New("ambiguous metadata id; select its returned path")
				}
				scope = node.Path
			}
		}
		if scope == "" {
			return nil, errors.New("metadata id not found")
		}
	}
	if scope != "" {
		found := false
		for _, node := range p.nodes {
			if node.Path == scope {
				found = true
				break
			}
		}
		if !found {
			_, _, found = p.optionAtPath(scope)
		}
		if !found {
			return nil, errors.New("metadata path not found")
		}
	}
	nodes := make([]Node, 0)
	for _, node := range p.nodes {
		if scope == "" || node.Path == scope || strings.HasPrefix(node.Path, scope+"/") {
			nodes = append(nodes, node)
		}
	}
	total := len(nodes)
	nodeAt := func(index int) Node { return nodes[index] }
	if choices, ok := p.optionSets[scope]; ok {
		total = len(choices)
		nodeAt = func(index int) Node {
			option := projectOption(choices[index])
			return Node{Path: join(scope, strconv.Itoa(index)), ParentPath: scope, Kind: "option", Label: option.Label, Availability: "declaration", Option: &option}
		}

	} else if optionRoot, index, ok := p.optionAtPath(scope); ok {
		total = 1
		nodeAt = func(int) Node {
			option := projectOption(p.optionSets[optionRoot][index])
			return Node{Path: scope, ParentPath: optionRoot, Kind: "option", Label: option.Label, Availability: "declaration", Option: &option}
		}
	}
	var selectedResourceURI, selectedRevision, selectedFingerprint string
	if window.Resource != nil {
		selectedResourceURI = window.Resource.URI
		selectedRevision = window.Resource.Revision
		selectedFingerprint = window.Resource.ContentFingerprint
	}
	digestBytes, digestErr := json.Marshal(struct {
		Key         string
		URI         string
		Revision    string
		Fingerprint string
		Target      *Target
		Nodes       []Node
		OptionSets  map[string][]any
	}{window.WindowKey, selectedResourceURI, selectedRevision, selectedFingerprint, PublicTarget(window.ResourceTarget), p.nodes, p.optionSets})
	if digestErr != nil {
		return nil, errors.New("invalid static option metadata")
	}
	sum := sha256.Sum256(digestBytes)
	revision := hex.EncodeToString(sum[:])
	start := 0
	if query.Cursor != "" {
		if len(query.Cursor) > 512 {
			return nil, errors.New("invalid metadata cursor")
		}
		bytes, e := base64.RawURLEncoding.DecodeString(query.Cursor)
		if e != nil {
			return nil, errors.New("invalid metadata cursor")
		}
		var c cursor
		if e = json.Unmarshal(bytes, &c); e != nil || c.Revision != revision || c.Scope != scope || c.Offset < 0 || c.Offset >= total {
			return nil, errors.New("stale or mismatched metadata cursor")
		}
		start = c.Offset
	}
	end := start + limit
	if end > total {
		end = total
	}
	used := 0
	pageNodes := make([]Node, 0, end-start)
	for index := start; index < end; index++ {
		node := nodeAt(index)
		bytes, _ := json.Marshal(node)
		if used+len(bytes) > MaxPageBytes && index > start {
			end = index
			break
		}
		used += len(bytes)
		pageNodes = append(pageNodes, node)
	}
	result := &Page{WindowKey: text(window.WindowKey), Title: text(window.Title), Nodes: pageNodes, Truncated: p.truncated, Coverage: "selected definition declarations only; conditional availability and dynamic options are not evaluated", ExecutionRequiresCurrentControlRead: true}
	if end < total {
		bytes, _ := json.Marshal(cursor{revision, scope, end})
		result.NextCursor = base64.RawURLEncoding.EncodeToString(bytes)
	}
	return result, nil
}
func validatePath(path string) error {
	if len(path) > 1024 || strings.HasPrefix(path, "/") || strings.Contains(path, "\\") || strings.Contains(path, "%") {
		return errors.New("invalid metadata path")
	}
	for _, segment := range strings.Split(path, "/") {
		if segment == "." || segment == ".." {
			return errors.New("invalid metadata path")
		}
	}
	return nil
}

var children = []string{"view", "content", "parameters", "dialogs", "tabs", "containers", "sections", "children", "schemaBasedForm", "draftForm", "fields", "items", "form", "toolbar", "actions", "buttons", "formActions", "editableCollection", "columns"}

func (p *projector) walk(value any, path, parent string, depth int, kind, schemaRef string) {
	if depth > MaxDepth || p.visited >= MaxScan {
		p.truncated = true
		return
	}
	p.visited++
	if list, ok := value.([]any); ok {
		for i, item := range list {
			if p.visited >= MaxScan {
				p.truncated = true
				break
			}
			p.walk(item, join(path, strconv.Itoa(i)), parent, depth+1, kind, schemaRef)
		}
		return
	}
	obj, ok := value.(map[string]any)
	if !ok {
		return
	}
	if s, ok := obj["dataSourceRef"].(string); ok && p.sources[s] != "" {
		schemaRef = p.sources[s]
	}
	if s, ok := obj["schemaRef"].(string); ok {
		schemaRef = s
	}
	if s, ok := obj["resourceModelRef"].(string); ok && schemaRef == "" {
		if model, ok := p.models[s]; ok {
			schemaRef = model.SchemaRef
		} else {
			schemaRef = s
		}
	}
	id := first(obj, "id", "name")
	label := first(obj, "label", "title", "ariaLabel")
	include := path != "" && (id != "" || label != "" || kind == "form" || kind == "tab" || kind == "field" || kind == "action")
	var n Node
	if include {
		n = Node{Path: path, ParentPath: parent, ID: text(id), Kind: kind, Label: text(label), Availability: "unknown"}
		if typ := first(obj, "type", "widget"); typ != "" {
			n.ControlType = text(typ)
			if kind == "parameter" {
				n.DataType = text(typ)
			}
			switch typ {
			case "string", "integer", "number", "boolean", "array", "object":
				n.DataType = typ
			}
		}
		n.Field = text(first(obj, "field", "name", "dataField", "bindingPath"))
		if schema, ok := p.schemas[schemaRef]; ok {
			fieldKey := strings.TrimPrefix(n.Field, ".")
			if field, ok := schema.Properties[fieldKey]; ok {
				n.DataType = text(field.Type)
				n.ReadOnly = field.ReadOnly
				n.Sensitive = field.WriteOnly
				if field.WriteOnly {
					n.ControlType = "password"
				}
				if field.Minimum != nil {
					obj["minimum"] = *field.Minimum
				}
				if field.Maximum != nil {
					obj["maximum"] = *field.Maximum
				}
				if field.MinLength != nil {
					obj["minLength"] = *field.MinLength
				}
				if field.MaxLength != nil {
					obj["maxLength"] = *field.MaxLength
				}
				for _, required := range schema.Required {
					if required == fieldKey {
						obj["required"] = true
					}
				}
			}
		}
		if props, ok := obj["properties"].(map[string]any); ok {
			for _, key := range []string{"required", "min", "max", "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems", "pattern", "readOnly", "disabled"} {
				if _, declared := obj[key]; !declared {
					if v, exists := props[key]; exists {
						obj[key] = v
					}
				}
			}
		}
		authoredReadOnly, _ := obj["readOnly"].(bool)
		n.ReadOnly = n.ReadOnly || authoredReadOnly
		n.Disabled, _ = obj["disabled"].(bool)
		for _, key := range []string{"visibleWhen", "hiddenWhen", "disabledWhen", "readOnlyWhen", "visibleIf"} {
			if v, ok := obj[key]; ok && v != nil && v != "" {
				n.Conditional = append(n.Conditional, key)
			}
		}
		n.Sensitive = n.Sensitive || sensitive(id+" "+n.Field+" "+n.DataType+" "+n.ControlType)
		for _, key := range []string{"required", "min", "max", "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems", "pattern"} {
			if v, ok := scalar(obj[key]); ok {
				if n.Constraints == nil {
					n.Constraints = map[string]any{}
				}
				n.Constraints[key] = v
			}
		}
		if options, ok := obj["options"].([]any); ok && !n.Sensitive {
			n.Options = staticOptions(options)
		} else if enums, ok := obj["enum"].([]any); ok && !n.Sensitive {
			n.Options = staticOptions(enums)
		}
		if ref := first(obj, "optionsDataSourceRef", "fallbackOptionsDataSourceRef"); ref != "" {
			n.Options = &Options{Source: text(ref), Loaded: false}
		}
		if ref := first(obj, "optionsField"); ref != "" && n.Options == nil {
			n.Options = &Options{Source: "field:" + text(ref), Loaded: false}
		}
		if n.DataType == "" && (kind == "control" || kind == "field") {
			n.DataType = "unknown"
		}
		if obj["mutation"] != nil {
			n.DeclaredActions = append(n.DeclaredActions, "mutation")
		}
		if obj["handler"] != nil {
			n.DeclaredActions = append(n.DeclaredActions, "handler")
		}
		// These are declaration kinds only. A handler declaration does not prove
		// that a runtime control registered an executable click/setValue action.

		if kind == "form" {
			if obj["submit"] != nil {
				n.DeclaredActions = append(n.DeclaredActions, "submit")
			}
			if first(obj, "resetLabel", "onReset") != "" {
				n.DeclaredActions = append(n.DeclaredActions, "reset")
			}
		}
		for _, event := range []string{"onClick", "onChange", "onSubmit", "onReset"} {
			if obj[event] != nil {
				n.DeclaredActions = append(n.DeclaredActions, event)
			}
		}
		if n.Sensitive {
			n.Options = nil
			n.Constraints = nil
		}
		if n.Options != nil && n.Options.Source == "static" && !n.Sensitive {
			choices, _ := obj["options"].([]any)
			if choices == nil {
				choices, _ = obj["enum"].([]any)
			}
			n.Options.Path = join(path, "options")
			n.Options.Total = len(choices)
			p.optionSets[n.Options.Path] = choices
		}
		p.nodes = append(p.nodes, n)
		parent = path
	}
	before := len(p.nodes)
	if include {
		defer func() {
			if len(p.nodes) > before {
				p.nodes[before-1].HasChildren = true
			}
		}()
	}
	if include && n.Options != nil && n.Options.Source == "static" && !n.Sensitive {
		p.nodes = append(p.nodes, Node{Path: n.Options.Path, ParentPath: path, Kind: "options", Availability: "declaration", HasChildren: n.Options.Total > 0})
	}
	for _, key := range children {
		child, ok := obj[key]
		if !ok {
			continue
		}
		childKind := map[string]string{"tabs": "tabset", "schemaBasedForm": "form", "draftForm": "form", "form": "form", "fields": "field", "items": "control", "actions": "action", "buttons": "action", "formActions": "action", "columns": "column", "dialogs": "dialog", "parameters": "parameter"}[key]
		if key == "containers" && (obj["tabs"] != nil || obj["stableTabs"] != nil) {
			childKind = "tab"
		}
		if childKind == "" {
			childKind = "container"
		}
		p.walk(child, join(path, key), parent, depth+1, childKind, schemaRef)
	}
	if include && len(p.nodes) > before {
		p.nodes[before-1].HasChildren = true
	}
	// Resource schemas describe unloaded generated form fields without running a
	// renderer or a datasource. Only the explicitly referenced schema is used.
	if kind == "form" {
		if schema, ok := p.schemas[schemaRef]; ok {
			keys := make([]string, 0, len(schema.Properties))
			for key := range schema.Properties {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			for _, key := range keys {
				field := schema.Properties[key]
				obj := map[string]any{"name": key, "type": field.Type, "readOnly": field.ReadOnly}
				for _, required := range schema.Required {
					if required == key {
						obj["required"] = true
					}
				}
				if field.Minimum != nil {
					obj["minimum"] = *field.Minimum
				}
				if field.Maximum != nil {
					obj["maximum"] = *field.Maximum
				}
				if field.MinLength != nil {
					obj["minLength"] = *field.MinLength
				}
				if field.MaxLength != nil {
					obj["maxLength"] = *field.MaxLength
				}
				if field.WriteOnly {
					obj["type"] = "password"
				}
				if len(field.Enum) > 0 {
					obj["enum"] = field.Enum
				}
				p.walk(obj, join(path, "schema/"+escape(key)), parent, depth+1, "field", "")
			}
		}
	}
}
func (p *projector) optionAtPath(path string) (string, int, bool) {
	last := strings.LastIndex(path, "/")
	if last < 0 {
		return "", 0, false
	}
	root := path[:last]
	choices, ok := p.optionSets[root]
	if !ok {
		return "", 0, false
	}
	suffix := path[last+1:]
	index, err := strconv.Atoi(suffix)
	if err != nil || index < 0 || index >= len(choices) || strconv.Itoa(index) != suffix {
		return "", 0, false
	}
	return root, index, true
}

func projectOption(value any) Option {
	option := Option{}
	if obj, ok := value.(map[string]any); ok {
		rawLabel := first(obj, "label", "name", "title")
		option.Label = text(rawLabel)
		option.TextTruncated = utf8.RuneCountInString(rawLabel) > MaxText
		raw, exists := obj["value"]
		if !exists {
			option.ValueOmitted = true
			return option
		}
		value = raw
	}
	if value == nil {
		return option
	}
	if v, ok := scalar(value); ok {
		option.Value = v
		if raw, ok := value.(string); ok {
			option.TextTruncated = option.TextTruncated || utf8.RuneCountInString(raw) > MaxText
		}
		return option
	}
	option.ValueOmitted = true
	return option
}
func staticOptions(values []any) *Options {
	o := &Options{Source: "static", Loaded: true, Total: len(values)}
	for i, value := range values {
		if i >= MaxOptions {
			o.Truncated = true
			break
		}
		o.Items = append(o.Items, projectOption(value))
	}
	return o
}

func scalar(value any) (any, bool) {
	switch v := value.(type) {
	case string:
		return text(v), true
	case bool, float64, int:
		return v, true
	}
	return nil, false
}
func first(obj map[string]any, keys ...string) string {
	for _, key := range keys {
		if s, ok := obj[key].(string); ok && s != "" {
			return s
		}
	}
	return ""
}
func text(value string) string {
	value = strings.Map(func(r rune) rune {
		if r < ' ' && r != '\t' {
			return ' '
		}
		return r
	}, value)
	if utf8.RuneCountInString(value) > MaxText {
		return string([]rune(value)[:MaxText]) + "…"
	}
	return value
}
func sensitive(value string) bool {
	value = strings.ToLower(value)
	for _, key := range []string{"password", "secret", "credential", "accesstoken", "refreshtoken", "privatekey", "apikey", "token", "cookie"} {
		if strings.Contains(strings.ReplaceAll(strings.ReplaceAll(value, "_", ""), "-", ""), key) {
			return true
		}
	}
	return false
}
func escape(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "~", "~0"), "/", "~1")
}
func join(parent, key string) string {
	if parent == "" {
		return key
	}
	return parent + "/" + key
}
