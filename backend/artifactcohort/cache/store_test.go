package cache

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"net/http/httptest"
	"runtime"
	"strconv"
	"sync"
	"testing"

	"github.com/viant/forge/backend/artifactcohort"
	"github.com/viant/forge/backend/provider/contract/observe"
)

func testStore(t testing.TB) *Store {
	t.Helper()
	store, err := New(Config{SizeMB: 1, MaxEntries: 8, MaxEntryBytes: 16 * 1024})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}
func TestExplicitSizeMBBoundsHotArena(t *testing.T) {
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	store, err := New(Config{SizeMB: 2, MaxEntries: 1000, MaxEntryBytes: 64 * 1024})
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	runtime.ReadMemStats(&after)
	runtime.KeepAlive(store)
	if after.HeapAlloc > before.HeapAlloc+20*(1<<20) {
		t.Fatalf("scache expanded 2 MiB budget: before=%d after=%d", before.HeapAlloc, after.HeapAlloc)
	}
}
func artifact(uri string, version uint64, payload []byte) *artifactcohort.Artifact {
	return &artifactcohort.Artifact{Root: artifactcohort.RootRef{URI: uri, Kind: "window", Version: version, Hash: artifactcohort.Hash(payload)}, Payload: bytes.Clone(payload)}
}
func TestPutGetImmutableOwnedAndRotations(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	first := artifact("window://studio/connectors", 1, []byte(`{"window":{"view":{}},"compiledClosure":["css","datasource","dialog"]}`))
	if err := s.Put(ctx, first); err != nil {
		t.Fatal(err)
	}
	if s.Hydrations() != 0 {
		t.Fatal("eager hydration")
	}
	read, err := s.Get(ctx, first.Root)
	if err != nil || !bytes.Equal(read.Payload, first.Payload) || s.Hydrations() != 1 {
		t.Fatalf("read: %+v %v", read, err)
	}
	read.Payload[0] = 'x'
	again, err := s.Get(ctx, first.Root)
	if err != nil || !bytes.Equal(again.Payload, first.Payload) {
		t.Fatal("owned Get mutated cache")
	}
	for i := 0; i < 60; i++ {
		next := artifact("window://studio/rotation-"+strconv.Itoa(i), 1, []byte(`{"i":`+strconv.Itoa(i)+`}`))
		if err := s.Put(ctx, next); err != nil {
			t.Fatal(err)
		}
		if _, err := s.Get(ctx, next.Root); err != nil {
			t.Fatal(err)
		}
	}
	old, err := s.Get(ctx, first.Root)
	if err != nil || !bytes.Equal(old.Payload, first.Payload) {
		t.Fatalf("old immutable artifact lost after rotation: %v", err)
	}
	changed := artifact(first.Root.URI, 1, []byte(`{"changed":true}`))
	if err := s.Put(ctx, changed); !errors.Is(err, ErrImmutable) {
		t.Fatalf("same version changed: %v", err)
	}
	latest := artifact(first.Root.URI, 2, []byte(`{"changed":true}`))
	if err := s.Put(ctx, latest); err != nil {
		t.Fatal(err)
	}
	if ETag(latest.Root) != "\""+latest.Root.Hash+"\"" {
		t.Fatal("ETag changed content identity")
	}
	response := httptest.NewRecorder()
	SetAuthorizedHeaders(response, latest.Root)
	if response.Header().Get("ETag") != ETag(latest.Root) || response.Header().Get("Cache-Control") != "private, no-cache" {
		t.Fatal("private conditional cache headers missing")
	}
}
func TestOversizeAndBackingDigestFailure(t *testing.T) {
	backing := NewMemoryBacking()
	s, err := New(Config{SizeMB: 1, MaxEntries: 8, MaxEntryBytes: 16 * 1024, Backing: backing})
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()
	oversized := artifact("window://studio/large", 1, append(append([]byte{'"'}, bytes.Repeat([]byte{'a'}, 16*1024)...), '"'))
	if err := s.Put(ctx, oversized); !errors.Is(err, ErrOversize) {
		t.Fatalf("oversized artifact accepted: %v", err)
	}
	small := artifact("window://studio/small", 1, []byte(`{"ok":true}`))
	if err := s.Put(ctx, small); err != nil {
		t.Fatal(err)
	}
	var compressed bytes.Buffer
	zip := gzip.NewWriter(&compressed)
	_, _ = zip.Write([]byte(`{"wrong":true}`))
	_ = zip.Close()
	backing.mu.Lock()
	backing.values[small.Root.Hash] = compressed.Bytes()
	backing.mu.Unlock()
	if _, err := s.Get(ctx, small.Root); err == nil {
		t.Fatal("backing digest mismatch accepted")
	}
}
func TestHasChecksImmutableIdentityWithoutHydration(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	value := artifact("window://studio/known", 1, []byte(`{"published":true}`))
	if err := s.Put(ctx, value); err != nil {
		t.Fatal(err)
	}
	known, err := s.Has(ctx, value.Root)
	if err != nil || !known || s.Hydrations() != 0 {
		t.Fatalf("Has hydrated or missed: %v %v %d", known, err, s.Hydrations())
	}
	wrong := value.Root
	wrong.Hash = artifactcohort.Hash([]byte(`{"other":true}`))
	if known, err := s.Has(ctx, wrong); known || !errors.Is(err, ErrImmutable) {
		t.Fatalf("same version accepted different hash: %v %v", known, err)
	}
	wrongKind := value.Root
	wrongKind.Kind = "skill"
	if known, err := s.Has(ctx, wrongKind); known || !errors.Is(err, ErrImmutable) {
		t.Fatalf("same URI/version changed kind: %v %v", known, err)
	}
}
func TestFileBackingPersistsColdArtifactByHash(t *testing.T) {
	ctx := context.Background()
	backing, err := NewFileBacking(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	value := artifact("window://studio/persisted", 1, []byte(`{"compiled":"closed"}`))
	newer := artifact(value.Root.URI, 2, []byte(`{"compiled":"newer"}`))
	first, err := New(Config{SizeMB: 1, MaxEntries: 8, MaxEntryBytes: 16 * 1024, Backing: backing})
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Put(ctx, value); err != nil {
		t.Fatal(err)
	}
	if err := first.Put(ctx, newer); err != nil {
		t.Fatal(err)
	}
	_ = first.Close()
	reopened, err := New(Config{SizeMB: 1, MaxEntries: 8, MaxEntryBytes: 16 * 1024, Backing: backing})
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	known, err := reopened.Has(ctx, value.Root)
	if err != nil || !known || reopened.Hydrations() != 0 {
		t.Fatalf("cold Has: %v %v %d", known, err, reopened.Hydrations())
	}
	if known, err := reopened.Has(ctx, newer.Root); err != nil || !known || reopened.Hydrations() != 0 {
		t.Fatalf("newer cold Has: %v %v %d", known, err, reopened.Hydrations())
	}
	got, err := reopened.Get(ctx, value.Root)
	if err != nil || !bytes.Equal(got.Payload, value.Payload) || reopened.Hydrations() != 1 {
		t.Fatalf("cold disk hydration: %+v %v", got, err)
	}
	gotNewer, err := reopened.Get(ctx, newer.Root)
	if err != nil || !bytes.Equal(gotNewer.Payload, newer.Payload) || reopened.Hydrations() != 2 {
		t.Fatalf("newer disk hydration: %+v %v", gotNewer, err)
	}
	if err := backing.Save(ctx, value.Root.Hash, []byte("different gzip")); !errors.Is(err, ErrImmutable) {
		t.Fatalf("immutable file overwritten: %v", err)
	}
	if _, err := backing.Load(ctx, "../../invalid"); err == nil {
		t.Fatal("invalid hash path accepted")
	}
}
func TestObservedColdMissAndRepeatHit(t *testing.T) {
	backing, err := NewFileBacking(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	store, err := New(Config{SizeMB: 1, MaxEntries: 8, MaxEntryBytes: 16 * 1024, Backing: backing})
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	var events []observe.Event
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) { events = append(events, event) }))
	value := artifact("window://studio/observed", 1, []byte(`{"published":true}`))
	if err := store.Put(ctx, value); err != nil {
		t.Fatal(err)
	}
	if !phaseSeen(events, PhaseFileStore) {
		t.Fatal("file store phase missing")
	}
	events = nil
	if _, err := store.Get(ctx, value.Root); err != nil {
		t.Fatal(err)
	}
	if !phaseSeen(events, PhaseFileLoad) || !phaseSeen(events, PhaseInflate) || !phaseSeen(events, PhaseMiss) || !phaseWithCache(events, PhaseGet, observe.CacheMiss) {
		t.Fatalf("cold observation missing: %+v", events)
	}
	events = nil
	if _, err := store.Get(ctx, value.Root); err != nil {
		t.Fatal(err)
	}
	if phaseSeen(events, PhaseFileLoad) || phaseSeen(events, PhaseInflate) || phaseSeen(events, PhaseMiss) || !phaseWithCache(events, PhaseGet, observe.CacheHit) || !phaseSeen(events, PhaseDecode) {
		t.Fatalf("repeat observation incorrect: %+v", events)
	}
}
func phaseSeen(events []observe.Event, phase observe.Phase) bool {
	for _, event := range events {
		if event.Phase == phase {
			return true
		}
	}
	return false
}
func phaseWithCache(events []observe.Event, phase observe.Phase, state observe.Cache) bool {
	for _, event := range events {
		if event.Phase == phase && event.Cache == state {
			return true
		}
	}
	return false
}
func TestConcurrentReadsAndSegmentRotation(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	stable := artifact("window://studio/stable", 1, []byte(`{"stable":true}`))
	if err := s.Put(ctx, stable); err != nil {
		t.Fatal(err)
	}
	var workers sync.WaitGroup
	for i := 0; i < 4; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for j := 0; j < 200; j++ {
				got, err := s.Get(ctx, stable.Root)
				if err != nil || !bytes.Equal(got.Payload, stable.Payload) {
					t.Errorf("rotated read: %v", err)
					return
				}
			}
		}()
	}
	workers.Add(1)
	go func() {
		defer workers.Done()
		for i := 0; i < 100; i++ {
			next := artifact("window://studio/new-"+strconv.Itoa(i), 1, []byte(`{"i":`+strconv.Itoa(i)+`}`))
			if err := s.Put(ctx, next); err != nil {
				t.Error(err)
				return
			}
			if _, err := s.Get(ctx, next.Root); err != nil {
				t.Error(err)
				return
			}
		}
	}()
	workers.Wait()
}

