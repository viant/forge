package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/registry"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
)

func sectionExecutionFixture(t *testing.T, execute func(context.Context, string) error, unlisted ...bool) (*Service, *ExecuteResourceRequest) {
	t.Helper()
	raw, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Synthetic sections","blocks":[{"id":"tabs","kind":"tabGroupBlock","sectionIds":["overview","detail"],"defaultSectionId":"overview","includeUnlistedSections":false},{"id":"overview","kind":"sectionBlock","title":"Overview","blockIds":["currentMetric","priorMetric"]},{"id":"currentMetric","kind":"kpiBlock","title":"Current","datasetRef":"primary","valueField":"amount"},{"id":"priorMetric","kind":"kpiBlock","title":"Prior","datasetRef":"comparison","valueField":"amount"},{"id":"detail","kind":"sectionBlock","title":"Detail","blockIds":["detailTable","sharedMetric"]},{"id":"detailTable","kind":"tableBlock","title":"Details","datasetRef":"daily","columns":[{"key":"amount","label":"Amount"}]},{"id":"sharedMetric","kind":"kpiBlock","title":"Shared","datasetRef":"primary","valueField":"amount"}]}`)
	if len(unlisted) > 0 && unlisted[0] {
		var document map[string]interface{}
		if err := json.Unmarshal(envelope.ReportDocument, &document); err != nil {
			t.Fatal(err)
		}
		document["blocks"] = append(document["blocks"].([]interface{}), map[string]interface{}{"id": "unlistedMetric", "kind": "kpiBlock", "title": "Unlisted metric", "datasetRef": "regional", "valueField": "amount"})
		envelope.ReportDocument, err = json.Marshal(document)
		if err != nil {
			t.Fatal(err)
		}
	}
	for i := range envelope.Dependencies {
		if envelope.Dependencies[i].Kind == "report" {
			envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
		}
	}
	raw, err = json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	uri, _ := identity.ParseResourceURI("report://example/summary")
	expiry := time.Now().Add(time.Minute)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return append(json.RawMessage(nil), raw...), nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "sample-principal", ValidUntil: expiry}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceDatasetConcurrency: 4, ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	service.SetResourceDatasetExecutor(func(ctx context.Context, _ identity.ResolvedResource, descriptor *dsproto.DataSource, _ map[string]interface{}) (*dsproto.FetchResult, error) {
		if err := execute(ctx, descriptor.ID); err != nil {
			return nil, err
		}
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"amount": 10, "count": 5, "category": "Sample", "day": "2026-01-01"}}}, nil
	})
	return service, &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true}
}

type snapshotRelease struct {
	checks int
	err    error
}

func (s *snapshotRelease) BeforeDispatch(context.Context) error    { return nil }
func (s *snapshotRelease) AfterDispatch(context.Context) error     { return nil }
func (s *snapshotRelease) BeforePublication(context.Context) error { s.checks++; return s.err }

