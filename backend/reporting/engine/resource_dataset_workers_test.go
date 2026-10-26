package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
)

func parallelReportFixture(t *testing.T, concurrency int, allowed *atomic.Bool, execute func(context.Context) error) (*Service, *ExecuteResourceRequest) {
	t.Helper()
	raw, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	uri, _ := identity.ParseResourceURI("report://example/summary")
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return append(json.RawMessage(nil), raw...), nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed.Load() {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "synthetic-account", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceDatasetConcurrency: concurrency, ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(ctx context.Context, _ string, _ map[string]interface{}) (string, error) {
		pin, ok := requestctx.ResolvedResourceFromContext(ctx)
		if !ok || pin.URI != uri.String() {
			return "", errors.New("exact report pin missing from concurrent invocation")
		}
		if err := execute(ctx); err != nil {
			return "", err
		}
		return `{"data":[{"category":"Sample","day":"2026-10-07","amount":10,"count":5}]}`, nil
	}), service.AuthorizeResourceDataset))
	return service, &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}}
}

func TestParallelResourceDatasetExecutionIsBounded(t *testing.T) {
	var allowed atomic.Bool
	allowed.Store(true)
	var active, maximum, calls atomic.Int32
	entered := make(chan struct{}, 8)
	release := make(chan struct{})
	var once sync.Once
	finish := func() { once.Do(func() { close(release) }) }
	defer finish()
	service, request := parallelReportFixture(t, 2, &allowed, func(ctx context.Context) error {
		calls.Add(1)
		n := active.Add(1)
		defer active.Add(-1)
		for old := maximum.Load(); n > old; old = maximum.Load() {
			if maximum.CompareAndSwap(old, n) {
				break
			}
		}
		select {
		case entered <- struct{}{}:
		default:
		}
		select {
		case <-release:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	type completion struct {
		result *ExecuteResourceResult
		err    error
	}
	done := make(chan completion, 1)
	go func() { r, e := service.ExecuteResource(ctx, request); done <- completion{r, e} }()
	for i := 0; i < 2; i++ {
		select {
		case <-entered:
		case <-ctx.Done():
			t.Fatal("independent datasets did not overlap")
		}
	}
	select {
	case <-entered:
		t.Fatal("dataset concurrency exceeded the host limit")
	case <-time.After(25 * time.Millisecond):
	}
	finish()
	select {
	case out := <-done:
		if out.err != nil {
			t.Fatal(out.err)
		}
		if len(out.result.Datasets) < 3 || int(calls.Load()) != len(out.result.Datasets) || maximum.Load() != 2 || len(out.result.ReportFill) == 0 {
			t.Fatal("missing bounded complete report execution")
		}
	case <-ctx.Done():
		t.Fatal("report did not finish")
	}
}

func TestReportExecutionSelectsOnlyDeclaredDatasets(t *testing.T) {
	var allowed atomic.Bool
	allowed.Store(true)
	var calls atomic.Int32
	service, request := parallelReportFixture(t, 4, &allowed, func(context.Context) error {
		calls.Add(1)
		return nil
	})
	request.DatasetIDs = []string{"primary"}
	result, err := service.ExecuteResource(context.Background(), request)
	if err != nil || result == nil || len(result.Datasets) != 1 || result.Datasets["primary"] == nil || calls.Load() != 1 || len(result.ReportFill) == 0 {
		t.Fatalf("selected report dataset did not execute alone: result=%v err=%v calls=%d", result != nil, err, calls.Load())
	}
	for _, ids := range [][]string{{"missing"}, {"primary", "primary"}, {}} {
		before := calls.Load()
		request.DatasetIDs = ids
		if result, err := service.ExecuteResource(context.Background(), request); !errors.Is(err, identity.ErrResourceDenied) || result != nil || calls.Load() != before {
			t.Fatalf("invalid dataset selection reached a producer: ids=%v err=%v", ids, err)
		}
	}
}

func TestReportExecutionSelectsOneCompiledTableBeforeProducerFetch(t *testing.T) {
	var allowed atomic.Bool
	allowed.Store(true)
	var calls atomic.Int32
	service, request := parallelReportFixture(t, 4, &allowed, func(context.Context) error {
		calls.Add(1)
		return nil
	})
	selected := "detailTable"
	request.TableBlockID = &selected
	result, err := service.ExecuteResource(context.Background(), request)
	if err != nil || result == nil || len(result.Datasets) != 1 || result.Datasets["daily"] == nil || calls.Load() != 1 || len(result.ReportFill) == 0 {
		t.Fatalf("selected table fetched unrelated datasets: result=%v err=%v calls=%d", result != nil, err, calls.Load())
	}
	for _, id := range []string{"missing", "summaryMetric", ""} {
		before := calls.Load()
		request.TableBlockID = &id
		if result, err := service.ExecuteResource(context.Background(), request); !errors.Is(err, identity.ErrResourceDenied) || result != nil || calls.Load() != before {
			t.Fatalf("unknown, non-table or ambiguous table reached producer: id=%q err=%v calls=%d", id, err, calls.Load())
		}
	}
	request.TableBlockID = &selected
	request.DatasetIDs = []string{"daily"}
	before := calls.Load()
	if result, err := service.ExecuteResource(context.Background(), request); !errors.Is(err, identity.ErrResourceDenied) || result != nil || calls.Load() != before {
		t.Fatalf("table selector combined with caller dataset override: err=%v calls=%d", err, calls.Load())
	}
}

func TestParallelResourceDatasetFailureCancelsSibling(t *testing.T) {
	var allowed atomic.Bool
	allowed.Store(true)
	var calls atomic.Int32
	entered := make(chan struct{}, 2)
	fail := make(chan struct{})
	canceled := make(chan struct{}, 1)
	expected := errors.New("synthetic producer failed")
	service, request := parallelReportFixture(t, 2, &allowed, func(ctx context.Context) error {
		index := calls.Add(1)
		entered <- struct{}{}
		if index == 1 {
			select {
			case <-fail:
				return expected
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		<-ctx.Done()
		canceled <- struct{}{}
		return ctx.Err()
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() {
		out, err := service.ExecuteResource(ctx, request)
		if out != nil {
			done <- errors.New("partial report escaped failed fetch")
			return
		}
		done <- err
	}()
	for i := 0; i < 2; i++ {
		select {
		case <-entered:
		case <-ctx.Done():
			t.Fatal("parallel fetches did not start")
		}
	}
	close(fail)
	select {
	case err := <-done:
		if !errors.Is(err, expected) {
			t.Fatalf("wrong failure: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("failed report did not finish")
	}
	select {
	case <-canceled:
	default:
		t.Fatal("sibling fetch was not canceled")
	}
	if calls.Load() != 2 {
		t.Fatal("queued datasets were dispatched after failure")
	}
}

func TestParallelResourceDatasetRevocationPreventsPublication(t *testing.T) {
	var allowed atomic.Bool
	allowed.Store(true)
	service, request := parallelReportFixture(t, 4, &allowed, func(context.Context) error { allowed.Store(false); return nil })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	out, err := service.ExecuteResource(ctx, request)
	if out != nil || err == nil {
		t.Fatal("report escaped final authority check after concurrent fetches")
	}
}
