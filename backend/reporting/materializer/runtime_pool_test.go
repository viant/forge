package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	goRuntime "runtime"
	"sync"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/provider/contract/observe"
)

func TestPrepareTrustedRuntimeWarmsOnlyCodeOwnedBundle(t *testing.T) {
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err := PrepareTrustedRuntime(canceled); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled preparation must not enter the pool: %v", err)
	}
	if err := PrepareTrustedRuntime(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(trustedRuntimePool) == 0 {
		t.Fatal("trusted empty runtime was not prepared")
	}
	envelope, err := os.ReadFile("testdata/steward/forecast_inventory_brief.json")
	if err != nil {
		t.Fatal(err)
	}
	var hit bool
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		if event.Phase == "report.materializer.runtime.bootstrap" && event.Cache == observe.CacheHit {
			hit = true
		}
	}))
	if _, err := Lower(ctx, envelope); err != nil {
		t.Fatal(err)
	}
	if !hit {
		t.Fatal("first lower did not borrow an initialized trusted runtime")
	}
}

// Diagnostic benchmark: runtime initialization allocates far more than it
// retains. Report the live heap delta while four empty, code-only VMs remain
// reachable so pool capacity can be chosen from retained memory, not allocs/op.
func BenchmarkTrustedRuntimeRetainedHeap(b *testing.B) {
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		b.Fatal(programError)
	}
	goRuntime.GC()
	var before, after goRuntime.MemStats
	goRuntime.ReadMemStats(&before)
	const count = 4
	instances := make([]*goja.Runtime, count)
	for i := range instances {
		instance := goja.New()
		if _, err := instance.RunProgram(program); err != nil {
			b.Fatal(err)
		}
		instances[i] = instance
	}
	goRuntime.GC()
	goRuntime.ReadMemStats(&after)
	goRuntime.KeepAlive(instances)
	if after.HeapAlloc <= before.HeapAlloc {
		b.Fatalf("retained VM heap did not increase: before=%d after=%d", before.HeapAlloc, after.HeapAlloc)
	}
	b.ReportMetric(float64(after.HeapAlloc-before.HeapAlloc)/count, "retained_B_per_vm")
	b.ReportMetric(float64(after.HeapAlloc-before.HeapAlloc), "retained_B_4vm")
}

func BenchmarkTrustedRuntimeHeapAfterMaterializedRows(b *testing.B) {
	path := "testdata/steward/forecast_inventory_brief.json"
	envelope, err := os.ReadFile(path)
	if err != nil {
		b.Fatal(err)
	}
	dataset, err := os.ReadFile(filepath.Join("testdata/steward_materialization", filepath.Base(path)))
	if err != nil {
		b.Fatal(err)
	}
	var original map[string]json.RawMessage
	if err = json.Unmarshal(dataset, &original); err != nil {
		b.Fatal(err)
	}
	for len(trustedRuntimePool) > 0 {
		<-trustedRuntimePool
	}
	spec, err := Lower(context.Background(), envelope)
	if err != nil {
		b.Fatal(err)
	}
	goRuntime.GC()
	var before, after goRuntime.MemStats
	goRuntime.ReadMemStats(&before)
	func() {
		result, e := Materialize(context.Background(), spec, original)
		if e != nil || result == nil {
			b.Fatal("materialization failed", e)
		}
	}()
	goRuntime.GC()
	goRuntime.ReadMemStats(&after)
	retained := int64(after.HeapAlloc) - int64(before.HeapAlloc)
	b.ReportMetric(float64(retained), "post_materialize_delta_B")
}

func TestTrustedRuntimePoolDoesNotLeakAlternateRowMarkers(t *testing.T) {
	path := "testdata/steward/forecast_inventory_brief.json"
	envelope, original := pooledFixture(t, path)
	spec, err := Lower(context.Background(), envelope)
	if err != nil {
		t.Fatal(err)
	}
	markers := []string{"TENANT_A_PRIVATE_MARKER", "TENANT_B_PRIVATE_MARKER"}
	datasets := make([]map[string]json.RawMessage, 2)
	for i, marker := range markers {
		var primary struct {
			Rows []map[string]any `json:"rows"`
		}
		if json.Unmarshal(original["primary"], &primary) != nil || len(primary.Rows) == 0 {
			t.Fatal("missing fixture rows")
		}
		primary.Rows[0]["channelV2"] = marker
		encoded, e := json.Marshal(primary)
		if e != nil {
			t.Fatal(e)
		}
		datasets[i] = map[string]json.RawMessage{"primary": encoded}
	}
	var wg sync.WaitGroup
	problems := make(chan error, 12)
	for n := 0; n < 12; n++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			selected := index % 2
			out, e := Materialize(context.Background(), spec, datasets[selected])
			if e != nil {
				problems <- e
				return
			}
			own, other := []byte(markers[selected]), []byte(markers[1-selected])
			if !bytes.Contains(out.ReportFill, own) || bytes.Contains(out.ReportFill, other) || bytes.Contains(out.ReportPrint, other) {
				problems <- fmt.Errorf("pooled VM crossed input row scope")
			}
		}(n)
	}
	wg.Wait()
	close(problems)
	for problem := range problems {
		t.Fatal(problem)
	}
}

