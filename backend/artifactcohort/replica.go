package artifactcohort

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"sort"
	"sync"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/provider/contract/observe"
)

// ArtifactStore is optional immutable content storage (for example SCache plus
// compressed backing). A store must be scoped to one trusted provider source;
// it supplies bytes, never authorization or an active-index decision.
type ArtifactStore interface {
	Has(context.Context, RootRef) (bool, error)
	Get(context.Context, RootRef) (*Artifact, error)
	Put(context.Context, *Artifact) error
}

// ManifestStore persists only the last verified index and policy snapshot for
// a configured source scope. Loading it never grants access: a new process
// must confirm its content hash with the authenticated MCP producer first.
type ManifestStore interface {
	Load(context.Context, string, string, string) (Manifest, error)
	Save(context.Context, string, string, string, Manifest) error
}
type Config struct {
	Enabled            bool // single operator registration for this trusted MCP source
	Source             string
	Tenant             string
	Account            string
	Caller             Caller
	Facts              authz.Provider                        // existing verified-facts provider
	SessionKey         func(context.Context) (string, error) // existing auth middleware only
	Cohort             func(context.Context) (string, error) // optional trusted selector; never an authorization override
	Store              ArtifactStore
	ManifestStore      ManifestStore
	MaxFetchConcurrent int // bounded to 1..4
}
type partitionState struct {
	hash      string
	refs      map[string]RootRef
	artifacts map[string]*Artifact
	stale     bool
}
type admission struct {
	tenant, policyIndex string
	cohorts             map[string]string // admitted cohort name -> current policy hash
}

// View exposes selected producer-closed bytes without granting access to the
// replica's other cohorts or permitting mutation of the shared artifact.
type View struct{ artifact *Artifact }

func (v *View) Ref() RootRef {
	if v == nil || v.artifact == nil {
		return RootRef{}
	}
	return v.artifact.Root
}
func (v *View) Payload() []byte {
	if v == nil || v.artifact == nil {
		return nil
	}
	return bytes.Clone(v.artifact.Payload)
}
func (v *View) ETag() string { return v.Ref().Hash }

type Replica struct {
	cfg           Config
	syncMu        sync.Mutex
	mu            sync.RWMutex
	latest        Manifest
	store         *authz.StaticStore
	partitions    map[string]*partitionState
	admissions    map[string]admission
	notifications map[string]uint64
	ready         bool
}

func NewReplica(cfg Config) (*Replica, error) {
	if cfg.Enabled && (cfg.Source == "" || cfg.Tenant == "" || cfg.Account == "" || cfg.Caller == nil || cfg.Facts == nil || cfg.SessionKey == nil) {
		return nil, ErrInvalid
	}
	if cfg.MaxFetchConcurrent < 1 || cfg.MaxFetchConcurrent > 4 {
		cfg.MaxFetchConcurrent = 4
	}
	return &Replica{cfg: cfg, partitions: map[string]*partitionState{}, admissions: map[string]admission{}, notifications: map[string]uint64{}}, nil
}
func (r *Replica) Enabled() bool      { return r != nil && r.cfg.Enabled }
func (r *Replica) Generation() uint64 { r.mu.RLock(); defer r.mu.RUnlock(); return r.latest.Generation }
func (r *Replica) PartitionReady(key string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	state := r.partitions[key]
	return r.ready && state != nil && !state.stale && state.hash == r.latest.PartitionHashes[key]
}

// MarkUpdated fences only the named namespace×kind partition. Standard MCP
// resources/updated carries the top-level URI; datasource/dialog/CSS children
// have no independent metadata track.
func (r *Replica) MarkUpdated(uri string) error {
	if !r.Enabled() {
		return ErrUnsupported
	}
	ref := RootRef{URI: uri}
	partition, err := rootPartitionURI(ref.URI)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.notifications[partition]++
	if state := r.partitions[partition]; state != nil {
		copy := *state
		copy.stale = true
		r.partitions[partition] = &copy
	}
	return nil
}
func rootPartitionURI(uri string) (string, error) {
	kind := scheme(uri)
	if !RootKind(kind) {
		return "", ErrInvalid
	}
	return RootPartition(RootRef{URI: uri, Kind: kind})
}
func scheme(uri string) string {
	for i := 0; i < len(uri); i++ {
		if uri[i] == ':' {
			return uri[:i]
		}
	}
	return ""
}

