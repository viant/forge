package artifactrelease

import (
	"math"
	"strings"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

// These methods use the existing authenticated MCP tools/call boundary. A
// producer derives tenant, account and workspace from its verified actor;
// none of the request DTOs accepts those authority fields.
const (
	Capability       = "io.viant/artifact-releases/v1"
	MethodList       = "releases/list"
	MethodCandidates = "releases/candidates"
	MethodPublish    = "releases/publish"
	MethodPromote    = "releases/promote"
	MethodHistory    = "releases/history"
)

// Methods returns the authenticated MCP management tools in display order.
// Callers register typed input/output schemas from the DTOs below.
func Methods() []string {
	return []string{MethodList, MethodCandidates, MethodPublish, MethodPromote, MethodHistory}
}

const (
	StatusPending = "pending"
	StatusActive  = "active"
	StatusFailed  = "failed"
)

type ListInput struct {
	Namespace string `json:"namespace"`
}

func (in ListInput) Validate() error {
	if !validName(in.Namespace) {
		return ErrInvalid
	}
	return nil
}

type CandidatesInput struct {
	Namespace string `json:"namespace"`
}

func (in CandidatesInput) Validate() error {
	if !validName(in.Namespace) {
		return ErrInvalid
	}
	return nil
}

// Publish stages one exact immutable bundle and a channel revision. The
// trusted adapter resolves root bytes and named policy heads, then calls
// NewBundle and PrepareChannelUpdate inside its publication lifecycle.
type PublishInput struct {
	Namespace        string                   `json:"namespace"`
	Name             string                   `json:"name"`
	Description      string                   `json:"description,omitempty"`
	Policies         []authz.NamedReference   `json:"policies"`
	Roots            []artifactcohort.RootRef `json:"roots"`
	ExpectedRevision uint64                   `json:"expectedRevision"`
}

func (in PublishInput) Validate() error {
	if !validName(in.Namespace) || !validName(in.Name) || strings.TrimSpace(in.Description) != in.Description || len(in.Description) > 4096 || in.ExpectedRevision > math.MaxInt64 || len(in.Policies) == 0 || len(in.Roots) == 0 {
		return ErrInvalid
	}
	priorPolicies := map[string]bool{}
	for _, ref := range in.Policies {
		key := policyKey(ref)
		if !ref.Valid() || priorPolicies[key] {
			return ErrInvalid
		}
		priorPolicies[key] = true
	}
	priorRoots := map[string]bool{}
	for _, root := range in.Roots {
		if validateRoot(in.Namespace, root) != nil || priorRoots[root.URI] {
			return ErrInvalid
		}
		priorRoots[root.URI] = true
	}
	return nil
}

// Promote selects a previously retained bundle. Rollback uses the same
// operation with an older bundle hash; no producer source is rebuilt.
type PromoteInput struct {
	Namespace        string `json:"namespace"`
	Name             string `json:"name"`
	BundleHash       string `json:"bundleHash"`
	ExpectedRevision uint64 `json:"expectedRevision"`
}

func (in PromoteInput) Validate() error {
	if !validName(in.Namespace) || !validName(in.Name) || !validHash(in.BundleHash) || in.ExpectedRevision > math.MaxInt64 {
		return ErrInvalid
	}
	return nil
}

type HistoryInput struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

func (in HistoryInput) Validate() error {
	if !validName(in.Namespace) || !validName(in.Name) {
		return ErrInvalid
	}
	return nil
}

// Result is returned by publication/promote and listed channels. Status
// "active" and Activated=true are legal only after the producer completed
// Publisher projection and the durable channel CAS. A pending result is not
// an authority to serve the candidate release.
type Result struct {
	Channel     Channel `json:"channel"`
	Bundle      *Bundle `json:"bundle,omitempty"`
	Status      string  `json:"status"`
	Activated   bool    `json:"activated"`
	OperationID string  `json:"operationId,omitempty"`
}

func (out Result) Validate() error {
	if err := ValidateChannel(out.Channel); err != nil {
		return err
	}
	switch out.Status {
	case StatusActive:
		if !out.Activated || out.Channel.ActiveBundleHash == "" {
			return ErrInvalid
		}
	case StatusPending, StatusFailed:
		if out.Activated {
			return ErrInvalid
		}
	default:
		return ErrInvalid
	}
	if out.Bundle != nil {
		if err := ValidateBundle(*out.Bundle); err != nil || out.Bundle.Namespace != out.Channel.Key.Namespace || out.Status == StatusActive && out.Bundle.Hash != out.Channel.ActiveBundleHash {
			return ErrInvalid
		}
	}
	return nil
}

type ListOutput struct {
	Channels []Result `json:"channels"`
}

type Candidate struct {
	Root  artifactcohort.RootRef `json:"root"`
	Title string                 `json:"title,omitempty"`
}

type CandidatesOutput struct {
	Artifacts []Candidate `json:"artifacts"`
}

// History is an audit projection of applied or pending channel revisions.
// It never supplies grants or a replacement for the current active channel.
type HistoryEntry struct {
	Revision    uint64     `json:"revision"`
	BundleHash  string     `json:"bundleHash"`
	Description string     `json:"description,omitempty"`
	Status      string     `json:"status"`
	CreatedAt   *time.Time `json:"createdAt,omitempty"`
}

type HistoryOutput struct {
	Entries []HistoryEntry `json:"entries"`
}
