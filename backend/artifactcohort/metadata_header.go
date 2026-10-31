package artifactcohort

import (
	"encoding/json"
	"sync"

	primitive "github.com/viant/forge/backend/provider/contract"
	skillformat "github.com/viant/mcp-protocol/extension/skills"
)

// Headers are representations of immutable payloads, never admission records.
// They are shared by artifact hash and bounded independently of user count.
const maxMetadataHeaders = 4096
const maxMetadataHeaderBytes = 8 << 20

// ArtifactHeader is descriptive metadata from an immutable payload. It is not
// an authorization decision; callers retain their existing admission checks.
type ArtifactHeader struct {
	SchemaVersion int64  `json:"schemaVersion"`
	Name          string `json:"name"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	MimeType      string `json:"mimeType,omitempty"`
}

// HeaderProjector shares the bounded local decoder between producers and
// consumers. Its zero value is ready for use; do not copy it after use.
type HeaderProjector struct {
	headerMu    sync.Mutex
	headers     map[string]ArtifactHeader
	headerBytes int
}

// Project describes supplied bytes only. It performs no lookup, transport or
// admission. The payload-derived key cannot be poisoned by a caller's claimed
// hash; publisher callers should pass the already selected immutable payload.
func (s *HeaderProjector) Project(kind string, payload json.RawMessage) (ArtifactHeader, error) {
	if s == nil {
		return ArtifactHeader{}, ErrInvalid
	}
	return s.decodeHeader(kind, Hash(payload), payload)
}

// Cached avoids loading the payload when a previously projected immutable
// header is available. The caller must first admit the current root; a cache
// hit neither proves availability nor grants access.
func (s *HeaderProjector) Cached(kind, hash string) (ArtifactHeader, bool) {
	if s == nil {
		return ArtifactHeader{}, false
	}
	return s.cachedHeader(kind, hash)
}

func (s *HeaderProjector) cachedHeader(kind, hash string) (ArtifactHeader, bool) {
	s.headerMu.Lock()
	defer s.headerMu.Unlock()
	value, ok := s.headers[kind+":"+hash]
	return value, ok
}
func (s *HeaderProjector) decodeHeader(kind, hash string, payload []byte) (ArtifactHeader, error) {
	if value, ok := s.cachedHeader(kind, hash); ok {
		return value, nil
	}
	var envelope struct {
		ArtifactHeader
		Document json.RawMessage `json:"document"`
		Profile  *ArtifactHeader `json:"profile"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return ArtifactHeader{}, ErrInvalid
	}
	value := envelope.ArtifactHeader
	if envelope.Profile != nil {
		value.fill(*envelope.Profile)
	}
	if len(envelope.Document) > 0 && (kind == "skill" || value.SchemaVersion == primitive.AIEnvelopeVersion && (kind == "agent" || kind == "playbook")) {
		if document, err := (primitive.DocumentCarrier{SchemaVersion: value.SchemaVersion, Document: envelope.Document}).Bytes(); err == nil {
			if front, err := skillformat.Frontmatter(document); err == nil {
				name, _ := front["name"].(string)
				title, _ := front["title"].(string)
				description, _ := front["description"].(string)
				value.fill(ArtifactHeader{Name: name, Title: title, Description: description})
			}
		}
	}
	s.headerMu.Lock()
	defer s.headerMu.Unlock()
	if s.headers == nil {
		s.headers = map[string]ArtifactHeader{}
	}
	key := kind + ":" + hash
	if existing, ok := s.headers[key]; ok {
		return existing, nil
	}
	size := len(key) + len(value.Name) + len(value.Title) + len(value.Description) + len(value.MimeType)
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

// DisplayTitle prefers the declared title, then name, then the caller fallback.
func (h ArtifactHeader) DisplayTitle(fallback string) string {
	if h.Title != "" {
		return h.Title
	}
	if h.Name != "" {
		return h.Name
	}
	return fallback
}

func (h *ArtifactHeader) fill(other ArtifactHeader) {
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
