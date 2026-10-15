// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
// Package overlay defines the canonical types for the agently overlay
// layer — per §5 of doc/lookups.md. Overlays live entirely server-side:
// they load in the Go backend, match against incoming JSON Schemas, and emit
// forge Item.Lookup metadata onto matched properties. The client never sees
// an overlay file — only the already-refined schema.
package overlay

import identity "github.com/viant/forge/backend/resource"

// Mode controls how a single overlay resolves against a schema. It is a
// per-overlay property: two overlays targeting the same schema can have
// different modes and compose without interference.
type Mode string

const (
	// ModeStrict requires every binding in the overlay to match. Any
	// unmatched binding discards the whole overlay.
	ModeStrict Mode = "strict"

	// ModePartial (default) applies each binding that matches; unmatched
	// bindings are silently skipped; unmatched schema properties are
	// untouched.
	ModePartial Mode = "partial"

	// ModeThreshold applies the overlay iff at least Threshold bindings
	// matched. Below threshold → the whole overlay is discarded.
	ModeThreshold Mode = "threshold"
)

// Overlay is a single extension/forge/lookups/*.yaml file.
type Overlay struct {
	Resource *identity.ResolvedResource `json:"-" yaml:"-"`
	// ID uniquely identifies the overlay. Used for tie-break in
	// composition and for operator visibility.
	ID string `json:"id" yaml:"id"`

	// Priority. Higher overlays win on path collisions during composition.
	// Default 0.
	Priority int `json:"priority,omitempty" yaml:"priority,omitempty"`

	// Target describes which render contexts this overlay can apply to.
	Target Target `json:"target" yaml:"target"`

	// Mode (default ModePartial).
	Mode Mode `json:"mode,omitempty" yaml:"mode,omitempty"`

	// Threshold (only used when Mode == ModeThreshold).
	Threshold int `json:"threshold,omitempty" yaml:"threshold,omitempty"`

	// Bindings declared by the overlay. Each matches independently.
	Bindings []Binding `json:"bindings,omitempty" yaml:"bindings,omitempty"`
}

// Target picks the render context(s) this overlay may apply to.
type Target struct {
	// Kind is one of: template | tool | elicitation | prompt | chat-composer.
	// The framework accepts any kind string — workspaces may coin their own.
	Kind string `json:"kind" yaml:"kind"`

	// ID matches a target by exact id.
	ID string `json:"id,omitempty" yaml:"id,omitempty"`

	// IDGlob matches a target by glob (uses '*' wildcards).
	IDGlob string `json:"idGlob,omitempty" yaml:"idGlob,omitempty"`

	// SchemaContains requires the incoming schema to have all these
	// property names. Useful as a weak matcher for ad-hoc tool schemas.
	SchemaContains []string `json:"schemaContains,omitempty" yaml:"schemaContains,omitempty"`
}

// Binding attaches a lookup to one or more schema properties.
type Binding struct {
	// Match decides which property/properties this binding applies to.
	Match Match `json:"match" yaml:"match"`

	// Lookup carries forge Item.Lookup metadata (dialog ref, inputs,
	// outputs, display) plus optional named-token declaration.
	Lookup Lookup `json:"lookup,omitempty" yaml:"lookup,omitempty"`

	// Named declares this binding participates in hotkey / authored-text
	// activation (Activations b and c). The `name` is what users type after
	// the trigger character.
	Named *NamedToken `json:"named,omitempty" yaml:"named,omitempty"`
}

// Match describes how a binding finds a property in the schema.
// Exactly one locator should be set. Type/Format constraints further narrow
// matches.
type Match struct {
	// Path is an exact JSONPath (only $.properties.<name> is supported at
	// v1; deeper paths are out of scope).
	Path string `json:"path,omitempty" yaml:"path,omitempty"`

	// PathGlob is a glob (e.g. "$.properties.*_id").
	PathGlob string `json:"pathGlob,omitempty" yaml:"pathGlob,omitempty"`

	// FieldName is a property name at any depth (v1: top-level only).
	FieldName string `json:"fieldName,omitempty" yaml:"fieldName,omitempty"`

	// FieldNameRegex matches property names by regex.
	FieldNameRegex string `json:"fieldNameRegex,omitempty" yaml:"fieldNameRegex,omitempty"`

	// Type narrows the matches to JSON Schema "type" equality.
	Type string `json:"type,omitempty" yaml:"type,omitempty"`

	// Format narrows the matches to JSON Schema "format" equality.
	Format string `json:"format,omitempty" yaml:"format,omitempty"`
}

