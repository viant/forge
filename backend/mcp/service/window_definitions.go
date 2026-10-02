package service

import (
	"context"
	"errors"
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/viant/forge/backend/handlers"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
)

// WindowDefinitionCatalog belongs to the embedding host, not the browser.
type WindowDefinitionCatalog interface {
	List(context.Context, *WindowDefinitionListInput) (*WindowDefinitionListOutput, error)
	Get(context.Context, *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error)
}

type WindowDefinitionSummary struct {
	WindowID  string `json:"windowId" yaml:"windowId"`
	Title     string `json:"title" yaml:"title"`
	Namespace string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
}

type WindowDefinitionListInput struct {
	Query  string `json:"query,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

type WindowDefinitionListOutput struct {
	Windows []WindowDefinitionSummary `json:"windows"`
	HasMore bool                      `json:"hasMore"`
}

type WindowDefinitionGetInput struct {
	WindowID string `json:"windowId"`
}
type WindowDefinitionGetOutput struct {
	WindowID   string        `json:"windowId"`
	Definition *types.Window `json:"definition"`
}

// SavedWindow maps a stable public ID to host-owned Forge loader arguments.
type SavedWindow struct {
	WindowDefinitionSummary `yaml:",inline"`
	Key                     string   `json:"-" yaml:"key"`
	SubKey                  string   `json:"-" yaml:"subKey,omitempty"`
	Roles                   []string `json:"-" yaml:"roles,omitempty"`
}

// WindowRoleResolver returns caller roles from trusted server-side identity.
type WindowRoleResolver func(context.Context) ([]string, error)
type WindowCatalogOption func(*MetadataWindowCatalog)

func WithWindowRoleResolver(resolve WindowRoleResolver) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.roles = resolve }
}

// MetadataWindowCatalog uses the same loader/validation as Forge's window API.
// Entries without configured roles are open. Configured roles are resolved
// through the host's trusted server-side provider before loading definitions.
type MetadataWindowCatalog struct {
	loader  *meta.Service
	baseURL string
	entries []SavedWindow
	roles   WindowRoleResolver
}

func NewMetadataWindowCatalog(loader *meta.Service, baseURL string, entries []SavedWindow, options ...WindowCatalogOption) (*MetadataWindowCatalog, error) {
	if loader == nil || strings.TrimSpace(baseURL) == "" {
		return nil, errors.New("window definition loader and base URL are required")
	}
	seen := map[string]bool{}
	copyEntries := append([]SavedWindow(nil), entries...)
	for i, entry := range copyEntries {
		if entry.WindowID == "" || strings.TrimSpace(entry.WindowID) != entry.WindowID || seen[entry.WindowID] {
			return nil, errors.New("window definitions require unique nonempty windowId values")
		}
		seen[entry.WindowID] = true
		if !validWindowPath(entry.Key) || (entry.SubKey != "" && !validWindowPath(entry.SubKey)) {
			return nil, fmt.Errorf("invalid loader key for window %s", entry.WindowID)
		}
		roleSet := map[string]bool{}
		copyEntries[i].Roles = append([]string(nil), entry.Roles...)
		for _, role := range entry.Roles {
			if role == "" || strings.TrimSpace(role) != role || roleSet[role] {
				return nil, fmt.Errorf("invalid roles for window %s", entry.WindowID)
			}
			roleSet[role] = true
		}
	}
	sort.Slice(copyEntries, func(i, j int) bool { return copyEntries[i].WindowID < copyEntries[j].WindowID })
	result := &MetadataWindowCatalog{loader: loader, baseURL: baseURL, entries: copyEntries}
	for _, option := range options {
		if option != nil {
			option(result)
		}
	}
	return result, nil
}

func (c *MetadataWindowCatalog) RequiresRoles() bool {
	for _, entry := range c.entries {
		if len(entry.Roles) > 0 {
			return true
		}
	}
	return false
}
func (c *MetadataWindowCatalog) authorized(ctx context.Context, entry SavedWindow) bool {
	if len(entry.Roles) > 0 {
		if c.roles == nil {
			return false
		}
		actual, err := c.roles(ctx)
		if err != nil || ctx.Err() != nil {
			return false
		}
		matched := false
		for _, required := range entry.Roles {
			for _, role := range actual {
				if role == required {
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}
		if !matched {
			return false
		}
	}
	return true
}

func validWindowPath(value string) bool {
	return value != "" && value != "." && !strings.HasPrefix(value, "/") && path.Clean(value) == value && !strings.ContainsAny(value, "\\:\x00?#") && !strings.Contains(value, "..")
}

func (c *MetadataWindowCatalog) List(ctx context.Context, in *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	if in == nil {
		in = &WindowDefinitionListInput{}
	}
	if in.Limit < 0 || in.Limit > 100 || in.Offset < 0 {
		return nil, errors.New("limit must be 0..100 and offset nonnegative")
	}
	limit := in.Limit
	if limit == 0 {
		limit = 25
	}
	query := strings.ToLower(strings.TrimSpace(in.Query))
	visible := []WindowDefinitionSummary{}
	for _, entry := range c.entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if !c.authorized(ctx, entry) {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(entry.WindowID+" "+entry.Title+" "+entry.Namespace), query) {
			continue
		}
		visible = append(visible, entry.WindowDefinitionSummary)
	}
	start := min(in.Offset, len(visible))
	end := min(start+limit, len(visible))
	return &WindowDefinitionListOutput{Windows: visible[start:end], HasMore: end < len(visible)}, nil
}

func (c *MetadataWindowCatalog) Get(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	if in == nil || strings.TrimSpace(in.WindowID) == "" || strings.TrimSpace(in.WindowID) != in.WindowID {
		return nil, errors.New("windowId is required")
	}
	for _, entry := range c.entries {
		if entry.WindowID != in.WindowID {
			continue
		}
		if !c.authorized(ctx, entry) {
			return nil, errors.New("window definition is not available")
		}
		definition, err := handlers.LoadWindow(ctx, c.loader, c.baseURL, entry.Key, entry.SubKey, nil)
		if err != nil {
			return nil, fmt.Errorf("load window definition %s: %w", entry.WindowID, err)
		}
		return &WindowDefinitionGetOutput{WindowID: entry.WindowID, Definition: definition}, nil
	}
	return nil, errors.New("window definition is not available")
}

func (s *Service) WindowDefinitionsList(ctx context.Context, in *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	if s.cfg.WindowDefinitions == nil {
		return nil, errors.New("saved window definition catalog is not configured")
	}
	return s.cfg.WindowDefinitions.List(ctx, in)
}
func (s *Service) HasWindowDefinitions() bool { return s.cfg.WindowDefinitions != nil }
func (s *Service) WindowDefinitionGet(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	if s.cfg.WindowDefinitions == nil {
		return nil, errors.New("saved window definition catalog is not configured")
	}
	return s.cfg.WindowDefinitions.Get(ctx, in)
}
