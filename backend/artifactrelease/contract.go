// Package artifactrelease describes immutable published-root bundles and
// named-policy release channels. Persistence, actor admission, and the
// post-commit artifactcohort projection belong to the producer adapter.
package artifactrelease

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"unicode"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
	identity "github.com/viant/forge/backend/resource"
)

const BundleVersion = "io.viant/artifact-release-bundle/v1"

var (
	ErrInvalid           = errors.New("invalid artifact release")
	ErrConflict          = errors.New("artifact release revision conflict")
	ErrBoundedMembership = errors.New("bounded release membership is unsupported by artifact cohorts")
)

// Key is scoped by the producer's verified tenant/account/workspace, not a
// browser-supplied principal. Name is the stable channel identifier.
type Key struct {
	Tenant    string `json:"tenant"`
	Account   string `json:"account"`
	Workspace string `json:"workspace"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

func (k Key) Valid() bool {
	for _, value := range []string{k.Tenant, k.Account, k.Workspace} {
		if value == "" || strings.TrimSpace(value) != value || strings.IndexFunc(value, unicode.IsControl) >= 0 {
			return false
		}
	}
	return validName(k.Namespace) && validName(k.Name)
}

// Bundle contains exact producer-published revisions, including their payload
// hashes. It has no grant or permission rule; the channel's named policies
// determine who may consume its roots.
type Bundle struct {
	Namespace string                   `json:"namespace"`
	Roots     []artifactcohort.RootRef `json:"roots"`
	Hash      string                   `json:"hash"`
}

// ArtifactLookup must return the existing validated, immutable publication.
// The bundle constructor never compiles source or discovers dependencies.
type ArtifactLookup func(context.Context, artifactcohort.RootRef) (*artifactcohort.Artifact, error)

func NewBundle(ctx context.Context, namespace string, roots []artifactcohort.RootRef, lookup ArtifactLookup) (Bundle, error) {
	if ctx == nil || ctx.Err() != nil || lookup == nil || !validName(namespace) || len(roots) == 0 {
		return Bundle{}, ErrInvalid
	}
	copy := append([]artifactcohort.RootRef(nil), roots...)
	sort.Slice(copy, func(i, j int) bool { return copy[i].URI < copy[j].URI })
	bundle := Bundle{Namespace: namespace, Roots: copy}
	for _, ref := range copy {
		if err := validateRoot(namespace, ref); err != nil {
			return Bundle{}, err
		}
		artifact, err := lookup(ctx, ref)
		if err != nil || artifact == nil || artifact.Root != ref || artifactcohort.ValidateArtifact(artifact) != nil {
			return Bundle{}, ErrInvalid
		}
	}
	bundle.Hash = BundleHash(bundle)
	if err := ValidateBundle(bundle); err != nil {
		return Bundle{}, err
	}
	return bundle, nil
}

func BundleHash(bundle Bundle) string {
	raw, _ := json.Marshal(struct {
		Version   string                   `json:"version"`
		Namespace string                   `json:"namespace"`
		Roots     []artifactcohort.RootRef `json:"roots"`
	}{BundleVersion, bundle.Namespace, bundle.Roots})
	return artifactcohort.Hash(raw)
}

func ValidateBundle(bundle Bundle) error {
	if !validName(bundle.Namespace) || len(bundle.Roots) == 0 || !validHash(bundle.Hash) || bundle.Hash != BundleHash(bundle) {
		return ErrInvalid
	}
	prior := ""
	for _, root := range bundle.Roots {
		if err := validateRoot(bundle.Namespace, root); err != nil || root.URI <= prior {
			return ErrInvalid
		}
		prior = root.URI
	}
	return nil
}

func validateRoot(namespace string, ref artifactcohort.RootRef) error {
	partition, err := artifactcohort.RootPartition(ref)
	if err != nil || ref.Version == 0 || !validHash(ref.Hash) || !artifactcohort.RootKind(ref.Kind) || partition != artifactcohort.PartitionKey(namespace, ref.Kind) {
		return ErrInvalid
	}
	return nil
}

func validName(value string) bool {
	return !strings.Contains(value, "/") && (identity.ResourceURI{Kind: "release", Namespace: "release", Name: value}).Valid()
}

func validHash(value string) bool {
	if len(value) != 64 || value != strings.ToLower(value) {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

// Channel selects one retained Bundle for an account-scoped named release.
// Named references follow reviewed minimum revisions; current policy heads
// and their dependencies must be fenced by the producer adapter.
type Channel struct {
	Key              Key                    `json:"key"`
	Description      string                 `json:"description,omitempty"`
	Policies         []authz.NamedReference `json:"policies"`
	ActiveBundleHash string                 `json:"activeBundleHash,omitempty"`
	Revision         uint64                 `json:"revision"`
}

func NewChannel(key Key, description string, policies []authz.NamedReference) (Channel, error) {
	refs := append([]authz.NamedReference(nil), policies...)
	sort.Slice(refs, func(i, j int) bool { return policyKey(refs[i]) < policyKey(refs[j]) })
	channel := Channel{Key: key, Description: description, Policies: refs}
	return channel, ValidateChannel(channel)
}

func ValidateChannel(channel Channel) error {
	if !channel.Key.Valid() || strings.TrimSpace(channel.Description) != channel.Description || len(channel.Description) > 4096 || len(channel.Policies) == 0 || channel.Revision > math.MaxInt64 || channel.ActiveBundleHash != "" && !validHash(channel.ActiveBundleHash) {
		return ErrInvalid
	}
	prior := ""
	for _, ref := range channel.Policies {
		key := policyKey(ref)
		if !ref.Valid() || ref.Resource.Tenant != channel.Key.Tenant || key <= prior {
			return ErrInvalid
		}
		prior = key
	}
	return nil
}

func policyKey(ref authz.NamedReference) string {
	r := ref.Resource
	return r.Tenant + "\x00" + r.Kind + "\x00" + r.ID + "\x00" + r.Version
}

// PreparePromotion is a pure revision CAS. Selecting a retained historical
// bundle is rollback: it advances the channel revision without rebuilding any
// source. A producer must persist the next channel and pending activation in
// one transaction, then project one complete artifactcohort manifest before
// reporting the channel active.
func PreparePromotion(current Channel, expectedRevision uint64, target Bundle) (Channel, error) {
	return PrepareChannelUpdate(current, expectedRevision, current.Description, current.Policies, target)
}

// PrepareChannelUpdate composes a description/policy edit and release choice
// into the same CAS candidate. The adapter must stage, project and complete
// that candidate as one release activation; changing policy refs in place
// without a new cohort projection is never valid.
func PrepareChannelUpdate(current Channel, expectedRevision uint64, description string, policies []authz.NamedReference, target Bundle) (Channel, error) {
	if err := ValidateChannel(current); err != nil {
		return Channel{}, err
	}
	if err := ValidateBundle(target); err != nil || current.Key.Namespace != target.Namespace {
		return Channel{}, ErrInvalid
	}
	if current.Revision != expectedRevision {
		return Channel{}, ErrConflict
	}
	if current.Revision == math.MaxInt64 {
		return Channel{}, ErrInvalid
	}
	next := current
	next.Description = description
	next.Policies = append([]authz.NamedReference(nil), policies...)
	sort.Slice(next.Policies, func(i, j int) bool { return policyKey(next.Policies[i]) < policyKey(next.Policies[j]) })
	next.ActiveBundleHash = target.Hash
	next.Revision++
	if err := ValidateChannel(next); err != nil {
		return Channel{}, err
	}
	return next, nil
}

// PendingRevision is durable intent, not an already activated channel.
type PendingRevision struct {
	OperationID string  `json:"operationId"`
	Current     Channel `json:"current"`
	Next        Channel `json:"next"`
	BundleHash  string  `json:"bundleHash"`
}

// ChannelStore is implemented by the Studio's existing persistence boundary.
// StageRevision must CAS Current.Revision and persist Next plus the activation
// intent in one DB transaction, leaving Current as the committed active state.
// StageRevision returns a unique immutable pending operation ID.
// CompleteRevision expects both that ID and the current committed revision,
// then activates current+1 only after the Publisher projection succeeds. An
// old worker cannot acknowledge a replacement intent with the same revision.
// Pending intents remain replayable after process crashes. Adapter-specific
// failure receipts may be stored separately without advancing the channel.
type ChannelStore interface {
	PutBundle(context.Context, Bundle) error
	Bundle(context.Context, string) (Bundle, error)
	Channel(context.Context, Key) (Channel, error)
	StageRevision(context.Context, Channel, Channel, Bundle) (string, error)
	CompleteRevision(context.Context, Key, uint64, string) error
	Pending(context.Context) ([]PendingRevision, error)
}

func releaseHash(value any) string {
	raw, _ := json.Marshal(value)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func ReleaseCohortPrefix(key Key) string { return "release-" + releaseHash(key) + "-" }

func ReleaseCohortName(key Key, ref authz.NamedReference) string {
	return ReleaseCohortPrefix(key) + releaseHash(ref.Resource)
}

func channelPolicyResource(key Key, ref authz.NamedReference) authz.Resource {
	return authz.Resource{Tenant: key.Tenant, Kind: "cohort", ID: ReleaseCohortName(key, ref), Version: "logical"}
}

func validateTargetChannel(channel Channel, bundle Bundle) error {
	if err := ValidateChannel(channel); err != nil {
		return err
	}
	if err := ValidateBundle(bundle); err != nil || channel.Key.Namespace != bundle.Namespace || channel.ActiveBundleHash != bundle.Hash || channel.Revision == 0 {
		return fmt.Errorf("%w: channel and bundle selection differ", ErrInvalid)
	}
	return nil
}
