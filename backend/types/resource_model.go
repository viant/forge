package types

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ResourceSchema describes Forge's canonical, transport-independent shape of
// one resource. It intentionally models the bounded validation vocabulary
// needed by renderers and marshallers rather than embedding executable rules.
type ResourceSchema struct {
	Type                 string                         `json:"type,omitempty" yaml:"type,omitempty"`
	Identity             []string                       `json:"identity,omitempty" yaml:"identity,omitempty"`
	Required             []string                       `json:"required,omitempty" yaml:"required,omitempty"`
	Properties           map[string]ResourceFieldSchema `json:"properties,omitempty" yaml:"properties,omitempty"`
	AdditionalProperties *bool                          `json:"additionalProperties,omitempty" yaml:"additionalProperties,omitempty"`
}

// ResourceFieldSchema is the typed field vocabulary shared by web and future
// native interpreters. Ref points to another entry in Window.Schemas.
type ResourceFieldSchema struct {
	Type       string                         `json:"type,omitempty" yaml:"type,omitempty"`
	Ref        string                         `json:"$ref,omitempty" yaml:"$ref,omitempty"`
	Format     string                         `json:"format,omitempty" yaml:"format,omitempty"`
	Nullable   bool                           `json:"nullable,omitempty" yaml:"nullable,omitempty"`
	ReadOnly   bool                           `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	WriteOnly  bool                           `json:"writeOnly,omitempty" yaml:"writeOnly,omitempty"`
	Enum       []interface{}                  `json:"enum,omitempty" yaml:"enum,omitempty"`
	Default    interface{}                    `json:"default,omitempty" yaml:"default,omitempty"`
	Minimum    *float64                       `json:"minimum,omitempty" yaml:"minimum,omitempty"`
	Maximum    *float64                       `json:"maximum,omitempty" yaml:"maximum,omitempty"`
	MinLength  *int                           `json:"minLength,omitempty" yaml:"minLength,omitempty"`
	MaxLength  *int                           `json:"maxLength,omitempty" yaml:"maxLength,omitempty"`
	MinItems   *int                           `json:"minItems,omitempty" yaml:"minItems,omitempty"`
	MaxItems   *int                           `json:"maxItems,omitempty" yaml:"maxItems,omitempty"`
	Items      *ResourceFieldSchema           `json:"items,omitempty" yaml:"items,omitempty"`
	Required   []string                       `json:"required,omitempty" yaml:"required,omitempty"`
	Properties map[string]ResourceFieldSchema `json:"properties,omitempty" yaml:"properties,omitempty"`
}

// ResourceModel binds a canonical schema to asymmetric read/write wire shapes.
// Hooks are optional whole-model escape hatches; field-level executable
// callbacks are deliberately unsupported.
type ResourceModel struct {
	SchemaRef string                          `json:"schemaRef" yaml:"schemaRef"`
	Read      *ResourceReadBinding            `json:"read,omitempty" yaml:"read,omitempty"`
	Write     *ResourceWriteBinding           `json:"write,omitempty" yaml:"write,omitempty"`
	Fields    map[string]ResourceFieldBinding `json:"fields,omitempty" yaml:"fields,omitempty"`
	Hooks     *ResourceModelHooks             `json:"hooks,omitempty" yaml:"hooks,omitempty"`
}

type ResourceReadBinding struct {
	DataSourceRef   string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	PreserveUnbound bool   `json:"preserveUnbound,omitempty" yaml:"preserveUnbound,omitempty"`
}

type ResourceWriteBinding struct {
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	InputPath     string `json:"inputPath,omitempty" yaml:"inputPath,omitempty"`
	Mode          string `json:"mode,omitempty" yaml:"mode,omitempty"` // full|overlayBaseline|changed
	Collection    bool   `json:"collection,omitempty" yaml:"collection,omitempty"`
}

type ResourceFieldBinding struct {
	Read            string                     `json:"read,omitempty" yaml:"read,omitempty"`
	Write           string                     `json:"write,omitempty" yaml:"write,omitempty"`
	Codec           string                     `json:"codec,omitempty" yaml:"codec,omitempty"`
	Trim            bool                       `json:"trim,omitempty" yaml:"trim,omitempty"`
	Empty           EmptyPolicy                `json:"empty,omitempty" yaml:"empty,omitempty"` // preserve|null|omit
	Default         interface{}                `json:"default,omitempty" yaml:"default,omitempty"`
	AlwaysWrite     bool                       `json:"alwaysWrite,omitempty" yaml:"alwaysWrite,omitempty"`
	OmitIfUnchanged bool                       `json:"omitIfUnchanged,omitempty" yaml:"omitIfUnchanged,omitempty"`
	ModelRef        string                     `json:"modelRef,omitempty" yaml:"modelRef,omitempty"`
	Collection      *ResourceCollectionBinding `json:"collection,omitempty" yaml:"collection,omitempty"`
}

func (r *ResourceFieldBinding) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain ResourceFieldBinding
	var decoded plain
	if err := unmarshal(&decoded); err != nil {
		return err
	}
	var raw map[string]interface{}
	if err := unmarshal(&raw); err != nil {
		return err
	}
	if value, present := raw["empty"]; present {
		if err := decoded.Empty.set(value); err != nil {
			return err
		}
	}
	*r = ResourceFieldBinding(decoded)
	return nil
}

type EmptyPolicy string

func (e *EmptyPolicy) set(value interface{}) error {
	if value == nil {
		*e = "null"
		return nil
	}
	policy := strings.ToLower(strings.TrimSpace(fmt.Sprint(value)))
	if policy == "" {
		policy = "preserve"
	}
	if policy != "preserve" && policy != "null" && policy != "omit" {
		return fmt.Errorf("unsupported resource empty policy: %s", policy)
	}
	*e = EmptyPolicy(policy)
	return nil
}

func (e *EmptyPolicy) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var value interface{}
	if err := unmarshal(&value); err != nil {
		return err
	}
	return e.set(value)
}

func (e *EmptyPolicy) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		return e.set(nil)
	}
	var value string
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	return e.set(value)
}

type ResourceCollectionBinding struct {
	ModelRef      string   `json:"modelRef,omitempty" yaml:"modelRef,omitempty"`
	Identity      []string `json:"identity,omitempty" yaml:"identity,omitempty"`
	ClientKey     string   `json:"clientKey,omitempty" yaml:"clientKey,omitempty"`
	Mode          string   `json:"mode,omitempty" yaml:"mode,omitempty"` // replace|merge
	PreserveOrder *bool    `json:"preserveOrder,omitempty" yaml:"preserveOrder,omitempty"`
}

type ResourceModelHooks struct {
	BeforeUnmarshal string `json:"beforeUnmarshal,omitempty" yaml:"beforeUnmarshal,omitempty"`
	AfterUnmarshal  string `json:"afterUnmarshal,omitempty" yaml:"afterUnmarshal,omitempty"`
	BeforeMarshal   string `json:"beforeMarshal,omitempty" yaml:"beforeMarshal,omitempty"`
	AfterMarshal    string `json:"afterMarshal,omitempty" yaml:"afterMarshal,omitempty"`
}

// ResourceValueSource resolves a command draft or baseline without embedding
// host code in metadata.
type ResourceValueSource struct {
	Scope         string               `json:"scope,omitempty" yaml:"scope,omitempty"` // constant|extras|form|collection|selection|metrics|input|windowForm
	DataSourceRef string               `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Selector      string               `json:"selector,omitempty" yaml:"selector,omitempty"`
	Value         interface{}          `json:"value,omitempty" yaml:"value,omitempty"`
	Where         *ResourceValueFilter `json:"where,omitempty" yaml:"where,omitempty"`
	MapSelector   string               `json:"mapSelector,omitempty" yaml:"mapSelector,omitempty"`
	Codec         string               `json:"codec,omitempty" yaml:"codec,omitempty"`
}

// ResourceValueFilter is the bounded discriminator vocabulary available to
// declarative payload composition. Exactly one comparison may be declared.
type ResourceValueFilter struct {
	Field     string        `json:"field" yaml:"field"`
	Equals    interface{}   `json:"equals,omitempty" yaml:"equals,omitempty"`
	NotEquals interface{}   `json:"notEquals,omitempty" yaml:"notEquals,omitempty"`
	In        []interface{} `json:"in,omitempty" yaml:"in,omitempty"`
}

// ResourcePayloadPreparation prepares one immutable writer payload through a
// registered ResourceModel before CommandExecutor invokes its datasource.
type ResourcePayloadPreparation struct {
	ModelRef string                         `json:"modelRef" yaml:"modelRef"`
	Source   ResourceValueSource            `json:"source,omitempty" yaml:"source,omitempty"`
	Fields   map[string]ResourceValueSource `json:"fields,omitempty" yaml:"fields,omitempty"`
	Baseline *ResourceValueSource           `json:"baseline,omitempty" yaml:"baseline,omitempty"`
	Mode     string                         `json:"mode,omitempty" yaml:"mode,omitempty"`
	Target   string                         `json:"target,omitempty" yaml:"target,omitempty"`
}