// Lookup carries forge Item.Lookup fields plus the datasource id to resolve.
type Lookup struct {
	DataSourceResource *identity.ResourceRef `json:"dataSourceResource,omitempty" yaml:"-"`
	PickerResource     *identity.ResourceRef `json:"pickerResource,omitempty" yaml:"-"`
	ProviderIdentity   string                `json:"providerIdentity,omitempty" yaml:"-"`
	// DataSource is the id of an extension/forge/datasources/*.yaml entry.
	DataSource string `json:"dataSource,omitempty" yaml:"dataSource,omitempty"`

	// DialogId references a forge dialog (extension/forge/dialogs/*.yaml).
	DialogId string `json:"dialogId,omitempty" yaml:"dialogId,omitempty"`

	// WindowId is an alternative to DialogId (see forge Lookup struct).
	WindowId string `json:"windowId,omitempty" yaml:"windowId,omitempty"`

	// Inputs mirrors forge Parameter — defaults apply at render time
	// (:form → :query).
	Inputs []Parameter `json:"inputs,omitempty" yaml:"inputs,omitempty"`

	// Outputs mirrors forge Parameter — defaults apply at render time
	// (:output → :form, location defaults to name).
	Outputs []Parameter `json:"outputs,omitempty" yaml:"outputs,omitempty"`

	// Display is a template like "${name} (#${id})" used for chip text or
	// post-selection rendering. Velty-style placeholder syntax.
	Display string `json:"display,omitempty" yaml:"display,omitempty"`

	// QueryInput declares which datasource input should receive free-text
	// search text when a client offers inline lookup filtering. Usually "q".
	QueryInput string `json:"queryInput,omitempty" yaml:"queryInput,omitempty"`

	// ResolveInput declares which datasource input should receive an exact
	// value/id when a client performs blur-time resolution without opening the
	// lookup dialog. When omitted, clients must not guess.
	ResolveInput string `json:"resolveInput,omitempty" yaml:"resolveInput,omitempty"`
}

// Parameter is a trimmed mirror of forge types.Parameter, enough to round-trip
// Inputs/Outputs through the overlay layer without importing forge into
// protocol/ packages.
type Parameter struct {
	From     string `json:"from,omitempty" yaml:"from,omitempty"`
	To       string `json:"to,omitempty" yaml:"to,omitempty"`
	Name     string `json:"name" yaml:"name"`
	Location string `json:"location,omitempty" yaml:"location,omitempty"`
}

// NamedToken declares this binding participates in /name activation (hotkey
// live typing + authored /name in starting prompts).
type NamedToken struct {
	// Trigger is the prefix char. Defaults to "/" when empty.
	Trigger string `json:"trigger,omitempty" yaml:"trigger,omitempty"`

	// Name is what the user types after the trigger.
	Name string `json:"name" yaml:"name"`

	// Title is a user-facing label for menus and pickers. When empty, clients
	// may fall back to a humanized name, but producers should prefer emitting it.
	Title string `json:"title,omitempty" yaml:"title,omitempty"`

	// Required — if true, unresolved authored tokens block form submit.
	Required bool `json:"required,omitempty" yaml:"required,omitempty"`

	// QueryInput — which datasource input gets the typed text during live
	// filtering. Usually "q".
	QueryInput string `json:"queryInput,omitempty" yaml:"queryInput,omitempty"`

	// ResolveInput — which datasource input should receive an exact id/value
	// when a client performs blur-time resolution without opening the lookup
	// dialog. When omitted, clients must not guess.
	ResolveInput string `json:"resolveInput,omitempty" yaml:"resolveInput,omitempty"`

	// Token formatting — store, display, modelForm are velty-style
	// templates over the selected row.
	Store     string `json:"store,omitempty" yaml:"store,omitempty"`
	Display   string `json:"display,omitempty" yaml:"display,omitempty"`
	ModelForm string `json:"modelForm,omitempty" yaml:"modelForm,omitempty"`
}

// RegistryEntry is the shape returned by GET /v1/api/lookups/registry?context=...
// The registry is composed server-side from overlays whose Named bindings match
// the current context.
type RegistryEntry struct {
	DataSourceResource *identity.ResourceRef `json:"dataSourceResource,omitempty"`
	PickerResource     *identity.ResourceRef `json:"pickerResource,omitempty"`
	ProviderIdentity   string                `json:"providerIdentity,omitempty"`
	Name               string                `json:"name"`
	Title              string                `json:"title,omitempty"`
	DataSource         string                `json:"dataSource"`
	DialogId           string                `json:"dialogId,omitempty"`
	WindowId           string                `json:"windowId,omitempty"`
	Trigger            string                `json:"trigger,omitempty"`
	Required           bool                  `json:"required,omitempty"`
	Display            string                `json:"display,omitempty"`
	Token              *TokenFormat          `json:"token,omitempty"`
	Inputs             []Parameter           `json:"inputs,omitempty"`
	Outputs            []Parameter           `json:"outputs,omitempty"`
	Extra              map[string]string     `json:"extra,omitempty"`
}

// TokenFormat duplicates NamedToken's three template fields so the HTTP
// response is stable under YAML schema evolution.
type TokenFormat struct {
	Store        string `json:"store,omitempty"`
	Display      string `json:"display,omitempty"`
	ModelForm    string `json:"modelForm,omitempty"`
	QueryInput   string `json:"queryInput,omitempty"`
	ResolveInput string `json:"resolveInput,omitempty"`
}