var sink byte

func BenchmarkProtectedRawGet(b *testing.B) {
	s := testStore(b)
	value := artifact("window://bench/item", 1, []byte(`{"payload":"`+string(bytes.Repeat([]byte{'B'}, 4096))+`"}`))
	if err := s.Put(context.Background(), value); err != nil {
		b.Fatal(err)
	}
	if _, err := s.Get(context.Background(), value.Root); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		s.mu.Lock()
		raw, err := s.hot.Get(value.Root.Hash)
		s.mu.Unlock()
		if err != nil {
			b.Fatal(err)
		}
		sink = byte(len(raw))
	}
}
func BenchmarkBintlyBorrowed(b *testing.B) {
	s := testStore(b)
	value := artifact("window://bench/item", 1, []byte(`{"payload":"`+string(bytes.Repeat([]byte{'B'}, 4096))+`"}`))
	if err := s.Put(context.Background(), value); err != nil {
		b.Fatal(err)
	}
	if _, err := s.Get(context.Background(), value.Root); err != nil {
		b.Fatal(err)
	}
	fn := func(payload []byte) error { sink = payload[0]; return nil }
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := s.WithBorrowed(context.Background(), value.Root, fn); err != nil {
			b.Fatal(err)
		}
	}
}
func BenchmarkMissHydrate(b *testing.B) {
	s := testStore(b)
	value := artifact("window://bench/item", 1, []byte(`{"payload":"`+string(bytes.Repeat([]byte{'B'}, 4096))+`"}`))
	if err := s.Put(context.Background(), value); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		s.mu.Lock()
		_ = s.hot.Delete(value.Root.Hash)
		s.mu.Unlock()
		b.StartTimer()
		if _, err := s.Get(context.Background(), value.Root); err != nil {
			b.Fatal(err)
		}
	}
}