// MarkDisconnected requires a complete hash reconciliation before any local
// root is used after transport loss.
func (r *Replica) MarkDisconnected() {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for key, state := range r.partitions {
		r.notifications[key]++
		copy := *state
		copy.stale = true
		r.partitions[key] = &copy
	}
}
func (r *Replica) HandleNotification(ctx context.Context, method, uri string) error {
	if !r.Enabled() {
		return ErrUnsupported
	}
	switch method {
	case NotificationUpdated:
		if err := r.MarkUpdated(uri); err != nil {
			return err
		}
	case NotificationListChanged:
		r.MarkListChanged()
	default:
		return ErrInvalid
	}
	return r.Sync(ctx)
}

// MarkListChanged fences policy admission while the complete current index is
// fetched. Producers should use resources/updated(uri) for root-only changes
// so unrelated namespace×kind partitions stay available.
func (r *Replica) MarkListChanged() {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for key, state := range r.partitions {
		_, kind, ok := cutPartition(key)
		if !ok || kind != "policy" {
			continue
		}
		r.notifications[key]++
		copy := *state
		copy.stale = true
		r.partitions[key] = &copy
	}
}

func staticPolicyStore(ctx context.Context, manifest Manifest) (*authz.StaticStore, error) {
	store, err := authz.NewStaticStore(manifest.Policies)
	if err != nil {
		return nil, ErrInvalid
	}
	for _, cohort := range manifest.Cohorts {
		doc, e := store.Get(ctx, cohort.PolicyResource)
		if e != nil {
			return nil, ErrInvalid
		}
		resolved, _, e := authz.ResolveNamedDocument(ctx, store, doc)
		if e != nil {
			return nil, ErrInvalid
		}
		if _, ok := authz.PolicyForAction(resolved.Policies, PolicyAction); !ok {
			return nil, ErrInvalid
		}
	}
	return store, nil
}
func refsForPartition(manifest Manifest, key string) map[string]RootRef {
	refs := map[string]RootRef{}
	for _, cohort := range manifest.Cohorts {
		for _, ref := range cohort.Roots {
			partition, err := RootPartition(ref)
			if err == nil && partition == key {
				refs[RootKey(ref)] = ref
			}
		}
	}
	return refs
}
func (r *Replica) stagePartition(ctx context.Context, manifest Manifest, key string, prior *partitionState, slots chan struct{}) (*partitionState, error) {
	refs := refsForPartition(manifest, key)
	state := &partitionState{hash: manifest.PartitionHashes[key], refs: refs, artifacts: map[string]*Artifact{}}
	if len(refs) == 0 {
		return state, nil
	}
	var wg sync.WaitGroup
	var resultMu sync.Mutex
	var firstErr error
	for _, ref := range refs {
		ref := ref
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case slots <- struct{}{}:
			case <-ctx.Done():
				resultMu.Lock()
				if firstErr == nil {
					firstErr = ctx.Err()
				}
				resultMu.Unlock()
				return
			}
			defer func() { <-slots }()
			if r.cfg.Store != nil {
				hasTiming := timing(ctx, phaseStoreHas, r.cfg.Source, ref.Kind)
				known, e := r.cfg.Store.Has(ctx, ref)
				cache := observe.CacheMiss
				if known {
					cache = observe.CacheHit
				}
				hasTiming.End(timingOutcome(e), cache)
				if e != nil {
					resultMu.Lock()
					if firstErr == nil {
						firstErr = e
					}
					resultMu.Unlock()
					return
				}
				if !known {
					fetchTiming := timing(ctx, phaseArtifactFetch, r.cfg.Source, ref.Kind)
					fetched, e := r.cfg.Caller.Fetch(ctx, FetchInput{Tenant: r.cfg.Tenant, Root: ref})
					fetchedBytes := int64(0)
					if fetched != nil {
						fetchedBytes = int64(len(fetched.Payload))
					}
					fetchTiming.EndBytes(timingOutcome(e), observe.CacheMiss, fetchedBytes)
					if e != nil {
						resultMu.Lock()
						if firstErr == nil {
							firstErr = e
						}
						resultMu.Unlock()
						return
					}
					if fetched == nil || fetched.Root != ref || ValidateArtifact(fetched) != nil {
						resultMu.Lock()
						if firstErr == nil {
							firstErr = ErrInvalid
						}
						resultMu.Unlock()
						return
					}
					putTiming := timing(ctx, phaseStorePut, r.cfg.Source, ref.Kind)
					e = r.cfg.Store.Put(ctx, fetched)
					putTiming.EndBytes(timingOutcome(e), observe.CacheMiss, int64(len(fetched.Payload)))
					if e != nil {
						resultMu.Lock()
						if firstErr == nil {
							firstErr = e
						}
						resultMu.Unlock()
						return
					}
				}
				return // the optional store owns bytes; index retains refs only
			}
			var artifact *Artifact
			if prior != nil {
				if held := prior.artifacts[RootKey(ref)]; held != nil && held.Root == ref {
					artifact = held
				}
			}
			if artifact == nil {
				fetchTiming := timing(ctx, phaseArtifactFetch, r.cfg.Source, ref.Kind)
				fetched, e := r.cfg.Caller.Fetch(ctx, FetchInput{Tenant: r.cfg.Tenant, Root: ref})
				fetchedBytes := int64(0)
				if fetched != nil {
					fetchedBytes = int64(len(fetched.Payload))
				}
				fetchTiming.EndBytes(timingOutcome(e), observe.CacheMiss, fetchedBytes)
				if e != nil {
					resultMu.Lock()
					if firstErr == nil {
						firstErr = e
					}
					resultMu.Unlock()
					return
				}
				if fetched == nil || fetched.Root != ref || ValidateArtifact(fetched) != nil {
					resultMu.Lock()
					if firstErr == nil {
						firstErr = ErrInvalid
					}
					resultMu.Unlock()
					return
				}
				artifact = CloneArtifact(fetched)
			}
			resultMu.Lock()
			state.artifacts[RootKey(ref)] = artifact
			resultMu.Unlock()
		}()
	}
	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}
	return state, nil
}

