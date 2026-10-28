package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/viant/forge/backend/provider/contract/observe"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type publishedLoaderObject struct {
	Name   string         `json:"name"`
	Values map[string]int `json:"values"`
}

func publishedObjectCodec(calls *atomic.Int64) PublishedCodec[*publishedLoaderObject] {
	return PublishedCodec[*publishedLoaderObject]{ID: "synthetic-object.v1", Decode: func(_ context.Context, _ string, raw json.RawMessage) (*publishedLoaderObject, error) {
		calls.Add(1)
		var object publishedLoaderObject
		err := json.Unmarshal(raw, &object)
		return &object, err
	}, Clone: func(value *publishedLoaderObject) (*publishedLoaderObject, error) {
		copy := *value
		copy.Values = map[string]int{}
		for key, value := range value.Values {
			copy.Values[key] = value
		}
		return &copy, nil
	}}
}
func installPublishedObject(source *syntheticPublishedSource, uri, name string) {
	parsed, _ := identity.ParseResourceURI(uri)
	raw := json.RawMessage(fmt.Sprintf(`{"name":%q,"values":{"amount":7}}`, name))
	source.states[uri] = primitive.ResourceState{URI: uri, Kind: parsed.Kind, Namespace: parsed.Namespace, Name: parsed.Name, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}
}
func TestPublishedLoadDecodesOnceAndDetachesEachCaller(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "Example")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	first, err := Load(context.Background(), gateway, uri, codec)
	require.NoError(t, err)
	first.Value.Values["amount"] = 99
	second, err := Load(context.Background(), gateway, uri, codec)
	require.NoError(t, err)
	require.Equal(t, 7, second.Value.Values["amount"])
	require.EqualValues(t, 1, calls.Load())
	require.EqualValues(t, 1, source.gets.Load())
	require.NotSame(t, first.Value, second.Value)
	require.Equal(t, *first.Resource, *second.Resource)
	require.Zero(t, trap.calls)
	codec.ID = "synthetic-object.v2"
	_, err = Load(context.Background(), gateway, uri, codec)
	require.NoError(t, err)
	require.EqualValues(t, 2, calls.Load())
}
func TestPublishedLoadCoalescesConcurrentDecoding(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "Example")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	entered, release := make(chan struct{}), make(chan struct{})
	decode := codec.Decode
	codec.Decode = func(ctx context.Context, uri string, raw json.RawMessage) (*publishedLoaderObject, error) {
		close(entered)
		<-release
		return decode(ctx, uri, raw)
	}
	var wg sync.WaitGroup
	results := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := Load(context.Background(), gateway, uri, codec); results <- err }()
	}
	<-entered
	close(release)
	wg.Wait()
	close(results)
	for err := range results {
		require.NoError(t, err)
	}
	require.EqualValues(t, 1, calls.Load())
	require.EqualValues(t, 1, source.gets.Load())
	require.Zero(t, trap.calls)
}
func TestPublishedLoadFencesSessionsAndSelectionWithoutCachedAuthority(t *testing.T) {
	gateway, source, trap, actor := publishedFixture(t)
	*actor = identity.VerifiedActor{PublicRead: true}
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "First")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	first, err := Load(context.Background(), gateway, uri, codec)
	require.NoError(t, err)
	source.admission = "session-2"
	second, err := Load(context.Background(), gateway, uri, codec)
	require.NoError(t, err)
	require.NotEqual(t, first.Resource.AuthorityBinding, second.Resource.AuthorityBinding)
	require.EqualValues(t, 1, calls.Load())
	installPublishedObject(source, uri, "Second")
	next, err := Load(context.Background(), gateway, uri, codec)
	require.NoError(t, err)
	require.Equal(t, "Second", next.Value.Name)
	require.EqualValues(t, 2, calls.Load())
	source.denied = true
	_, err = Load(context.Background(), gateway, uri, codec)
	require.Error(t, err)
	require.EqualValues(t, 2, source.gets.Load())
	require.Zero(t, trap.calls)
}
func TestPublishedLoadRejectsMutationContractsAndFencesDecodeChanges(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "Example")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	codec.Clone = nil
	_, err := Load(context.Background(), gateway, uri, codec)
	require.Error(t, err)
	require.Zero(t, source.gets.Load())
	codec.Immutable = true
	decode := codec.Decode
	codec.Decode = func(ctx context.Context, uri string, raw json.RawMessage) (*publishedLoaderObject, error) {
		value, err := decode(ctx, uri, raw)
		source.admission = "changed-during-decode"
		return value, err
	}
	_, err = Load(context.Background(), gateway, uri, codec)
	require.Error(t, err)
	require.EqualValues(t, 1, calls.Load())
	require.Zero(t, trap.calls)
}
func TestPublishedLoadKeepsSourcesSeparateAndErrorsTerminal(t *testing.T) {
	first, source, trap, _ := publishedFixture(t)
	second, other, otherTrap, _ := publishedFixture(t)
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "Example")
	installPublishedObject(other, uri, "Example")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	_, err := Load(context.Background(), first, uri, codec)
	require.NoError(t, err)
	_, err = Load(context.Background(), second, uri, codec)
	require.NoError(t, err)
	require.EqualValues(t, 2, calls.Load())
	require.True(t, first.OwnsPublishedMetadata("prompt://example/missing"))
	_, err = Load(context.Background(), first, "prompt://example/missing", codec)
	require.Error(t, err)
	require.False(t, first.OwnsPublishedMetadata("prompt://other/missing"))
	_, err = Load(context.Background(), first, "prompt://other/missing", codec)
	require.ErrorIs(t, err, ErrUnavailable)
	codec.ID = "fails.v1"
	codec.Decode = func(context.Context, string, json.RawMessage) (*publishedLoaderObject, error) {
		return nil, errors.New("synthetic codec failure")
	}
	_, err = Load(context.Background(), first, uri, codec)
	require.ErrorContains(t, err, "synthetic codec failure")
	require.Zero(t, trap.calls)
	require.Zero(t, otherTrap.calls)
}
func TestPublishedLoadCacheIsBounded(t *testing.T) {
	gateway, source, _, _ := publishedFixture(t)
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	for i := 0; i < 140; i++ {
		uri := fmt.Sprintf("agent://example/item%d", i)
		installPublishedObject(source, uri, "Example")
		_, err := Load(context.Background(), gateway, uri, codec)
		require.NoError(t, err)
	}
	cache := gateway.publishedCompiledCache()
	cache.mu.Lock()
	defer cache.mu.Unlock()
	require.LessOrEqual(t, len(cache.entries), 128)
	require.LessOrEqual(t, cache.bytes, 32<<20)
}

