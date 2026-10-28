// SPDX-License-Identifier: Apache-2.0
package primitive

import identity "github.com/viant/forge/backend/resource"

// These immutable authoring envelopes are shared by producers and consumers.
// They describe artifacts; their contents never grant runtime execution rights.
const AIEnvelopeVersion int64 = 1

type SkillDocumentEnvelope struct {
	SchemaVersion int64             `json:"schemaVersion" yaml:"schemaVersion"`
	Document      string            `json:"document" yaml:"document"`
	Files         map[string]string `json:"files,omitempty" yaml:"files,omitempty"`
}
type AgentDocumentEnvelope struct {
	SchemaVersion int64  `json:"schemaVersion" yaml:"schemaVersion"`
	Document      string `json:"document" yaml:"document"`
}
type PromptEnvelope struct {
	SchemaVersion int64            `json:"schemaVersion" yaml:"schemaVersion"`
	Text          string           `json:"text" yaml:"text"`
	Engine        string           `json:"engine" yaml:"engine"`
	Arguments     []PromptArgument `json:"arguments,omitempty" yaml:"arguments,omitempty"`
}
type PromptArgument struct {
	Name        string `json:"name" yaml:"name"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	Required    bool   `json:"required,omitempty" yaml:"required,omitempty"`
}
type ProfileEnvelope[T any] struct {
	SchemaVersion int64 `json:"schemaVersion" yaml:"schemaVersion"`
	Profile       T     `json:"profile" yaml:"profile"`
}
type PlaybookEnvelope[T any] struct {
	SchemaVersion int64  `json:"schemaVersion" yaml:"schemaVersion"`
	Document      string `json:"document,omitempty" yaml:"document,omitempty"`
	Profile       T      `json:"profile,omitempty" yaml:"profile,omitempty"`
}
type EvalEnvelope struct {
	SchemaVersion              int64                  `json:"schemaVersion" yaml:"schemaVersion,omitempty"`
	ID                         string                 `json:"id" yaml:"id"`
	Title                      string                 `json:"title" yaml:"title"`
	UserPrompt                 string                 `json:"user_prompt" yaml:"user_prompt"`
	EntryAgent                 string                 `json:"entry_agent" yaml:"entry_agent"`
	ExpectedRouting            EvalRoutingExpectation `json:"expected_routing" yaml:"expected_routing"`
	ExpectedPreDelegationTools []EvalToolExpectation  `json:"expected_pre_delegation_tools,omitempty" yaml:"expected_pre_delegation_tools,omitempty"`
	ExpectedOutput             EvalOutputExpectation  `json:"expected_output" yaml:"expected_output"`
	Dependencies               []EvalDependency       `json:"dependencies" yaml:"dependencies,omitempty"`
}
type EvalRoutingExpectation struct {
	Agent   string   `json:"agent" yaml:"agent"`
	Profile string   `json:"profile" yaml:"profile"`
	FanOut  []string `json:"fan_out,omitempty" yaml:"fan_out,omitempty"`
}
type EvalOutputExpectation struct {
	Template string `json:"template" yaml:"template"`
}
type EvalToolExpectation struct {
	Name string `json:"name" yaml:"name"`
}
type EvalDependency struct {
	Resource                   identity.ResourceRef `json:"resource" yaml:"resource"`
	ExpectedContentFingerprint string               `json:"expectedContentFingerprint" yaml:"expectedContentFingerprint"`
}
