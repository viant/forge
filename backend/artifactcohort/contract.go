// Package artifactcohort is an opt-in published-root catalog for an already
// authenticated MCP connection. Importing it does not enable the fast path.
package artifactcohort

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/viant/authz"
)

const (
	Capability              = "io.viant/artifact-cohorts/v1"
	MethodDiscover          = "artifact/discover"
	MethodFetch             = "artifact/fetch"
	PolicyAction            = "join"
	NotificationListChanged = "notifications/resources/list_changed"
	NotificationUpdated     = "notifications/resources/updated"
	MaxPayloadBytes         = 4 << 20
)

var (
	ErrDenied      = errors.New("artifact cohort denied")
	ErrInvalid     = errors.New("invalid published artifact")
	ErrUnavailable = errors.New("artifact cohort unavailable")
	ErrUnsupported = errors.New("artifact cohort capability unavailable")
	ErrConflict    = errors.New("artifact cohort generation conflict")
)

func Hash(raw []byte) string { sum := sha256.Sum256(raw); return hex.EncodeToString(sum[:]) }

// RootRef is the public versioned unit. Dependencies are already closed into
// Payload by the producer and never acquire their own cache grant here.
type RootRef struct {
	URI     string `json:"uri"`
	Kind    string `json:"kind"`
	Version uint64 `json:"version"`
	Hash    string `json:"hash"`
}

// RootKey identifies one immutable published revision. URI remains the
// permission unit within a cohort; different cohorts may select different
// retained revisions of that URI.
func RootKey(ref RootRef) string { return ref.URI + "\x00" + strconv.FormatUint(ref.Version, 10) }

func RootKind(kind string) bool {
	switch kind {
	case "window", "skill", "playbook", "intent", "agent", "report", "prompt", "eval", "navigation", "mcp", "toolfeed", "feed":
		return true
	}
	return false
}

type Artifact struct {
	Root    RootRef         `json:"root"`
	Payload json.RawMessage `json:"payload"`
}

func ValidateArtifact(value *Artifact) error {
	if value == nil || value.Root.URI == "" || !RootKind(value.Root.Kind) || value.Root.Version == 0 || len(value.Payload) == 0 || len(value.Payload) > MaxPayloadBytes || !json.Valid(value.Payload) || Hash(value.Payload) != value.Root.Hash {
		return ErrInvalid
	}
	if _, err := RootPartition(value.Root); err != nil {
		return err
	}
	return nil
}
func CloneArtifact(value *Artifact) *Artifact {
	if value == nil {
		return nil
	}
	copy := *value
	copy.Payload = bytes.Clone(value.Payload)
	return &copy
}
func (a *Artifact) ETag() string {
	if a == nil {
		return ""
	}
	return a.Root.Hash
}

type Cohort struct {
	Tenant            string         `json:"tenant"`
	Name              string         `json:"name"`
	PolicyResource    authz.Resource `json:"policyResource"`
	PolicyHash        string         `json:"policyHash"`
	Hash              string         `json:"hash"`
	Priority          int            `json:"priority,omitempty"`
	Roots             []RootRef      `json:"roots"`
	FollowPublished   []string       `json:"followPublished,omitempty"`
	RevisionOverrides []RootRef      `json:"revisionOverrides,omitempty"`
	DeniedURIs        []string       `json:"deniedUris,omitempty"`
}

func CohortHash(value Cohort) string {
	value.Hash = ""
	raw, _ := json.Marshal(value)
	return Hash(raw)
}
func FindRoot(roots []RootRef, uri string) (RootRef, bool) {
	for _, root := range roots {
		if root.URI == uri {
			return root, true
		}
	}
	return RootRef{}, false
}

type Manifest struct {
	Unchanged       bool              `json:"unchanged,omitempty"`
	Generation      uint64            `json:"generation"`
	Hash            string            `json:"hash"`
	PartitionHashes map[string]string `json:"partitionHashes"`
	Policies        []authz.Document  `json:"policies"`
	Cohorts         []Cohort          `json:"cohorts"`
}

func ManifestHash(value Manifest) string {
	value.Hash = ""
	value.Unchanged = false
	value.Generation = 0 // internal publication CAS is not content identity
	raw, _ := json.Marshal(value)
	return Hash(raw)
}