func TestPublishedLoadReportsGenericDecodeAndWarmCacheDiagnostics(t *testing.T) {
	gateway, source, _, _ := publishedFixture(t)
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "Example")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	events := []observe.Event{}
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		if strings.HasPrefix(string(event.Phase), "artifact.load") {
			events = append(events, event)
		}
	}))
	_, err := Load(ctx, gateway, uri, codec)
	require.NoError(t, err)
	_, err = Load(ctx, gateway, uri, codec)
	require.NoError(t, err)
	decodes, total := 0, 0
	for _, event := range events {
		require.Equal(t, "agent", event.Labels.Kind)
		require.Equal(t, "catalog", event.Labels.Provider)
		require.Equal(t, observe.OK, event.Outcome)
		if event.Phase == "artifact.load.decode" {
			decodes++
		}
		if event.Phase == "artifact.load" {
			total++
		}
	}
	require.Equal(t, 1, decodes)
	require.Equal(t, 2, total)
}
func TestPublishedLoadWaiterCancellationDoesNotReplayDecode(t *testing.T) {
	gateway, source, _, _ := publishedFixture(t)
	uri := "agent://example/sample"
	installPublishedObject(source, uri, "Example")
	var calls atomic.Int64
	codec := publishedObjectCodec(&calls)
	decode := codec.Decode
	entered, release := make(chan struct{}), make(chan struct{})
	codec.Decode = func(ctx context.Context, uri string, raw json.RawMessage) (*publishedLoaderObject, error) {
		close(entered)
		<-release
		return decode(ctx, uri, raw)
	}
	done := make(chan error, 1)
	go func() { _, err := Load(context.Background(), gateway, uri, codec); done <- err }()
	<-entered
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := Load(ctx, gateway, uri, codec)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	close(release)
	require.NoError(t, <-done)
	require.EqualValues(t, 1, calls.Load())
	require.EqualValues(t, 1, source.gets.Load())
}