// Sync compares complete manifest hashes, then independently stages/activates
// changed namespace×kind partitions. An incremental failure makes only that
// changed partition unavailable; unrelated active partitions stay open.
func (r *Replica) Sync(ctx context.Context) (syncErr error) {
	if !r.Enabled() {
		return ErrUnsupported
	}
	totalTiming := timing(ctx, phaseSyncTotal, r.cfg.Source, "")
	defer func() { totalTiming.End(timingOutcome(syncErr), observe.CacheUnknown) }()
	r.syncMu.Lock()
	defer r.syncMu.Unlock()
	r.mu.RLock()
	prior := r.latest
	activePrior := prior
	initial := !r.ready
	priorStore := r.store
	observed := make(map[string]uint64, len(r.notifications))
	for key, value := range r.notifications {
		observed[key] = value
	}
	oldStates := make(map[string]*partitionState, len(r.partitions))
	for key, value := range r.partitions {
		oldStates[key] = value
	}
	r.mu.RUnlock()
	loadedCandidate := false
	if initial && r.cfg.ManifestStore != nil {
		loadTiming := timing(ctx, phaseManifestLoad, r.cfg.Source, "")
		candidate, loadErr := r.cfg.ManifestStore.Load(ctx, r.cfg.Source, r.cfg.Tenant, r.cfg.Account)
		candidateValid := loadErr == nil && ValidateManifest(candidate) == nil
		cache := observe.CacheMiss
		if candidateValid {
			cache = observe.CacheHit
		}
		loadTiming.End(timingOutcome(loadErr), cache)
		if candidateValid {
			matchingTenant := true
			for _, cohort := range candidate.Cohorts {
				if cohort.Tenant != r.cfg.Tenant {
					matchingTenant = false
					break
				}
			}
			if matchingTenant {
				prior = candidate
				loadedCandidate = true
			}
		}
	}
	var manifest Manifest
	var err error
	discoveryTiming := timing(ctx, phaseDiscovery, r.cfg.Source, "")
	if conditional, ok := r.cfg.Caller.(interface {
		DiscoverKnown(context.Context, string) (Manifest, error)
	}); ok && prior.Hash != "" {
		manifest, err = conditional.DiscoverKnown(ctx, prior.Hash)
	} else {
		manifest, err = r.cfg.Caller.Discover(ctx)
	}
	discoveryCache := observe.CacheMiss
	if manifest.Unchanged {
		discoveryCache = observe.CacheHit
	}
	discoveryBytes := int64(0)
	if observe.Enabled(ctx) {
		raw, _ := json.Marshal(manifest)
		discoveryBytes = int64(len(raw))
	}
	discoveryTiming.EndBytes(timingOutcome(err), discoveryCache, discoveryBytes)
	if err != nil {
		return err
	}
	unchanged := manifest.Unchanged
	if unchanged {
		if manifest.Hash != prior.Hash || !loadedCandidate && priorStore == nil || len(manifest.Cohorts) != 0 || len(manifest.Policies) != 0 || len(manifest.PartitionHashes) != 0 {
			return ErrInvalid
		}
		manifest = prior
	} else if err = ValidateManifest(manifest); err != nil {
		return err
	}
	for _, cohort := range manifest.Cohorts {
		if cohort.Tenant != r.cfg.Tenant {
			return ErrDenied
		}
	}
	policyStore := priorStore
	if !unchanged || policyStore == nil {
		policyTiming := timing(ctx, phasePolicyCompile, r.cfg.Source, "")
		policyStore, err = staticPolicyStore(ctx, manifest)
		policyTiming.End(timingOutcome(err), observe.CacheMiss)
		if err != nil {
			return err
		}
	}
	staged := map[string]*partitionState{}
	failed := map[string]error{}
	pending := []string{}
	if initial {
		for key, hash := range manifest.PartitionHashes {
			if _, kind, ok := cutPartition(key); ok && kind == "policy" {
				staged[key] = &partitionState{hash: hash, refs: map[string]RootRef{}, artifacts: map[string]*Artifact{}}
			} else {
				pending = append(pending, key)
			}
		}
	} else {
		activateTiming := timing(ctx, phasePartitionActivate, r.cfg.Source, "")
		// Publish the verified index first, with changed partitions fenced.
		// Completed partitions then activate individually; a blocked sales
		// intent cannot hold back an independently staged sales window.
		r.mu.Lock()
		if r.latest.Hash != activePrior.Hash {
			r.mu.Unlock()
			return ErrConflict
		}
		next := map[string]*partitionState{}
		for key, hash := range manifest.PartitionHashes {
			current := r.partitions[key]
			if r.notifications[key] != observed[key] {
				next[key] = stalePartition(current, hash)
				failed[key] = ErrUnavailable
				continue
			}
			if current != nil && current.hash == hash && !current.stale {
				next[key] = current
				continue
			}
			if _, kind, ok := cutPartition(key); ok && kind == "policy" {
				next[key] = &partitionState{hash: hash, refs: map[string]RootRef{}, artifacts: map[string]*Artifact{}}
			} else {
				next[key] = stalePartition(current, hash)
				pending = append(pending, key)
			}
		}
		r.partitions = next // full snapshot removes omitted roots
		r.latest = manifest
		r.store = policyStore
		r.mu.Unlock()
		activateTiming.End(observe.OK, observe.CacheUnknown)
	}
	type result struct {
		key   string
		state *partitionState
		err   error
	}
	results := make(chan result, len(pending))
	fetchSlots := make(chan struct{}, r.cfg.MaxFetchConcurrent)
	partitionSlots := make(chan struct{}, r.cfg.MaxFetchConcurrent)
	for _, key := range pending {
		key := key
		go func() {
			select {
			case partitionSlots <- struct{}{}:
			case <-ctx.Done():
				results <- result{key: key, err: ctx.Err()}
				return
			}
			defer func() { <-partitionSlots }()
			_, kind, _ := cutPartition(key)
			stageTiming := timing(ctx, phasePartitionStage, r.cfg.Source, kind)
			state, e := r.stagePartition(ctx, manifest, key, oldStates[key], fetchSlots)
			stageTiming.End(timingOutcome(e), observe.CacheUnknown)
			results <- result{key: key, state: state, err: e}
		}()
	}
	for range pending {
		got := <-results
		if got.err != nil {
			failed[got.key] = got.err
			continue
		}
		if initial {
			staged[got.key] = got.state
			continue
		}
		r.mu.Lock()
		_, kind, _ := cutPartition(got.key)
		activateTiming := timing(ctx, phasePartitionActivate, r.cfg.Source, kind)
		if r.latest.Hash != manifest.Hash || r.notifications[got.key] != observed[got.key] {
			failed[got.key] = ErrUnavailable
		} else {
			r.partitions[got.key] = got.state
		}
		r.mu.Unlock()
		activateTiming.End(timingOutcome(failed[got.key]), observe.CacheUnknown)
	}
	if initial {
		activateTiming := timing(ctx, phasePartitionActivate, r.cfg.Source, "")
		r.mu.Lock()
		if r.latest.Hash != activePrior.Hash {
			r.mu.Unlock()
			return ErrConflict
		}
		for key := range staged {
			if r.notifications[key] != observed[key] {
				failed[key] = ErrUnavailable
			}
		}
		if len(failed) > 0 {
			r.mu.Unlock()
			return firstPartitionError(failed)
		}
		r.partitions = staged
		r.latest = manifest
		r.store = policyStore
		r.ready = true
		r.mu.Unlock()
		activateTiming.End(observe.OK, observe.CacheUnknown)
	}
	if len(failed) > 0 {
		return firstPartitionError(failed)
	}
	if r.cfg.ManifestStore != nil && !unchanged {
		saveTiming := timing(ctx, phaseManifestSave, r.cfg.Source, "")
		if err := r.cfg.ManifestStore.Save(ctx, r.cfg.Source, r.cfg.Tenant, r.cfg.Account, manifest); err != nil {
			saveTiming.End(timingOutcome(err), observe.CacheMiss)
			return err
		}
		saveTiming.End(observe.OK, observe.CacheMiss)
	}
	return nil
}
func stalePartition(current *partitionState, hash string) *partitionState {
	if current == nil {
		return &partitionState{hash: hash, stale: true}
	}
	copy := *current
	copy.stale = true
	return &copy
}
func firstPartitionError(failed map[string]error) error {
	for _, err := range failed {
		return err
	}
	return nil
}
func cutPartition(key string) (string, string, bool) {
	for i := 0; i < len(key); i++ {
		if key[i] == '|' {
			return key[:i], key[i+1:], true
		}
	}
	return "", "", false
}

