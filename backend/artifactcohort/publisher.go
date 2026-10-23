package artifactcohort

import (
	"bytes"
	"context"
	"encoding/json"
	"sort"
	"sync"

	"github.com/viant/authz"
)

// Publisher owns exact immutable top-level versions and one complete catalog
// generation. Producer adapters validate closed source bytes before calling
// Publish and emit standard MCP resource notifications after a successful swap.
type Publisher struct {
	mu         sync.RWMutex
	active     map[string]*Artifact // URI -> latest published version
	versions   map[string]*Artifact // RootKey -> immutable retained version
	manifest   *Manifest
	generation uint64
}

func NewPublisher() *Publisher {
	return &Publisher{active: map[string]*Artifact{}, versions: map[string]*Artifact{}}
}
func (p *Publisher) Generation() uint64 { p.mu.RLock(); defer p.mu.RUnlock(); return p.generation }

// Publish is a root-version CAS. The validator must be the producer's
// publication-time closure/schema check; a nil validator fails closed. It is
// deliberately never called by host Open or Fetch.
func (p *Publisher) Publish(ctx context.Context, root RootRef, payload json.RawMessage, validator func(context.Context, json.RawMessage) error) (*Artifact, uint64, error) {
	if p == nil || ctx == nil || ctx.Err() != nil || validator == nil {
		return nil, 0, ErrInvalid
	}
	// encoding/json compacts RawMessage and HTML-escapes when the Artifact is
	// later encoded on the MCP wire. Normalize exactly once at publication so
	// the stored bytes, content hash and text-decoded wire bytes are identical.
	canonical, marshalErr := json.Marshal(json.RawMessage(payload))
	if marshalErr != nil {
		return nil, 0, ErrInvalid
	}
	candidate := &Artifact{Root: RootRef{URI: root.URI, Kind: root.Kind, Version: root.Version, Hash: Hash(canonical)}, Payload: bytes.Clone(canonical)}
	if root.Hash != "" && root.Hash != candidate.Root.Hash {
		return nil, 0, ErrInvalid
	}
	if err := ValidateArtifact(candidate); err != nil {
		return nil, 0, err
	}
	if err := validator(ctx, bytes.Clone(candidate.Payload)); err != nil {
		return nil, 0, err
	}
	p.mu.Lock()
	if ctx.Err() != nil {
		p.mu.Unlock()
		return nil, 0, ErrInvalid
	}
	if old := p.versions[RootKey(candidate.Root)]; old != nil {
		if old.Root != candidate.Root {
			p.mu.Unlock()
			return nil, 0, ErrConflict
		}
		result, gen := CloneArtifact(old), p.generation
		p.mu.Unlock()
		return result, gen, nil
	}
	latest := p.active[root.URI]
	if latest != nil && latest.Root.Kind != root.Kind {
		p.mu.Unlock()
		return nil, 0, ErrConflict
	}
	advance := latest == nil || candidate.Root.Version > latest.Root.Version
	nextGeneration := p.generation + 1
	var next *Manifest
	if p.manifest != nil {
		copy, err := CloneManifest(*p.manifest)
		if err != nil {
			p.mu.Unlock()
			return nil, 0, err
		}
		for i := range copy.Cohorts {
			follow := false
			for _, uri := range copy.Cohorts[i].FollowPublished {
				if uri == root.URI {
					follow = true
					break
				}
			}
			if advance && follow {
				for j := range copy.Cohorts[i].Roots {
					if copy.Cohorts[i].Roots[j].URI != root.URI {
						continue
					}
					if copy.Cohorts[i].Roots[j].Kind != root.Kind {
						p.mu.Unlock()
						return nil, 0, ErrConflict
					}
					copy.Cohorts[i].Roots[j] = candidate.Root
					break
				}
			}
			copy.Cohorts[i].Hash = CohortHash(copy.Cohorts[i])
		}
		copy.Generation = nextGeneration
		FillPartitionHashes(&copy)
		copy.Hash = ManifestHash(copy)
		if err := ValidateManifest(copy); err != nil {
			p.mu.Unlock()
			return nil, 0, err
		}
		next = &copy
	}
	if p.versions == nil {
		p.versions = map[string]*Artifact{}
	}
	p.versions[RootKey(candidate.Root)] = candidate
	if advance {
		p.active[root.URI] = candidate
	}
	p.generation = nextGeneration
	p.manifest = next
	result := CloneArtifact(candidate)
	p.mu.Unlock()
	return result, nextGeneration, nil
}