func pooledFixture(t *testing.T, path string) (json.RawMessage, map[string]json.RawMessage) {
	t.Helper()
	envelope, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	dataset, err := os.ReadFile(filepath.Join("testdata/steward_materialization", filepath.Base(path)))
	if err != nil {
		t.Fatal(err)
	}
	var datasets map[string]json.RawMessage
	if err = json.Unmarshal(dataset, &datasets); err != nil {
		t.Fatal(err)
	}
	return envelope, datasets
}

func TestTrustedRuntimePoolKeepsReportOutputsIsolatedAcrossConcurrentCalls(t *testing.T) {
	paths, err := filepath.Glob("testdata/steward/*.json")
	if err != nil || len(paths) < 2 {
		t.Fatal("missing distinct report fixtures", err)
	}
	type fixture struct {
		envelope  json.RawMessage
		datasets  map[string]json.RawMessage
		fillHash  string
		printHash string
	}
	fixtures := make([]fixture, 2)
	for i := range fixtures {
		fixtures[i].envelope, fixtures[i].datasets = pooledFixture(t, paths[i])
		spec, e := Lower(context.Background(), fixtures[i].envelope)
		if e != nil {
			t.Fatal(e)
		}
		result, e := Materialize(context.Background(), spec, fixtures[i].datasets)
		if e != nil {
			t.Fatal(e)
		}
		fixtures[i].fillHash = canonicalJSONSHA256(result.ReportFill)
		fixtures[i].printHash = rawJSONSHA256(result.ReportPrint)
	}
	if fixtures[0].fillHash == fixtures[1].fillHash {
		t.Fatal("fixtures did not produce distinct data")
	}
	var mu sync.Mutex
	var timing []observe.Event
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		if event.Phase == "report.materializer.runtime.bootstrap" {
			mu.Lock()
			timing = append(timing, event)
			mu.Unlock()
		}
	}))
	var wg sync.WaitGroup
	problems := make(chan error, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			selected := fixtures[index%2]
			spec, e := Lower(ctx, selected.envelope)
			if e != nil {
				problems <- e
				return
			}
			result, e := Materialize(ctx, spec, selected.datasets)
			if e != nil {
				problems <- e
				return
			}
			if canonicalJSONSHA256(result.ReportFill) != selected.fillHash || rawJSONSHA256(result.ReportPrint) != selected.printHash {
				problems <- fmt.Errorf("pooled report output changed across calls")
			}
		}(i)
	}
	wg.Wait()
	close(problems)
	for problem := range problems {
		t.Fatal(problem)
	}
	mu.Lock()
	defer mu.Unlock()
	cacheHits := 0
	for _, event := range timing {
		if event.Cache == observe.CacheHit {
			cacheHits++
		}
		if event.Duration < 0 || event.Outcome != observe.OK || event.Kind != "report" {
			t.Fatalf("unsafe pooled runtime observation: %+v", event)
		}
	}
	if cacheHits == 0 {
		t.Fatal("trusted initialized runtime was never reused")
	}
}

func TestTrustedRuntimePoolDiscardsInterruptedRuntime(t *testing.T) {
	paths, err := filepath.Glob("testdata/steward/*.json")
	if err != nil || len(paths) == 0 {
		t.Fatal("missing report fixture", err)
	}
	envelope, _ := pooledFixture(t, paths[0])
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		t.Fatal(programError)
	}
	for len(trustedRuntimePool) > 0 {
		<-trustedRuntimePool
	}
	if _, err = runTrustedEntry(context.Background(), program, "lower", envelope); err != nil || len(trustedRuntimePool) != 1 {
		t.Fatalf("failed to warm one trusted runtime: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if _, err = runTrustedEntry(ctx, program, "lower", envelope); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("runtime did not honor in-flight deadline: %v", err)
	}
	if len(trustedRuntimePool) != 0 {
		t.Fatal("interrupted runtime returned to trusted pool")
	}
	if _, err = runTrustedEntry(context.Background(), program, "lower", envelope); err != nil {
		t.Fatalf("fresh runtime did not recover after cancellation: %v", err)
	}
}