type factProvider struct{ facts authz.Facts }

func (p factProvider) Resolve(context.Context) (authz.Facts, error) { return p.facts, nil }
func policyIndexHash(manifest Manifest, tenant string) string {
	type head struct{ Name, Hash string }
	heads := []head{}
	for _, cohort := range manifest.Cohorts {
		if cohort.Tenant == tenant {
			heads = append(heads, head{cohort.Name, cohort.PolicyHash})
		}
	}
	sort.Slice(heads, func(i, j int) bool { return heads[i].Name < heads[j].Name })
	raw, _ := json.Marshal(heads)
	return Hash(raw)
}
func (r *Replica) Admit(ctx context.Context) (admitErr error) {
	if !r.Enabled() {
		return ErrUnsupported
	}
	admitTiming := timing(ctx, phaseAdmit, r.cfg.Source, "")
	defer func() { admitTiming.End(timingOutcome(admitErr), observe.CacheUnknown) }()
	key, err := r.cfg.SessionKey(ctx)
	if err != nil || key == "" {
		return ErrDenied
	}
	facts, err := r.cfg.Facts.Resolve(ctx)
	if err != nil || facts.Subject == "" || facts.Tenant == "" {
		return ErrDenied
	}
	r.mu.RLock()
	if !r.ready || r.store == nil {
		r.mu.RUnlock()
		return ErrUnavailable
	}
	manifest, store := r.latest, r.store
	r.mu.RUnlock()
	service := &authz.Service{Store: store, Provider: factProvider{facts: facts}}
	matched := map[string]string{}
	for i := range manifest.Cohorts {
		cohort := &manifest.Cohorts[i]
		if cohort.Tenant != facts.Tenant {
			continue
		}
		decision, selected, _, e := service.AuthorizeWithRevision(ctx, authz.Request{Resource: cohort.PolicyResource, Action: PolicyAction})
		if errors.Is(e, authz.ErrDenied) {
			continue
		}
		if e != nil || decision.Bounded || selected.Subject != facts.Subject {
			return ErrDenied
		}
		matched[cohort.Name] = cohort.PolicyHash
	}
	if len(matched) == 0 {
		return ErrDenied
	}
	r.mu.RLock()
	for _, cohort := range manifest.Cohorts {
		if cohort.Tenant != facts.Tenant || matched[cohort.Name] != cohort.PolicyHash {
			continue
		}
		for _, ref := range cohort.Roots {
			partition, _ := RootPartition(ref)
			namespace, _, _ := cutPartition(partition)
			policyKey := PartitionKey(namespace, "policy")
			state := r.partitions[policyKey]
			if state == nil || state.stale || state.hash != r.latest.PartitionHashes[policyKey] {
				r.mu.RUnlock()
				return ErrUnavailable
			}
		}
	}
	r.mu.RUnlock()
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.ready || r.latest.Hash != manifest.Hash {
		return ErrUnavailable
	}
	r.admissions[key] = admission{tenant: facts.Tenant, policyIndex: policyIndexHash(manifest, facts.Tenant), cohorts: matched}
	return nil
}