// ReplaceCatalog atomically publishes policies and named cohort root sets even
// when bytes are unchanged. expectedGeneration is the exact current CAS value.
// Version zero follows the latest published root. An explicit version pins
// exact retained bytes. FollowPublished preserves follow selectors when a
// caller replaces a previously returned manifest snapshot.
func (p *Publisher) ReplaceCatalog(ctx context.Context, policies []authz.Document, cohorts []Cohort, expectedGeneration uint64) (Manifest, error) {
	if p == nil || ctx == nil || ctx.Err() != nil {
		return Manifest{}, ErrInvalid
	}
	raw, err := json.Marshal(struct {
		Policies []authz.Document
		Cohorts  []Cohort
	}{policies, cohorts})
	if err != nil {
		return Manifest{}, err
	}
	var detached struct {
		Policies []authz.Document
		Cohorts  []Cohort
	}
	if json.Unmarshal(raw, &detached) != nil {
		return Manifest{}, ErrInvalid
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.generation != expectedGeneration {
		return Manifest{}, ErrConflict
	}
	store, err := authz.NewStaticStore(detached.Policies)
	if err != nil {
		return Manifest{}, ErrInvalid
	}
	for i := range detached.Cohorts {
		c := &detached.Cohorts[i]
		if c.Name == "" || c.Tenant == "" || c.PolicyResource.Tenant != c.Tenant {
			return Manifest{}, ErrInvalid
		}
		doc, e := store.Get(ctx, c.PolicyResource)
		if e != nil {
			return Manifest{}, ErrInvalid
		}
		resolved, dependencies, e := authz.ResolveNamedDocument(ctx, store, doc)
		if e != nil {
			return Manifest{}, ErrInvalid
		}
		if _, ok := authz.PolicyForAction(resolved.Policies, PolicyAction); !ok {
			return Manifest{}, ErrInvalid
		}
		policyBytes, _ := json.Marshal(struct {
			Original, Resolved authz.Document
			Dependencies       []authz.NamedDependency
		}{doc, resolved, dependencies})
		c.PolicyHash = Hash(policyBytes)
		followInput := map[string]bool{}
		for _, uri := range c.FollowPublished {
			if uri == "" || followInput[uri] {
				return Manifest{}, ErrInvalid
			}
			followInput[uri] = true
		}
		followOutput := []string{}
		for j, ref := range c.Roots {
			follow := ref.Version == 0 || followInput[ref.URI]
			var a *Artifact
			if follow {
				a = p.active[ref.URI]
				followOutput = append(followOutput, ref.URI)
			} else {
				a = p.versions[RootKey(ref)]
			}
			if a == nil || ref.Kind != "" && ref.Kind != a.Root.Kind {
				return Manifest{}, ErrUnavailable
			}
			if !follow && ref.Hash != "" && ref.Hash != a.Root.Hash {
				return Manifest{}, ErrConflict
			}
			c.Roots[j] = a.Root
			delete(followInput, ref.URI)
		}
		if len(followInput) > 0 {
			return Manifest{}, ErrInvalid
		}
		sort.Strings(followOutput)
		c.FollowPublished = followOutput
		sort.Slice(c.Roots, func(a, b int) bool { return c.Roots[a].URI < c.Roots[b].URI })
		c.Hash = CohortHash(*c)
	}
	sort.Slice(detached.Cohorts, func(i, j int) bool {
		return detached.Cohorts[i].Tenant+"|"+detached.Cohorts[i].Name < detached.Cohorts[j].Tenant+"|"+detached.Cohorts[j].Name
	})
	next := Manifest{Generation: p.generation + 1, Policies: detached.Policies, Cohorts: detached.Cohorts}
	FillPartitionHashes(&next)
	next.Hash = ManifestHash(next)
	if err = ValidateManifest(next); err != nil {
		return Manifest{}, err
	}
	p.generation = next.Generation
	p.manifest = &next
	return CloneManifest(next)
}
func (p *Publisher) Snapshot() (Manifest, error) {
	if p == nil {
		return Manifest{}, ErrUnavailable
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.manifest == nil {
		return Manifest{}, ErrUnavailable
	}
	return CloneManifest(*p.manifest)
}
func (p *Publisher) Get(ref RootRef) (*Artifact, error) {
	if p == nil {
		return nil, ErrUnavailable
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	a := p.versions[RootKey(ref)]
	if a == nil || a.Root != ref {
		return nil, ErrUnavailable
	}
	return CloneArtifact(a), nil
}
