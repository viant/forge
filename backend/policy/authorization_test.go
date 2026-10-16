// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"errors"
	"testing"
	"time"
)

type resolverFunc func(context.Context, *Request) (*Decision, error)

func (f resolverFunc) Resolve(ctx context.Context, request *Request) (*Decision, error) {
	return f(ctx, request)
}

func TestRuntimeFilter(t *testing.T) {
	now := time.Now()
	runtime := NewRuntime(resolverFunc(func(_ context.Context, request *Request) (*Decision, error) {
		if request.Operation != OperationReportView || len(request.Candidates) != 2 {
			t.Fatalf("unexpected request: %#v", request)
		}
		return &Decision{PolicyVersion: "v1", ExpiresAt: now.Add(time.Minute), Allow: true, AllowedIDs: []string{"visible"}}, nil
	}), OperationReportView)
	runtime.Now = func() time.Time { return now }

	got, err := runtime.Filter(context.Background(), OperationReportView, "conv-1", []Candidate{{ID: "visible"}, {ID: "hidden"}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "visible" {
		t.Fatalf("Filter() = %#v", got)
	}
}

func TestAuthzRuntimeKeepsOpaqueIDsExact(t *testing.T) {
	runtime := NewRuntime(resolverFunc(func(context.Context, *Request) (*Decision, error) {
		return &Decision{PolicyVersion: "v1", ExpiresAt: time.Now().Add(time.Minute), Allow: true, AllowedIDs: []string{"Window-A"}}, nil
	}), OperationWindowView)
	runtime.ExactIDs = true
	got, err := runtime.Filter(context.Background(), OperationWindowView, "", []Candidate{{ID: "Window-A"}, {ID: "window-a"}}, nil)
	if err != nil || len(got) != 1 || got[0].ID != "Window-A" {
		t.Fatalf("exact IDs: %+v, %v", got, err)
	}
}

func TestRuntimeDisabledOperationPreservesCandidates(t *testing.T) {
	runtime := NewRuntime(resolverFunc(func(context.Context, *Request) (*Decision, error) {
		t.Fatal("disabled operation called resolver")
		return nil, nil
	}), OperationWindowView)
	got, err := runtime.Filter(context.Background(), OperationReportView, "", []Candidate{{ID: "report"}}, nil)
	if err != nil || len(got) != 1 {
		t.Fatalf("Filter() = %#v, %v", got, err)
	}
}

func TestRuntimeFailsClosed(t *testing.T) {
	now := time.Now()
	runtime := NewRuntime(resolverFunc(func(context.Context, *Request) (*Decision, error) {
		return &Decision{PolicyVersion: "v1", ExpiresAt: now.Add(time.Minute), Allow: false}, nil
	}), OperationIntentView)
	runtime.Now = func() time.Time { return now }
	if err := runtime.Authorize(context.Background(), OperationIntentView, "", Candidate{ID: "admin"}, nil); !errors.Is(err, ErrDenied) {
		t.Fatalf("Authorize() error = %v", err)
	}
}
