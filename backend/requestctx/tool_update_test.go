package requestctx

import (
	"context"
	"encoding/json"
	"errors"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

type dispatchWithoutPublication struct{}

func (dispatchWithoutPublication) BeforeDispatch(context.Context) error { return nil }
func (dispatchWithoutPublication) AfterDispatch(context.Context) error  { return nil }
func TestPublicationRequiresOwningLifecycleSupport(t *testing.T) {
	if err := CheckResourceReadPublication(context.Background()); err != nil {
		t.Fatal(err)
	}
	ctx := WithResourceReadDispatch(context.Background(), dispatchWithoutPublication{})
	if !errors.Is(CheckResourceReadPublication(ctx), identity.ErrResourceDenied) {
		t.Fatal("unsupported host publication must fail closed")
	}
}
func TestToolUpdatesRequireOptInAndPropagatePublicationFailure(t *testing.T) {
	ctx := context.Background()
	if HasToolUpdates(ctx) {
		t.Fatal("unsolicited update capability")
	}
	if err := EmitToolUpdate(ctx, map[string]int{"value": 1}); err != nil {
		t.Fatal(err)
	}
	expected := errors.New("sample closed transport")
	calls := 0
	ctx = WithToolUpdates(ctx, func(raw json.RawMessage) error {
		calls++
		if !json.Valid(raw) {
			t.Error("invalid JSON update")
		}
		return expected
	})
	if !HasToolUpdates(ctx) || !errors.Is(EmitToolUpdate(ctx, map[string]int{"value": 1}), expected) || calls != 1 {
		t.Fatal("publication failure lost")
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if !errors.Is(EmitToolUpdate(canceled, map[string]int{"value": 2}), context.Canceled) || calls != 1 {
		t.Fatal("canceled update escaped")
	}
}