// EnsureAdmitted performs the local authz join only for a new session or after
// that session's cohort policy hash changes. Ordinary opens take the pointer
// lookup path and never evaluate policy or contact MCP.
func (r *Replica) EnsureAdmitted(ctx context.Context) error {
	if !r.Enabled() {
		return ErrUnsupported
	}
	key, err := r.cfg.SessionKey(ctx)
	if err != nil || key == "" {
		return ErrDenied
	}
	r.mu.RLock()
	held, ok := r.admissions[key]
	current := ok && held.policyIndex == policyIndexHash(r.latest, held.tenant)
	r.mu.RUnlock()
	if current {
		return nil
	}
	return r.Admit(ctx)
}
func (r *Replica) Open(ctx context.Context, uri string) (view *View, openErr error) {
	if !r.Enabled() {
		return nil, ErrUnsupported
	}
	openTiming := timing(ctx, phaseRootOpen, r.cfg.Source, "")
	defer func() { openTiming.End(timingOutcome(openErr), observe.CacheUnknown) }()
	key, err := r.cfg.SessionKey(ctx)
	if err != nil || key == "" {
		return nil, ErrDenied
	}
	selected, err := r.selectedCohort(ctx)
	if err != nil {
		return nil, err
	}
	r.mu.RLock()
	ref, artifact, err := r.openRefLocked(key, uri, selected)
	r.mu.RUnlock()
	if err != nil {
		return nil, err
	}
	if r.cfg.Store == nil {
		return &View{artifact: artifact}, nil
	}
	// A compressed backing/hot scache may hydrate while a notification or
	// admission change races. Do no MCP I/O here; recheck local state at release.
	getTiming := timing(ctx, phaseStoreGet, r.cfg.Source, ref.Kind)
	loaded, err := r.cfg.Store.Get(ctx, ref)
	loadedBytes := int64(0)
	if loaded != nil {
		loadedBytes = int64(len(loaded.Payload))
	}
	getTiming.EndBytes(timingOutcome(err), observe.CacheUnknown, loadedBytes)
	if err != nil || loaded == nil || loaded.Root != ref || ValidateArtifact(loaded) != nil {
		return nil, ErrUnavailable
	}
	r.mu.RLock()
	current, _, err := r.openRefLocked(key, uri, selected)
	r.mu.RUnlock()
	if err != nil || current != ref {
		return nil, ErrUnavailable
	}
	return &View{artifact: loaded}, nil
}

