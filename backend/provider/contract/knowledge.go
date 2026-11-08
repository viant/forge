// SPDX-License-Identifier: Apache-2.0
package primitive

const KnowledgeKind = "knowledge"

// KnowledgeEnvelope retains authored Markdown and source metadata as one
// versioned corpus. Files use archive-relative paths and preserve exact bytes.
// A corpus shares its resource's visibility; contents do not grant access.
type KnowledgeEnvelope struct {
	SchemaVersion int64             `json:"schemaVersion" yaml:"schemaVersion"`
	Name          string            `json:"name" yaml:"name"`
	Description   string            `json:"description,omitempty" yaml:"description,omitempty"`
	Files         map[string]string `json:"files" yaml:"files"`
	Metadata      KnowledgeMetadata `json:"metadata,omitempty" yaml:"metadata,omitempty"`
	Sources       []KnowledgeSource `json:"sources,omitempty" yaml:"sources,omitempty"`
}

// KnowledgeMetadata uses the document indexer's declared extractor and field
// mapping. Keys are neutral indexed metadata names; values are source fields.
type KnowledgeMetadata struct {
	Extractor string            `json:"extractor,omitempty" yaml:"extractor,omitempty"`
	Fields    map[string]string `json:"fields,omitempty" yaml:"fields,omitempty"`
}

// KnowledgeSource records a completed import's identity and owned paths.
// Location is provenance, not a fetch instruction or a credential reference.
// Missing paths in a replacement completed import can be removed without
// erasing documents authored outside that source.
type KnowledgeSource struct {
	ID       string   `json:"id" yaml:"id"`
	Location string   `json:"location,omitempty" yaml:"location,omitempty"`
	Revision string   `json:"revision,omitempty" yaml:"revision,omitempty"`
	Paths    []string `json:"paths" yaml:"paths"`
}