func TestSectionSnapshotPrecedesBackgroundAndSharesDatasetOnce(t *testing.T) {
	var mu sync.Mutex
	calls := map[string]int{}
	released := false
	service, request := sectionExecutionFixture(t, func(_ context.Context, id string) error {
		mu.Lock()
		defer mu.Unlock()
		calls[id]++
		if id != "records" && id != "comparison" && !released {
			return errors.New("background started before initial publication")
		}
		return nil
	})
	gate := &snapshotRelease{}
	ctx := requestctx.WithResourceReadDispatch(context.Background(), gate)
	updates := 0
	ctx = requestctx.WithToolUpdates(ctx, func(raw json.RawMessage) error {
		updates++
		var snapshot SectionReadySnapshot
		if err := json.Unmarshal(raw, &snapshot); err != nil {
			return err
		}
		if snapshot.SectionID != "overview" || snapshot.Resource == nil || len(snapshot.Sections) != 2 {
			return errors.New("invalid section snapshot")
		}
		var fill struct {
			Datasets []struct {
				ID string `json:"id"`
			} `json:"datasets"`
		}
		if json.Unmarshal(snapshot.ReportFill, &fill) != nil || len(fill.Datasets) != 2 {
			return errors.New("pending data materialized")
		}
		mu.Lock()
		released = true
		mu.Unlock()
		return nil
	})
	result, err := service.ExecuteResource(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	if updates != 1 || gate.checks != 1 || len(result.Datasets) != 3 {
		t.Fatalf("wrong publication counts: updates=%d checks=%d datasets=%d", updates, gate.checks, len(result.Datasets))
	}
	for id, count := range calls {
		if count != 1 {
			t.Fatalf("dataset %s fetched %d times", id, count)
		}
	}
	// Full terminal result uses the same materializer and datasets as JSON.
	released = true
	ordinary, err := service.ExecuteResource(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	var full, plain interface{}
	_ = json.Unmarshal(result.ReportFill, &full)
	_ = json.Unmarshal(ordinary.ReportFill, &plain)
	if !reflect.DeepEqual(full, plain) {
		t.Fatal("progressive final result differs from ordinary complete result")
	}
}
func TestSectionSnapshotFailsClosedAtPublication(t *testing.T) {
	for _, failure := range []string{"publication", "transport", "dataset"} {
		t.Run(failure, func(t *testing.T) {
			var calls atomic.Int32
			service, request := sectionExecutionFixture(t, func(context.Context, string) error {
				calls.Add(1)
				if failure == "dataset" {
					return errors.New("sample dataset failure")
				}
				return nil
			})
			gate := &snapshotRelease{}
			if failure == "publication" {
				gate.err = identity.ErrResourceDenied
			}
			ctx := requestctx.WithResourceReadDispatch(context.Background(), gate)
			updates := 0
			ctx = requestctx.WithToolUpdates(ctx, func(json.RawMessage) error { updates++; return errors.New("sample closed transport") })
			out, err := service.ExecuteResource(ctx, request)
			if err == nil || out != nil {
				t.Fatal("failed publication returned a complete result")
			}
			if failure == "publication" && updates != 0 {
				t.Fatal("denied snapshot released rows")
			}
			if calls.Load() > 2 {
				t.Fatalf("background fetched after failed initial publication: %d", calls.Load())
			}
		})
	}
}
func TestSectionSnapshotsAreExplicitOptIn(t *testing.T) {
	for _, subset := range []bool{false, true} {
		service, request := sectionExecutionFixture(t, func(context.Context, string) error { return nil })
		request.PrioritySectionID = "detail"
		if subset {
			request.DatasetIDs = []string{"daily"}
		}
		updates := 0
		ctx := context.Background()
		if subset {
			ctx = requestctx.WithToolUpdates(ctx, func(json.RawMessage) error { updates++; return nil })
		}
		out, err := service.ExecuteResource(ctx, request)
		if err != nil || out == nil || updates != 0 {
			t.Fatalf("ordinary/subset contract changed: %v %d", err, updates)
		}
	}
}

func TestSectionPriorityHintIsAdvisoryAndBackgroundFailureHasNoFullResult(t *testing.T) {
	for _, failure := range []bool{false, true} {
		published := false
		var mu sync.Mutex
		calls := map[string]int{}
		service, request := sectionExecutionFixture(t, func(_ context.Context, id string) error {
			mu.Lock()
			defer mu.Unlock()
			calls[id]++
			if !published && id == "comparison" {
				return errors.New("background ignored current section priority")
			}
			if published && failure {
				return errors.New("sample background failure")
			}
			return nil
		})
		request.PrioritySectionID = "detail"
		ctx := requestctx.WithToolUpdates(context.Background(), func(raw json.RawMessage) error {
			var snapshot SectionReadySnapshot
			if err := json.Unmarshal(raw, &snapshot); err != nil {
				return err
			}
			if snapshot.SectionID != "detail" {
				return errors.New("current section hint lost")
			}
			mu.Lock()
			published = true
			mu.Unlock()
			return nil
		})
		out, err := service.ExecuteResource(ctx, request)
		if failure {
			if err == nil || out != nil || !published {
				t.Fatal("background failure returned a completed report")
			}
		} else if err != nil || out == nil {
			t.Fatal(err)
		}
		for id, count := range calls {
			if count != 1 {
				t.Fatalf("shared dataset repeated: %s %d", id, count)
			}
		}
	}
}

func TestSectionSnapshotDoesNotWaitForOrMaterializeUnlistedBlocks(t *testing.T) {
	ready := make(chan struct{})
	hiddenStarted := make(chan struct{})
	finishHidden := make(chan struct{})
	var once sync.Once
	release := func() { once.Do(func() { close(finishHidden) }) }
	defer release()
	service, request := sectionExecutionFixture(t, func(ctx context.Context, id string) error {
		if id != "regional" {
			return nil
		}
		select {
		case <-ready:
		default:
			return errors.New("unlisted dataset delayed first section")
		}
		close(hiddenStarted)
		select {
		case <-finishHidden:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}, true)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	ctx = requestctx.WithToolUpdates(ctx, func(raw json.RawMessage) error {
		var snapshot SectionReadySnapshot
		if err := json.Unmarshal(raw, &snapshot); err != nil {
			return err
		}
		var fill struct {
			Datasets []struct {
				ID string `json:"id"`
			} `json:"datasets"`
			Blocks []struct {
				ID string `json:"id"`
			} `json:"blocks"`
		}
		if err := json.Unmarshal(snapshot.ReportFill, &fill); err != nil {
			return err
		}
		for _, dataset := range fill.Datasets {
			if dataset.ID == "regional" {
				return errors.New("unlisted data in initial snapshot")
			}
		}
		for _, block := range fill.Blocks {
			if block.ID == "unlistedMetric" {
				return errors.New("unlisted block in initial snapshot")
			}
		}
		close(ready)
		return nil
	})
	type completion struct {
		result *ExecuteResourceResult
		err    error
	}
	done := make(chan completion, 1)
	go func() { result, err := service.ExecuteResource(ctx, request); done <- completion{result, err} }()
	select {
	case <-hiddenStarted:
	case output := <-done:
		t.Fatalf("unlisted background never started after snapshot: %v", output.err)
	case <-ctx.Done():
		t.Fatal("snapshot waited for hidden data")
	}
	release()
	select {
	case output := <-done:
		if output.err != nil || output.result == nil || len(output.result.Datasets) != 4 {
			t.Fatalf("full execution changed: %v", output.err)
		}
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}
