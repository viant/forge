// SPDX-License-Identifier: Apache-2.0
package primitive

import (
	"bytes"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/viant/forge/backend/authoring/markdown"
	"gopkg.in/yaml.v3"
)

const RoutingKind = "routing"

// MaxRoutingGuideBytes bounds one authored document and the aggregate body
// that a consumer may add to a single intake request.
const MaxRoutingGuideBytes = 16 << 10

type RoutingGuide struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Body        string `yaml:"-"`
}

// ParseRoutingGuide validates the immutable Markdown document without
// interpreting its headings, examples, or prose as executable rules.
func ParseRoutingGuide(envelope RoutingGuideEnvelope) (RoutingGuide, error) {
	if envelope.SchemaVersion != AIEnvelopeVersion {
		return RoutingGuide{}, fmt.Errorf("unsupported routing guide schema version %d", envelope.SchemaVersion)
	}
	if len(envelope.Document) > MaxRoutingGuideBytes || !utf8.ValidString(envelope.Document) {
		return RoutingGuide{}, fmt.Errorf("routing guide must be UTF-8 and at most %d bytes", MaxRoutingGuideBytes)
	}
	metadata, body, err := markdown.SplitFrontmatter([]byte(envelope.Document))
	if err != nil {
		return RoutingGuide{}, err
	}
	var guide RoutingGuide
	if len(metadata) == 0 {
		return RoutingGuide{}, fmt.Errorf("routing guide requires YAML frontmatter")
	}
	decoder := yaml.NewDecoder(bytes.NewReader(metadata))
	decoder.KnownFields(true)
	if err = decoder.Decode(&guide); err != nil {
		return RoutingGuide{}, err
	}
	if name := strings.TrimSpace(guide.Name); name == "" || utf8.RuneCountInString(name) > 128 {
		return RoutingGuide{}, fmt.Errorf("routing guide name must contain 1–128 characters")
	}
	if description := strings.TrimSpace(guide.Description); description == "" || utf8.RuneCountInString(description) > 1024 {
		return RoutingGuide{}, fmt.Errorf("routing guide description must contain 1–1024 characters")
	}
	if strings.TrimSpace(body) == "" {
		return RoutingGuide{}, fmt.Errorf("routing guide requires a Markdown body")
	}
	guide.Body = body
	return guide, nil
}