func (r *Replica) selectedCohort(ctx context.Context) (string, error) {
	if r.cfg.Cohort == nil {
		return "", nil
	}
	name, err := r.cfg.Cohort(ctx)
	if err != nil || name == "" {
		return "", ErrDenied
	}
	return name, nil
}

// selectedRootLocked resolves one root from already admitted cohorts. If
// admitted cohorts assign different revisions of one URI, a trusted cohort
// selector is required; choosing the first map/list entry is never safe.
func (r *Replica) selectedRootLocked(admitted admission, uri, selected string) (RootRef, error) {
	if selected != "" && admitted.cohorts[selected] == "" {
		return RootRef{}, ErrDenied
	}
	var ref RootRef
	for _, cohort := range r.latest.Cohorts {
		if cohort.Tenant != admitted.tenant || admitted.cohorts[cohort.Name] != cohort.PolicyHash || selected != "" && cohort.Name != selected {
			continue
		}
		found, ok := FindRoot(cohort.Roots, uri)
		if !ok {
			continue
		}
		if ref.URI != "" && ref != found {
			return RootRef{}, ErrConflict
		}
		ref = found
	}
	if ref.URI == "" {
		return RootRef{}, ErrDenied
	}
	return ref, nil
}

// openRefLocked performs only local admission and active-index checks.
// Caller holds r.mu.RLock.
func (r *Replica) openRefLocked(key, uri, selectedCohort string) (RootRef, *Artifact, error) {
	if !r.ready {
		return RootRef{}, nil, ErrUnavailable
	}
	admitted, ok := r.admissions[key]
	if !ok {
		return RootRef{}, nil, ErrDenied
	}
	ref, err := r.selectedRootLocked(admitted, uri, selectedCohort)
	if err != nil {
		return RootRef{}, nil, err
	}
	partition, e := RootPartition(ref)
	if e != nil {
		return RootRef{}, nil, e
	}
	state := r.partitions[partition]
	namespace, _, _ := cutPartition(partition)
	policyKey := PartitionKey(namespace, "policy")
	policyState := r.partitions[policyKey]
	if policyState == nil || policyState.stale || policyState.hash != r.latest.PartitionHashes[policyKey] {
		return RootRef{}, nil, ErrUnavailable
	}
	if state == nil || state.stale || state.hash != r.latest.PartitionHashes[partition] || state.refs[RootKey(ref)] != ref {
		return RootRef{}, nil, ErrUnavailable
	}
	artifact := state.artifacts[RootKey(ref)]
	if r.cfg.Store == nil && (artifact == nil || artifact.Root != ref) {
		return RootRef{}, nil, ErrUnavailable
	}
	return ref, artifact, nil
}
func (r *Replica) PermittedRoots(ctx context.Context) ([]RootRef, error) {
	if !r.Enabled() {
		return nil, ErrUnsupported
	}
	key, err := r.cfg.SessionKey(ctx)
	if err != nil || key == "" {
		return nil, ErrDenied
	}
	selected, err := r.selectedCohort(ctx)
	if err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	admitted, ok := r.admissions[key]
	if !ok {
		return nil, ErrDenied
	}
	if selected != "" && admitted.cohorts[selected] == "" {
		return nil, ErrDenied
	}
	out := []RootRef{}
	seen := map[string]RootRef{}
	matched := false
	for _, cohort := range r.latest.Cohorts {
		if cohort.Tenant != admitted.tenant || admitted.cohorts[cohort.Name] != cohort.PolicyHash || selected != "" && cohort.Name != selected {
			continue
		}
		matched = true
		for _, ref := range cohort.Roots {
			if prior, ok := seen[ref.URI]; ok {
				if prior != ref {
					return nil, ErrConflict
				}
				continue
			}
			seen[ref.URI] = ref
			partition, _ := RootPartition(ref)
			namespace, _, _ := cutPartition(partition)
			state, policyState := r.partitions[partition], r.partitions[PartitionKey(namespace, "policy")]
			if state != nil && !state.stale && state.hash == r.latest.PartitionHashes[partition] && state.refs[RootKey(ref)] == ref && policyState != nil && !policyState.stale && policyState.hash == r.latest.PartitionHashes[PartitionKey(namespace, "policy")] {
				out = append(out, ref)
			}
		}
	}
	if !matched {
		return nil, ErrDenied
	}
	sort.Slice(out, func(i, j int) bool { return out[i].URI < out[j].URI })
	return out, nil
}
