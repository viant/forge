// SPDX-License-Identifier: Apache-2.0
// Feed rendering metadata extracted from Viant Agently Core.
package tool

import "github.com/viant/forge/backend/types"

// FeedSpec describes a visual feed binding. Storage, revisions and publication
// are owned by the application exposing the enclosing MCP resource.
type FeedSpec struct {
	ID          string          `yaml:"id,omitempty" json:"id,omitempty"`
	Title       string          `yaml:"title,omitempty" json:"title,omitempty"`
	Priority    int             `yaml:"priority,omitempty" json:"priority,omitempty"`
	Match       MatchSpec       `yaml:"match" json:"match"`
	Activation  ActivationSpec  `yaml:"activation" json:"activation"`
	DataSources DataSources     `yaml:"dataSource,omitempty" json:"dataSource,omitempty"`
	UI          types.Container `yaml:"ui" json:"ui"`
}
type MatchSpec struct {
	Service string `yaml:"service,omitempty" json:"service,omitempty"`
	Method  string `yaml:"method,omitempty" json:"method,omitempty"`
}
type ActivationSpec struct {
	Kind    string                 `yaml:"kind,omitempty" json:"kind,omitempty"`
	Scope   string                 `yaml:"scope,omitempty" json:"scope,omitempty"`
	Service string                 `yaml:"service,omitempty" json:"service,omitempty"`
	Method  string                 `yaml:"method,omitempty" json:"method,omitempty"`
	Args    map[string]interface{} `yaml:"args,omitempty" json:"args,omitempty"`
}
type DataSources map[string]*DataSource
type DataSource struct {
	types.DataSource `yaml:",inline"`
	Source           string `json:"source" yaml:"source"`
	Name             string `json:"name" yaml:"name"`
}
