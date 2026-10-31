package artifactcohort

import (
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	skillformat "github.com/viant/mcp-protocol/extension/skills"
)

// Headers are representations of immutable payloads, never admission records.
// They are shared by artifact hash and bounded independently of user count.
const maxMetadataHeaders = 4096
const maxMetadataHeaderBytes = 8 << 20

type metadataHeader struct {
	SchemaVersion int64  `json:"schemaVersion"`
	Name          string `json:"name"`
	Title         string `json:"title"`
	Description   string `json:"description"`
}

func (s *MetadataSource) cachedHeader(kind, hash string) (metadataHeader, bool) {
	s.headerMu.Lock()
	defer s.headerMu.Unlock()
	value, ok := s.headers[kind+":"+hash]
	return value, ok
}
func (s *MetadataSource) decodeHeader(kind, hash string, payload []byte) (metadataHeader, error) {
	if value, ok := s.cachedHeader(kind, hash); ok {
		return value, nil
	}
	var envelope struct {
		metadataHeader
		Document json.RawMessage `json:"document"`
		Profile  *metadataHeader `json:"profile"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return metadataHeader{}, ErrInvalid
	}
	value := envelope.metadataHeader
	if envelope.Profile != nil {
		value.fill(*envelope.Profile)
	}
	if len(envelope.Document) > 0 && (kind == "skill" || value.SchemaVersion == primitive.AIEnvelopeVersion && (kind == "agent" || kind == "playbook")) {
		if document, err := (primitive.DocumentCarrier{SchemaVersion: value.SchemaVersion, Document: envelope.Document}).Bytes(); err == nil {
			if front, err := skillformat.Frontmatter(document); err == nil {
				name, _ := front["name"].(string)
				title, _ := front["title"].(string)
				description, _ := front["description"].(string)
				value.fill(metadataHeader{Name: name, Title: title, Description: description})
			}
		}
	}
	s.headerMu.Lock()
	defer s.headerMu.Unlock()
	if s.headers == nil {
		s.headers = map[string]metadataHeader{}
	}
	key := kind + ":" + hash
	if existing, ok := s.headers[key]; ok {
		return existing, nil
	}
	size := len(key) + len(value.Name) + len(value.Title) + len(value.Description)
	if size > maxMetadataHeaderBytes {
		return value, nil
	}
	if len(s.headers) >= maxMetadataHeaders || s.headerBytes+size > maxMetadataHeaderBytes {
		clear(s.headers)
		s.headerBytes = 0
	}
	s.headers[key] = value
	s.headerBytes += size
	return value, nil
}
func (h metadataHeader) title(fallback string) string {
	if h.Title != "" {
		return h.Title
	}
	if h.Name != "" {
		return h.Name
	}
	return fallback
}

func (h *metadataHeader) fill(other metadataHeader) {
	if h.Name == "" {
		h.Name = other.Name
	}
	if h.Title == "" {
		h.Title = other.Title
	}
	if h.Description == "" {
		h.Description = other.Description
	}
}
