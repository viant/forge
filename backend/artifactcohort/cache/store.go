// Package cache is an optional hot cache for already published artifact bytes.
// It performs content integrity checks, not permission or dependency checks.
package cache

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"

	"github.com/viant/bintly"
	"github.com/viant/forge/backend/artifactcohort"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/scache"
)

const frameMagic = "FAC1"
const frameVersion byte = 1

var ErrMissing = errors.New("published artifact missing")
var ErrOversize = errors.New("published artifact exceeds cache entry limit")
var ErrImmutable = errors.New("published root version cannot change")

// CompressedStore holds immutable gzip bytes by payload hash. A durable
// implementation may replace MemoryBacking without changing the hot cache.
type CompressedStore interface {
	Load(context.Context, string) ([]byte, error)
	Save(context.Context, string, []byte) error
}
type MemoryBacking struct {
	mu     sync.Mutex
	values map[string][]byte
}

func NewMemoryBacking() *MemoryBacking { return &MemoryBacking{values: map[string][]byte{}} }
func (m *MemoryBacking) Load(_ context.Context, hash string) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	value, ok := m.values[hash]
	if !ok {
		return nil, ErrMissing
	}
	return bytes.Clone(value), nil
}
func (m *MemoryBacking) Save(_ context.Context, hash string, value []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if old, ok := m.values[hash]; ok {
		if !bytes.Equal(old, value) {
			return ErrImmutable
		}
		return nil
	}
	m.values[hash] = bytes.Clone(value)
	return nil
}
func (m *MemoryBacking) Has(_ context.Context, hash string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.values[hash]
	return ok, nil
}

type Config struct {
	SizeMB        int
	MaxEntries    int
	MaxEntryBytes int
	Backing       CompressedStore
}
type frameMeta struct{ PayloadSize uint32 }

func (m *frameMeta) EncodeBinary(w *bintly.Writer) error { w.Uint32(m.PayloadSize); return nil }
func (m *frameMeta) DecodeBinary(r *bintly.Reader) error { r.Uint32(&m.PayloadSize); return nil }

// Store serializes all scache access because Get returns arena-backed bytes
// that rotation can overwrite. Get returns an owned Artifact. WithBorrowed is
// callback-scoped and never returns the borrowed slice.
type Store struct {
	mu       sync.Mutex
	hot      *scache.Cache
	backing  CompressedStore
	maxEntry int
	refs     map[string]artifactcohort.RootRef
	hydrates atomic.Uint64
}