func PartitionKey(namespace, kind string) string { return namespace + "|" + kind }
func RootPartition(ref RootRef) (string, error) {
	u, err := url.Parse(ref.URI)
	if err != nil || u.Scheme != ref.Kind || u.Host == "" || u.Path == "" || u.RawQuery != "" || u.Fragment != "" || strings.Contains(u.Host, "|") {
		return "", ErrInvalid
	}
	return PartitionKey(u.Host, ref.Kind), nil
}
func uriPartition(uri string) (string, error) {
	u, err := url.Parse(uri)
	if err != nil || !RootKind(u.Scheme) {
		return "", ErrInvalid
	}
	return RootPartition(RootRef{URI: uri, Kind: u.Scheme})
}
func cohortPartitions(cohort Cohort) map[string]bool {
	partitions := map[string]bool{}
	for _, ref := range append(append([]RootRef(nil), cohort.Roots...), cohort.RevisionOverrides...) {
		if key, err := RootPartition(ref); err == nil {
			partitions[key] = true
		}
	}
	for _, uri := range cohort.DeniedURIs {
		if key, err := uriPartition(uri); err == nil {
			partitions[key] = true
		}
	}
	return partitions
}

// PartitionHash isolates namespace and kind. A sales intent update changes
// neither sales windows nor operations intents. Policy partitions use the
// cohort policy heads that govern roots in that namespace.
func PartitionHash(value Manifest, key string) string {
	namespace, kind, ok := strings.Cut(key, "|")
	if !ok || namespace == "" || kind == "" {
		return ""
	}
	if kind == "policy" {
		type head struct{ Tenant, Name, PolicyHash string }
		var heads []head
		for _, cohort := range value.Cohorts {
			for partition := range cohortPartitions(cohort) {
				if strings.HasPrefix(partition, namespace+"|") {
					heads = append(heads, head{cohort.Tenant, cohort.Name, cohort.PolicyHash})
					break
				}
			}
		}
		if len(heads) == 0 {
			return ""
		}
		sort.Slice(heads, func(i, j int) bool { return heads[i].Tenant+"|"+heads[i].Name < heads[j].Tenant+"|"+heads[j].Name })
		raw, _ := json.Marshal(heads)
		return Hash(raw)
	}
	type selection struct {
		Tenant, Cohort string
		Mode           string
		Priority       int
		Root           RootRef
		URI            string
		Follow         bool
	}
	selections := []selection{}
	for _, cohort := range value.Cohorts {
		follow := map[string]bool{}
		for _, uri := range cohort.FollowPublished {
			follow[uri] = true
		}
		for _, ref := range cohort.Roots {
			partition, err := RootPartition(ref)
			if err == nil && partition == key {
				selections = append(selections, selection{Tenant: cohort.Tenant, Cohort: cohort.Name, Mode: "allow", Priority: cohort.Priority, Root: ref, URI: ref.URI, Follow: follow[ref.URI]})
			}
		}
		for _, ref := range cohort.RevisionOverrides {
			if partition, err := RootPartition(ref); err == nil && partition == key {
				selections = append(selections, selection{Tenant: cohort.Tenant, Cohort: cohort.Name, Mode: "override", Priority: cohort.Priority, Root: ref, URI: ref.URI})
			}
		}
		for _, uri := range cohort.DeniedURIs {
			if partition, err := uriPartition(uri); err == nil && partition == key {
				selections = append(selections, selection{Tenant: cohort.Tenant, Cohort: cohort.Name, Mode: "deny", Priority: cohort.Priority, URI: uri})
			}
		}
	}
	if len(selections) == 0 {
		return ""
	}
	sort.Slice(selections, func(i, j int) bool {
		a, b := selections[i], selections[j]
		if a.Tenant != b.Tenant {
			return a.Tenant < b.Tenant
		}
		if a.Cohort != b.Cohort {
			return a.Cohort < b.Cohort
		}
		if a.Mode != b.Mode {
			return a.Mode < b.Mode
		}
		if a.URI != b.URI {
			return a.URI < b.URI
		}
		return RootKey(a.Root) < RootKey(b.Root)
	})
	raw, _ := json.Marshal(selections)
	return Hash(raw)
}
func FillPartitionHashes(value *Manifest) {
	if value == nil {
		return
	}
	keys := map[string]bool{}
	for _, cohort := range value.Cohorts {
		for partition := range cohortPartitions(cohort) {
			keys[partition] = true
			namespace, _, _ := strings.Cut(partition, "|")
			keys[PartitionKey(namespace, "policy")] = true
		}
	}
	value.PartitionHashes = map[string]string{}
	for key := range keys {
		if hash := PartitionHash(*value, key); hash != "" {
			value.PartitionHashes[key] = hash
		}
	}
}
func ValidateManifest(value Manifest) error {
	if value.Unchanged || value.Generation == 0 || value.Hash == "" || value.Hash != ManifestHash(value) {
		return ErrInvalid
	}
	if _, err := authz.NewStaticStore(value.Policies); err != nil {
		return ErrInvalid
	}
	seen := map[string]bool{}
	sharedRoots := map[string]RootRef{}
	for _, cohort := range value.Cohorts {
		if cohort.Tenant == "" || cohort.Name == "" || cohort.PolicyHash == "" || cohort.Hash != CohortHash(cohort) || cohort.PolicyResource.Kind == "" || cohort.PolicyResource.Tenant != cohort.Tenant || seen[cohort.Tenant+"|"+cohort.Name] {
			return ErrInvalid
		}
		seen[cohort.Tenant+"|"+cohort.Name] = true
		if !sort.StringsAreSorted(cohort.FollowPublished) {
			return ErrInvalid
		}
		following := map[string]bool{}
		for _, uri := range cohort.FollowPublished {
			if uri == "" || following[uri] {
				return ErrInvalid
			}
			following[uri] = true
		}
		if !sort.SliceIsSorted(cohort.Roots, func(i, j int) bool { return cohort.Roots[i].URI < cohort.Roots[j].URI }) {
			return ErrInvalid
		}
		prior := ""
		for _, root := range cohort.Roots {
			if root.URI == "" || root.URI == prior || !RootKind(root.Kind) || root.Version == 0 || root.Hash == "" {
				return ErrInvalid
			}
			if _, err := RootPartition(root); err != nil {
				return ErrInvalid
			}
			if old, ok := sharedRoots[RootKey(root)]; ok && old != root {
				return ErrInvalid
			}
			sharedRoots[RootKey(root)] = root
			delete(following, root.URI)
			prior = root.URI
		}
		if !sort.SliceIsSorted(cohort.RevisionOverrides, func(i, j int) bool { return cohort.RevisionOverrides[i].URI < cohort.RevisionOverrides[j].URI }) || !sort.StringsAreSorted(cohort.DeniedURIs) {
			return ErrInvalid
		}
		prior = ""
		for _, override := range cohort.RevisionOverrides {
			if override.URI == "" || override.URI == prior || !RootKind(override.Kind) || override.Version == 0 || override.Hash == "" {
				return ErrInvalid
			}
			if _, err := RootPartition(override); err != nil {
				return ErrInvalid
			}
			if old, ok := sharedRoots[RootKey(override)]; ok && old != override {
				return ErrInvalid
			}
			sharedRoots[RootKey(override)] = override
			prior = override.URI
		}
		prior = ""
		for _, uri := range cohort.DeniedURIs {
			if uri == "" || uri == prior {
				return ErrInvalid
			}
			if _, err := uriPartition(uri); err != nil {
				return ErrInvalid
			}
			prior = uri
		}
		if len(following) > 0 {
			return ErrInvalid
		}
	}
	check := value
	FillPartitionHashes(&check)
	if len(check.PartitionHashes) != len(value.PartitionHashes) {
		return ErrInvalid
	}
	for kind, kindHash := range check.PartitionHashes {
		if value.PartitionHashes[kind] != kindHash {
			return ErrInvalid
		}
	}
	return nil
}
func CloneManifest(value Manifest) (Manifest, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return Manifest{}, err
	}
	var copy Manifest
	err = json.Unmarshal(raw, &copy)
	return copy, err
}

type FetchInput struct {
	Tenant string  `json:"tenant"`
	Root   RootRef `json:"root"`
}

// Caller is a trusted configured MCP connection. The existing MCP transport
// supplies service authentication and authorization for Discover and Fetch.
// A browser cannot choose this caller or its credentials.
type Caller interface {
	Discover(context.Context) (Manifest, error)
	Fetch(context.Context, FetchInput) (*Artifact, error)
}
