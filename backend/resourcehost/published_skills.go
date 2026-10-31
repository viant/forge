// SPDX-License-Identifier: Apache-2.0
package resource

import (
	"context"
	"encoding/json"
	"io/fs"
	"path"
	"strings"
	"testing/fstest"
	"unicode/utf8"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	skillformat "github.com/viant/mcp-protocol/extension/skills"
	"github.com/viant/mcp-protocol/schema"
)

// OwnsPublishedSkill recognizes trusted namespace claims even after the source
// loses its root or admission. Consumers use it to suppress legacy fallback.
func (s *NativeSkillSource) OwnsPublishedSkill(uri string) bool {
	parsed, err := identity.ParseResourceURI(uri)
	if err != nil || parsed.Kind != "skill" {
		return false
	}
	_, claimed := s.Gateway.publishedNamespace(parsed.Namespace)
	return claimed
}

// PublishedSkill adapts a producer-closed skill package to the existing native
// manifest consumer. The catalog URI remains canonical; only the manifest/file
// projection receives the required /SKILL.md entrypoint. Compilation is local
// and reused by the original package hash, never by a fabricated revision.
func (s *NativeSkillSource) PublishedSkill(ctx context.Context, server, uri string) (*schema.GetSkillResult, bool, error) {
	parsed, err := identity.ParseResourceURI(uri)
	if err != nil {
		_, owner := s.Gateway.publishedByName(server)
		return nil, owner, identity.ErrResourceDenied
	}
	source, claimed := s.Gateway.publishedNamespace(parsed.Namespace)
	if !claimed {
		_, owner := s.Gateway.publishedByName(server)
		return nil, owner, identity.ErrResourceDenied
	}
	if parsed.Kind != "skill" || source.connection.Name != server {
		return nil, true, identity.ErrResourceDenied
	}
	compiled, err := s.publishedSkill(ctx, source, uri)
	if err != nil {
		return nil, true, err
	}
	return &schema.GetSkillResult{ResultType: schema.ResultTypeComplete, Skill: compiled.Metadata()}, true, nil
}

func (s *NativeSkillSource) publishedSkill(ctx context.Context, _ publishedMetadataRegistration, uri string) (*skillformat.Static, error) {
	loaded, err := Load[*skillformat.Static](ctx, s.Gateway, uri, PublishedCodec[*skillformat.Static]{
		ID: "skill-package.v1", Decode: compilePublishedSkill, Immutable: true,
	})
	if err != nil {
		return nil, err
	}
	return loaded.Value, nil
}

func compilePublishedSkill(ctx context.Context, uri string, raw json.RawMessage) (*skillformat.Static, error) {
	// Versioned producer definitions carry exact UTF-8 strings. The retained
	// host-native carrier has no schemaVersion and uses JSON byte fields. Do
	// not guess whether an arbitrary string happens to resemble base64.
	var header primitive.DocumentCarrier
	if json.Unmarshal(raw, &header) != nil {
		return nil, identity.ErrResource
	}
	document, err := header.Bytes()
	if err != nil {
		return nil, identity.ErrResource
	}
	var files map[string][]byte
	if header.SchemaVersion != 0 {
		var value struct {
			Files map[string]string `json:"files"`
		}
		if json.Unmarshal(raw, &value) != nil {
			return nil, identity.ErrResource
		}
		files = map[string][]byte{}
		for name, data := range value.Files {
			files[name] = []byte(data)
		}
	} else {
		var value struct {
			Files map[string][]byte `json:"files"`
		}
		if json.Unmarshal(raw, &value) != nil {
			return nil, identity.ErrResource
		}
		files = value.Files
	}
	if len(document) == 0 || !utf8.Valid(document) {
		return nil, identity.ErrResource
	}
	source := fstest.MapFS{"SKILL.md": {Data: document}}
	for name, data := range files {
		if !fs.ValidPath(name) || name == "." || name == "SKILL.md" || path.Clean(name) != name || strings.ContainsAny(name, "%\\:?#") {
			return nil, identity.ErrResource
		}
		source[name] = &fstest.MapFile{Data: data}
	}
	entry := uri
	if !strings.HasSuffix(entry, "/SKILL.md") {
		front, err := skillformat.Frontmatter(document)
		if err != nil {
			return nil, err
		}
		name, _ := front["name"].(string)
		if path.Base(entry) != name {
			entry += "/" + name
		}
		entry += "/SKILL.md"
	}
	return (skillformat.Compiler{Source: source}).Compile(ctx, entry)
}

func (s *NativeSkillSource) readPublishedSkillResource(ctx context.Context, server, uri string) (*schema.ReadResourceResult, bool, error) {
	parsed, err := identity.ParseResourceURI(uri)
	owner, ownsServer := s.Gateway.publishedByName(server)
	if err != nil {
		return nil, ownsServer, identity.ErrResourceDenied
	}
	source, claimed := s.Gateway.publishedNamespace(parsed.Namespace)
	if !claimed {
		return nil, ownsServer, identity.ErrResourceDenied
	}
	if !ownsServer || owner.connection.Name != source.connection.Name || parsed.Kind != "skill" {
		return nil, true, identity.ErrResourceDenied
	}
	// Select the owning closed package from its local index, without opening
	// unrelated package bodies or consulting a native MCP file endpoint.
	rows, err := s.Gateway.listPublished(ctx, source, "skill", parsed.Namespace)
	if err != nil {
		return nil, true, err
	}
	var root string
	for _, row := range rows {
		candidate := row.Resource.URI
		packageRoot := strings.TrimSuffix(candidate, "/SKILL.md")
		if uri == candidate || strings.HasPrefix(uri, packageRoot+"/") {
			if root != "" {
				return nil, true, ErrCollision
			}
			root = candidate
		}
	}
	if root == "" {
		return nil, true, identity.ErrResourceDenied
	}
	compiled, err := s.publishedSkill(ctx, source, root)
	if err != nil {
		return nil, true, err
	}
	result, rpcErr := compiled.ReadResource(ctx, &schema.ReadResourceRequest{Params: schema.ReadResourceRequestParams{Uri: uri}})
	if rpcErr != nil {
		return nil, true, identity.ErrResourceDenied
	}
	return result, true, nil
}