func New(config Config) (*Store, error) {
	if config.MaxEntryBytes < 128 {
		return nil, ErrOversize
	}
	if config.SizeMB < 1 {
		config.SizeMB = 1
	}
	// scache has two rotating segments; one complete frame must fit in one.
	if config.MaxEntryBytes+128 > config.SizeMB*(1<<20)/2 {
		return nil, ErrOversize
	}
	if config.Backing == nil {
		config.Backing = NewMemoryBacking()
	}
	// EntrySize is an average-size hint in scache.Config.Init. Passing the
	// maximum there would silently enlarge the requested hot-cache budget.
	hot, err := scache.NewMemCache(config.SizeMB, config.MaxEntries, 0)
	if err != nil {
		return nil, err
	}
	return &Store{hot: hot, backing: config.Backing, maxEntry: config.MaxEntryBytes, refs: map[string]artifactcohort.RootRef{}}, nil
}
func identity(ref artifactcohort.RootRef) string {
	return ref.URI + "\x00" + strconv.FormatUint(ref.Version, 10)
}
func (s *Store) Put(ctx context.Context, value *artifactcohort.Artifact) (failure error) {
	span := observe.Start(ctx, PhasePut, cacheLabels)
	defer func() { span.End(observe.OutcomeFor(failure), observe.CacheUnknown) }()
	if err := ctx.Err(); err != nil {
		return err
	}
	if artifactcohort.ValidateArtifact(value) != nil {
		return artifactcohort.ErrInvalid
	}
	frame, err := encodeFrame(value.Root.Hash, value.Payload)
	if err != nil {
		return err
	}
	if len(frame) > s.maxEntry {
		return ErrOversize
	}
	var buf bytes.Buffer
	zip := gzip.NewWriter(&buf)
	if _, err = zip.Write(value.Payload); err != nil {
		return err
	}
	if err = zip.Close(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := identity(value.Root)
	if old := s.refs[key]; old.URI != "" {
		if old.Kind != value.Root.Kind || old.Hash != value.Root.Hash {
			return ErrImmutable
		}
		return nil
	}
	if err = s.backing.Save(ctx, value.Root.Hash, buf.Bytes()); err != nil {
		return err
	}
	s.refs[key] = value.Root
	return nil
}
func (s *Store) Get(ctx context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
	var owned []byte
	err := s.WithBorrowed(ctx, ref, func(payload []byte) error { owned = bytes.Clone(payload); return nil })
	if err != nil {
		return nil, err
	}
	return &artifactcohort.Artifact{Root: ref, Payload: owned}, nil
}

// GetVerified uses the digest-checked immutable backing/hot cache. Hot bytes
// are copied for the caller; they do not need another JSON/hash validation.
func (s *Store) GetVerified(ctx context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
	return s.Get(ctx, ref)
}

// Has checks a trusted manifest's exact immutable root/version/hash binding.
// It does not touch scache, decompress bytes or validate the payload again.
// Get performs digest validation when a cold backing entry is hydrated.
func (s *Store) Has(ctx context.Context, ref artifactcohort.RootRef) (exists bool, failure error) {
	span := observe.Start(ctx, PhaseHas, cacheLabels)
	state := observe.CacheUnknown
	defer func() { span.End(observe.OutcomeFor(failure), state) }()
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if ref.URI == "" || ref.Kind == "" || ref.Version == 0 || ref.Hash == "" {
		return false, artifactcohort.ErrInvalid
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := identity(ref)
	if old := s.refs[key]; old.URI != "" {
		if old.Kind != ref.Kind || old.Hash != ref.Hash {
			return false, ErrImmutable
		}
		state = observe.CacheHit
		return true, nil
	}
	known, ok := s.backing.(interface {
		Has(context.Context, string) (bool, error)
	})
	if !ok {
		state = observe.CacheMiss
		return false, nil
	}
	exists, err := known.Has(ctx, ref.Hash)
	if err != nil || !exists {
		state = observe.CacheMiss
		return false, err
	}
	s.refs[key] = ref
	state = observe.CacheHit
	return true, nil
}

// WithBorrowed holds the store lock across Get, Bintly decode and callback.
// The callback must not retain payload or reenter this Store.
func (s *Store) WithBorrowed(ctx context.Context, ref artifactcohort.RootRef, fn func([]byte) error) (failure error) {
	span := observe.Start(ctx, PhaseGet, cacheLabels)
	state := observe.CacheUnknown
	defer func() { span.End(observe.OutcomeFor(failure), state) }()
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	held := s.refs[identity(ref)]
	if held.URI == "" {
		if known, ok := s.backing.(interface {
			Has(context.Context, string) (bool, error)
		}); ok {
			exists, err := known.Has(ctx, ref.Hash)
			if err != nil {
				return err
			}
			if exists {
				held = ref
				s.refs[identity(ref)] = ref
			}
		}
	}
	if held.URI == "" || held.Kind != ref.Kind || held.Hash != ref.Hash {
		return ErrMissing
	}
	hash := held.Hash
	lookup := observe.Start(ctx, PhaseLookup, cacheLabels)
	raw, err := s.hot.Get(hash)
	if err == nil {
		state = observe.CacheHit
		lookup.End(observe.OK, observe.CacheHit)
	} else {
		state = observe.CacheMiss
		lookup.End(observe.OK, observe.CacheMiss) // expected absence, not a failure
	}
	if err != nil {
		miss := observe.Start(ctx, PhaseMiss, cacheLabels)
		raw, err = s.hydrate(ctx, hash)
		miss.End(observe.OutcomeFor(err), observe.CacheMiss)
		if err != nil {
			return err
		}
	}
	decode := observe.Start(ctx, PhaseDecode, cacheLabels)
	payload, err := decodeFrame(raw, hash)
	decode.End(observe.OutcomeFor(err), state)
	if err != nil {
		return err
	}
	return fn(payload)
}
func (s *Store) hydrate(ctx context.Context, hash string) ([]byte, error) {
	compressed, err := s.backing.Load(ctx, hash)
	if err != nil {
		return nil, err
	}
	inflate := observe.Start(ctx, PhaseInflate, cacheLabels)
	zip, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		inflate.End(observe.OutcomeFor(err), observe.CacheMiss)
		return nil, err
	}
	defer zip.Close()
	payload, err := io.ReadAll(io.LimitReader(zip, int64(s.maxEntry)+1))
	inflate.End(observe.OutcomeFor(err), observe.CacheMiss)
	if err != nil {
		return nil, err
	}
	if len(payload) > s.maxEntry {
		return nil, ErrOversize
	}
	if artifactcohort.Hash(payload) != hash {
		return nil, errors.New("backing digest mismatch")
	}
	frame, err := encodeFrame(hash, payload)
	if err != nil {
		return nil, err
	}
	if len(frame) > s.maxEntry {
		return nil, ErrOversize
	}
	if err = s.hot.Set(hash, frame); err != nil {
		return nil, err
	}
	s.hydrates.Add(1)
	return s.hot.Get(hash)
}
func (s *Store) Hydrations() uint64 { return s.hydrates.Load() }
func (s *Store) Close() error       { s.mu.Lock(); defer s.mu.Unlock(); return s.hot.Close() }

func encodeFrame(hash string, payload []byte) ([]byte, error) {
	digest, err := hex.DecodeString(hash)
	if err != nil || len(digest) != 32 {
		return nil, artifactcohort.ErrInvalid
	}
	meta, err := bintly.Encode(&frameMeta{PayloadSize: uint32(len(payload))})
	if err != nil {
		return nil, err
	}
	arch := runtime.GOARCH
	if len(arch) > 255 || len(meta) > int(^uint32(0)) {
		return nil, ErrOversize
	}
	out := make([]byte, 0, 7+len(arch)+32+4+len(meta)+len(payload))
	out = append(out, frameMagic...)
	out = append(out, frameVersion, byte(strconv.IntSize), byte(len(arch)))
	out = append(out, arch...)
	out = append(out, digest...)
	var size [4]byte
	binary.LittleEndian.PutUint32(size[:], uint32(len(meta)))
	out = append(out, size[:]...)
	out = append(out, meta...)
	out = append(out, payload...)
	return out, nil
}
func decodeFrame(raw []byte, hash string) (payload []byte, err error) {
	defer func() {
		if recover() != nil {
			payload = nil
			err = artifactcohort.ErrInvalid
		}
	}()
	if len(raw) < 7+32+4 || string(raw[:4]) != frameMagic || raw[4] != frameVersion || int(raw[5]) != strconv.IntSize {
		return nil, artifactcohort.ErrInvalid
	}
	pos := 7
	archLen := int(raw[6])
	if len(raw) < pos+archLen+32+4 || string(raw[pos:pos+archLen]) != runtime.GOARCH {
		return nil, artifactcohort.ErrInvalid
	}
	pos += archLen
	if hex.EncodeToString(raw[pos:pos+32]) != hash {
		return nil, artifactcohort.ErrInvalid
	}
	pos += 32
	size := int(binary.LittleEndian.Uint32(raw[pos : pos+4]))
	pos += 4
	if size < 1 || size > len(raw)-pos {
		return nil, artifactcohort.ErrInvalid
	}
	var meta frameMeta
	if err := bintly.Decode(raw[pos:pos+size], &meta); err != nil {
		return nil, err
	}
	pos += size
	if int(meta.PayloadSize) != len(raw)-pos {
		return nil, artifactcohort.ErrInvalid
	}
	return raw[pos:], nil
}

// ETag identifies bytes only. The caller must authorize before a 200 or 304.
func ETag(ref artifactcohort.RootRef) string { return `"` + ref.Hash + `"` }

// SetAuthorizedHeaders is called only after the host has authorized this
// exact root. It does not inspect If-None-Match or decide whether 304 is safe.
func SetAuthorizedHeaders(w http.ResponseWriter, ref artifactcohort.RootRef) {
	w.Header().Set("ETag", ETag(ref))
	w.Header().Set("Cache-Control", "private, no-cache")
	w.Header().Set("Vary", "Authorization, Cookie")
}
