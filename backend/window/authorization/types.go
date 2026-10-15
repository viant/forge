// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"fmt"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"strconv"
	"time"

	forgetypes "github.com/viant/forge/backend/types"
)

type Request struct {
	SchemaVersion               int      `json:"schemaVersion,omitempty"`
	ResourceType                string   `json:"resourceType"`
	ResourceIDs                 []int    `json:"resourceIds,omitempty"`
	StringResourceIDs           []string `json:"resourceIdsV2,omitempty"`
	RequestedCapabilities       []string `json:"requestedCapabilities,omitempty"`
	RequestedGlobalCapabilities []string `json:"requestedGlobalCapabilities,omitempty"`
	IncludePrincipal            bool     `json:"includePrincipal,omitempty"`
}

type Resolver interface {
	Resolve(context.Context, *Request) (*Snapshot, error)
}

type Snapshot struct {
	SchemaVersion        int                  `json:"schemaVersion,omitempty"`
	AuthorizationVersion string               `json:"authorizationVersion"`
	ExpiresAt            time.Time            `json:"expiresAt"`
	Principal            map[string]any       `json:"principal,omitempty"`
	Account              map[string]any       `json:"account,omitempty"`
	GlobalCapabilities   map[string]bool      `json:"globalCapabilities,omitempty"`
	Resources            map[string]*Resource `json:"resources,omitempty"`
}

type Resource struct {
	Type         string          `json:"type"`
	ID           int             `json:"id"`
	IDString     string          `json:"-"`
	Roles        []string        `json:"roles,omitempty"`
	Capabilities map[string]bool `json:"capabilities"`
}

func (r Resource) MarshalJSON() ([]byte, error) {
	id := any(r.ID)
	if r.IDString != "" {
		id = r.IDString
	}
	return json.Marshal(struct {
		Type         string          `json:"type"`
		ID           any             `json:"id"`
		Roles        []string        `json:"roles,omitempty"`
		Capabilities map[string]bool `json:"capabilities"`
	}{r.Type, id, r.Roles, r.Capabilities})
}

func (r *Resource) UnmarshalJSON(raw []byte) error {
	var value struct {
		Type         string          `json:"type"`
		ID           json.RawMessage `json:"id"`
		Roles        []string        `json:"roles"`
		Capabilities map[string]bool `json:"capabilities"`
	}
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	if len(value.ID) == 0 {
		return fmt.Errorf("resource id is required")
	}
	*r = Resource{Type: value.Type, Roles: value.Roles, Capabilities: value.Capabilities}
	if value.ID[0] == '"' {
		return json.Unmarshal(value.ID, &r.IDString)
	}
	id, err := strconv.Atoi(string(value.ID))
	if err != nil {
		return err
	}
	r.ID = id
	return nil
}

type BoundView = windowprotocol.PresentationInput

type Result struct {
	Window         *forgetypes.Window
	Authorization  *Snapshot
	Resource       *Resource
	DataSourceRefs map[string]bool
	ExpiresAt      time.Time
	Denied         bool
	Diagnostics    []Diagnostic
}

type Diagnostic struct {
	Code    string `json:"code"`
	Path    string `json:"path,omitempty"`
	Message string `json:"message"`
}
