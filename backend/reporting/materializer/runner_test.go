package materializer

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/dop251/goja"
	"github.com/viant/forge/backend/reporting/registry"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStewardAuthoredReports(t *testing.T) {
	paths, err := filepath.Glob("testdata/steward/*.json")
	if err != nil || len(paths) != 10 {
		t.Fatalf("expected ten actual envelopes: %v %d", err, len(paths))
	}
	for _, path := range paths {
		t.Run(filepath.Base(path), func(t *testing.T) {
			raw, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			spec, err := Lower(context.Background(), raw)
			if err != nil {
				t.Fatal(err)
			}
			var output map[string]any
			if json.Unmarshal(spec, &output) != nil || output["kind"] != "reportSpec" {
				t.Fatal("invalid report spec")
			}
			if len(output["datasets"].([]any)) == 0 {
				t.Fatal("no execution datasets")
			}
		})
	}
}
func TestRejectChangedDescriptorAndBuilder(t *testing.T) {
	paths, _ := filepath.Glob("testdata/steward/*.json")
	raw, _ := os.ReadFile(paths[0])
	var e registry.ReportEnvelope
	_ = json.Unmarshal(raw, &e)
	for key := range e.DataSources {
		e.DataSources[key] = json.RawMessage(`{"id":"injected"}`)
		break
	}
	changed, _ := json.Marshal(e)
	if _, err := Lower(context.Background(), changed); err == nil {
		t.Fatal("changed descriptor accepted")
	}
	_ = json.Unmarshal(raw, &e)
	e.BuilderRef = "other"
	changed, _ = json.Marshal(e)
	if _, err := Lower(context.Background(), changed); err == nil {
		t.Fatal("changed builder accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Lower(ctx, raw); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation not preserved: %v", err)
	}
}

func TestExecutionCancellation(t *testing.T) {
	program, err := goja.Compile("bounded-test", `var ForgeAuthoredLowerer={lower:function(){for(;;){}}};`, true)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Millisecond)
	defer cancel()
	start := time.Now()
	if _, err := runLowerer(ctx, program, json.RawMessage(`{}`)); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("unbounded execution error: %v", err)
	}
	if time.Since(start) > time.Second {
		t.Fatal("cancellation did not interrupt lowerer")
	}
}
func TestRejectDuplicateEnvelopeFields(t *testing.T) {
	if _, err := Lower(context.Background(), json.RawMessage(`{"schemaVersion":1,"schemaVersion":2}`)); err == nil {
		t.Fatal("duplicate fields accepted")
	}
}
