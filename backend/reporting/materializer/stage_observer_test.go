package materializer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/provider/contract/observe"
)

var materializerStagePhases = []observe.Phase{"report.materializer.input.parse", "report.materializer.fill", "report.materializer.print", "report.materializer.output.serialize"}

type stageEventRecorder struct {
	mu     sync.Mutex
	events []observe.Event
}

func (r *stageEventRecorder) Observe(event observe.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
}
func (r *stageEventRecorder) snapshot() []observe.Event {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]observe.Event(nil), r.events...)
}
func isMaterializerStage(phase observe.Phase) bool {
	for _, p := range materializerStagePhases {
		if p == phase {
			return true
		}
	}
	return false
}
func assertMaterializerStages(t *testing.T, events []observe.Event, expected []observe.Phase, lastOutcome observe.Outcome) {
	t.Helper()
	var phases []observe.Phase
	var duration, invocation time.Duration
	for _, event := range events {
		if event.Phase == "report.materializer.runtime.invoke" {
			invocation = event.Duration
		}
		if !isMaterializerStage(event.Phase) {
			continue
		}
		phases = append(phases, event.Phase)
		duration += event.Duration
		outcome := observe.OK
		if len(phases) == len(expected) {
			outcome = lastOutcome
		}
		if event.Kind != "report" || event.Provider != "" || event.Namespace != "" || event.Bytes != 0 || event.Duration < 0 || event.Cache != observe.CacheUnknown || event.Outcome != outcome {
			t.Fatalf("unsafe or incorrect stage observation: %+v", event)
		}
	}
	if !reflect.DeepEqual(phases, expected) {
		t.Fatalf("stage phases %v, want %v", phases, expected)
	}
	if invocation > 0 && duration > invocation {
		t.Fatalf("partitioned stages %s exceed containing invocation %s", duration, invocation)
	}
}
func assertStageArtifactIdentity(t *testing.T, expected, actual *Artifacts) {
	t.Helper()
	for name, pair := range map[string][2]json.RawMessage{"fill": {expected.ReportFill, actual.ReportFill}, "print": {expected.ReportPrint, actual.ReportPrint}} {
		if len(pair[0]) == 0 && len(pair[1]) == 0 {
			continue
		}
		var a, b any
		if json.Unmarshal(pair[0], &a) != nil || json.Unmarshal(pair[1], &b) != nil || !reflect.DeepEqual(a, b) {
			t.Fatalf("observation changed %s artifact", name)
		}
	}
}
func stageFixture(t *testing.T) (json.RawMessage, map[string]json.RawMessage) {
	t.Helper()
	envelope, datasets := pooledFixture(t, "testdata/synthetic/table.json")
	spec, err := Lower(context.Background(), envelope)
	if err != nil {
		t.Fatal(err)
	}
	return spec, datasets
}
func TestMaterializerStagesPreserveArtifactsAndFillOnly(t *testing.T) {
	spec, datasets := stageFixture(t)
	for _, fillOnly := range []bool{false, true} {
		t.Run(fmt.Sprint(fillOnly), func(t *testing.T) {
			materialize := Materialize
			expected := materializerStagePhases
			if fillOnly {
				materialize = MaterializeFill
				expected = []observe.Phase{materializerStagePhases[0], materializerStagePhases[1], materializerStagePhases[3]}
			}
			baseline, err := materialize(context.Background(), spec, datasets)
			if err != nil {
				t.Fatal(err)
			}
			recorder := &stageEventRecorder{}
			out, err := materialize(observe.WithObserver(context.Background(), recorder), spec, datasets)
			if err != nil {
				t.Fatal(err)
			}
			assertStageArtifactIdentity(t, baseline, out)
			assertMaterializerStages(t, recorder.snapshot(), expected, observe.OK)
		})
	}
}
func TestMaterializerStagesPoolReuseAndConcurrentObservers(t *testing.T) {
	for len(trustedRuntimePool) > 0 {
		<-trustedRuntimePool
	}
	spec, datasets := stageFixture(t)
	first := &stageEventRecorder{}
	baseline, err := Materialize(observe.WithObserver(context.Background(), first), spec, datasets)
	if err != nil {
		t.Fatal(err)
	}
	count := len(first.snapshot())
	plain, err := Materialize(context.Background(), spec, datasets)
	if err != nil {
		t.Fatal(err)
	}
	assertStageArtifactIdentity(t, baseline, plain)
	if len(first.snapshot()) != count {
		t.Fatal("unobserved pooled invocation reused an observer")
	}
	second := &stageEventRecorder{}
	out, err := Materialize(observe.WithObserver(context.Background(), second), spec, datasets)
	if err != nil {
		t.Fatal(err)
	}
	assertStageArtifactIdentity(t, baseline, out)
	assertMaterializerStages(t, second.snapshot(), materializerStagePhases, observe.OK)
	if len(first.snapshot()) != count {
		t.Fatal("later pooled invocation sent events to earlier observer")
	}
	hit := false
	for _, event := range second.snapshot() {
		if event.Phase == "report.materializer.runtime.bootstrap" && event.Cache == observe.CacheHit {
			hit = true
		}
	}
	if !hit {
		t.Fatal("observer isolation did not exercise pooled reuse")
	}
	var wg sync.WaitGroup
	problems := make(chan error, 2)
	recorders := []*stageEventRecorder{{}, {}}
	outputs := make([]*Artifacts, 2)
	start := make(chan struct{})
	for i := range recorders {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			var e error
			outputs[i], e = Materialize(observe.WithObserver(context.Background(), recorders[i]), spec, datasets)
			if e != nil {
				problems <- e
			}
		}(i)
	}
	close(start)
	wg.Wait()
	close(problems)
	for e := range problems {
		t.Fatal(e)
	}
	for i, r := range recorders {
		assertMaterializerStages(t, r.snapshot(), materializerStagePhases, observe.OK)
		assertStageArtifactIdentity(t, baseline, outputs[i])
	}
	if len(first.snapshot()) != count {
		t.Fatal("concurrent calls leaked to a completed invocation observer")
	}
}
func TestMaterializerStagesDisabledGateAndErrorCause(t *testing.T) {
	runtime := goja.New()
	recorder := &stageEventRecorder{}
	ctx := observe.WithObserver(context.Background(), recorder)
	for _, test := range []struct {
		ctx   context.Context
		entry string
	}{{context.Background(), "materialize"}, {ctx, "lower"}} {
		invoke := func(_ goja.Value, args ...goja.Value) (goja.Value, error) {
			if len(args) != 1 {
				t.Fatal("disabled/nonmaterialize invocation received callback")
			}
			return runtime.ToValue("ok"), nil
		}
		if _, err := invokeMaterializerEntry(test.ctx, runtime, test.entry, invoke, json.RawMessage(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	if len(recorder.snapshot()) != 0 {
		t.Fatal("disabled invocation emitted stages")
	}
	cause := errors.New("private endpoint/row marker must not appear in events")
	invoke := func(_ goja.Value, args ...goja.Value) (goja.Value, error) {
		mark, ok := goja.AssertFunction(args[1])
		if !ok {
			t.Fatal("missing observed callback")
		}
		_, _ = mark(goja.Undefined(), runtime.ToValue("parse"))
		_, _ = mark(goja.Undefined(), runtime.ToValue(cause.Error()))
		_, _ = mark(goja.Undefined(), runtime.ToValue("fill"))
		return nil, cause
	}
	if _, err := invokeMaterializerEntry(ctx, runtime, "materialize", invoke, json.RawMessage(`{"private":"row marker"}`)); !errors.Is(err, cause) {
		t.Fatal("observation replaced error cause")
	}
	assertMaterializerStages(t, recorder.snapshot(), materializerStagePhases[:2], observe.Error)
	encoded, _ := json.Marshal(recorder.snapshot())
	if strings.Contains(string(encoded), "private") || strings.Contains(string(encoded), "row marker") {
		t.Fatal("stage observation leaked payload/error labels")
	}
}
func TestMaterializerStagesFreshFailureAndCancellation(t *testing.T) {
	program, err := goja.Compile("stage-fixture", `globalThis.ForgeAuthoredLowerer={materialize:function(raw,stage){stage("parse");var input=JSON.parse(raw);stage("fill");if(input.fail)throw new Error("private failure marker");if(input.loop)while(true){};stage("print");stage("serialize");var out=JSON.stringify({ok:true});stage("done");return out;}};`, false)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name, raw string
		phases    []observe.Phase
		outcome   observe.Outcome
	}{{"success", `{}`, materializerStagePhases, observe.OK}, {"parse", `not JSON`, materializerStagePhases[:1], observe.Error}, {"fill", `{"fail":true}`, materializerStagePhases[:2], observe.Error}} {
		t.Run(test.name, func(t *testing.T) {
			r := &stageEventRecorder{}
			_, err := runEntryWithTimeSourceTimeout(observe.WithObserver(context.Background(), r), program, "materialize", json.RawMessage(test.raw), nil, time.Second)
			if (err == nil) != (test.outcome == observe.OK) {
				t.Fatalf("unexpected completion: %v", err)
			}
			assertMaterializerStages(t, r.snapshot(), test.phases, test.outcome)
		})
	}
	r := &stageEventRecorder{}
	base, cancel := context.WithCancel(context.Background())
	defer cancel()
	ctx := observe.WithObserver(base, observe.ObserverFunc(func(event observe.Event) {
		r.Observe(event)
		if event.Phase == materializerStagePhases[0] {
			cancel()
		}
	}))
	if _, err := runEntryWithTimeSourceTimeout(ctx, program, "materialize", json.RawMessage(`{"loop":true}`), nil, time.Second); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation cause lost: %v", err)
	}
	assertMaterializerStages(t, r.snapshot(), materializerStagePhases[:2], observe.Canceled)
}
func TestMaterializerStagesCloseOnPanic(t *testing.T) {
	runtime := goja.New()
	r := &stageEventRecorder{}
	marker := errors.New("panic marker")
	func() {
		defer func() {
			if recover() != marker {
				t.Fatal("panic semantics changed")
			}
		}()
		_, _ = invokeMaterializerEntry(observe.WithObserver(context.Background(), r), runtime, "materialize", func(_ goja.Value, args ...goja.Value) (goja.Value, error) {
			mark, _ := goja.AssertFunction(args[1])
			_, _ = mark(goja.Undefined(), runtime.ToValue("fill"))
			panic(marker)
		}, json.RawMessage(`{}`))
	}()
	assertMaterializerStages(t, r.snapshot(), []observe.Phase{materializerStagePhases[1]}, observe.Error)
}
