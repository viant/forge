package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	requestctx "github.com/viant/forge/backend/requestctx"
	"sync"
	"sync/atomic"
	"testing"
)

// Synthetic metadata is authored here independently of any application report.
func TestExecutionProgressConcurrentCompletions(t *testing.T) {
	var events []ExecutionProgress
	ctx := requestctx.WithToolProgress(context.Background(), func(raw json.RawMessage) {
		var event ExecutionProgress
		if err := json.Unmarshal(raw, &event); err != nil {
			t.Fatal(err)
		}
		events = append(events, event)
	})
	p := newExecutionProgress(ctx, 23)
	var workers sync.WaitGroup
	for i := 0; i < 23; i++ {
		workers.Add(1)
		go func(i int) {
			defer workers.Done()
			d := datasetProgress{id: fmt.Sprint(i), label: "Sample", source: "sample-source"}
			p.emit("started", d)
			p.emit("completed", d)
		}(i)
	}
	workers.Wait()
	p.emit("materializing", datasetProgress{})
	completed := 0
	for _, e := range events {
		if e.Total != 23 || e.Completed < completed {
			t.Fatalf("nonmonotonic event: %+v", e)
		}
		completed = e.Completed
	}
	if completed != 23 || len(events) != 48 {
		t.Fatalf("unexpected progress: %d events, %d completed", len(events), completed)
	}
}
func TestProgressTabsRequireExplicitMembership(t *testing.T) {
	tabs := reportProgressTabs(json.RawMessage(`{"blocks":[{"id":"tabs","kind":"tabGroupBlock","sectionIds":["overview"]},{"id":"overview","kind":"sectionBlock","title":"Overview","blockIds":["table"]},{"id":"table","kind":"tableBlock","datasetRef":"sample"},{"id":"other","kind":"tableBlock","datasetRef":"unassigned"}]}`))
	if len(tabs["sample"]) != 1 || tabs["sample"][0].Label != "Overview" || len(tabs["unassigned"]) != 0 {
		t.Fatalf("unexpected association: %+v", tabs)
	}
	if got := reportProgressLabel("", "Source title", "sample"); got != "Source title" {
		t.Fatal(got)
	}
	if got := reportProgressLabel("Dataset label", "Source title", "sample"); got != "Dataset label" {
		t.Fatal(got)
	}
}

func TestResourceExecutionProgressUsesSelectedPlan(t *testing.T) {
	var allowed atomic.Bool
	allowed.Store(true)
	service, request := parallelReportFixture(t, 4, &allowed, func(context.Context) error { return nil })
	request.DatasetIDs = []string{"primary"}
	var events []ExecutionProgress
	ctx := requestctx.WithToolProgress(context.Background(), func(raw json.RawMessage) {
		var event ExecutionProgress
		if err := json.Unmarshal(raw, &event); err != nil {
			t.Fatal(err)
		}
		events = append(events, event)
	})
	out, err := service.ExecuteResource(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 4 || events[0].Phase != "planned" || events[0].Total != len(out.Datasets) || events[1].Phase != "started" || events[2].Phase != "completed" || events[2].Completed != 1 || events[3].Phase != "materializing" {
		t.Fatalf("wrong actual plan progress: %+v", events)
	}
	if events[1].DatasetID != "primary" || events[1].DataSourceID == "" || events[1].DatasetLabel == "" {
		t.Fatalf("missing authored identity: %+v", events[1])
	}
}
