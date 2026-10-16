package service_test

import (
	"context"
	"encoding/json"
	"errors"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	permittedview "github.com/viant/forge/backend/window/authorization"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"testing"
	"time"
)

func TestCanonicalOpenSuppliesResourceSelectorInputsToPresentation(t *testing.T) {
	window := &types.Window{Resource: &identity.ResolvedResource{URI: "window://workspace/order", ProviderIdentity: "owner", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "actor", ValidUntil: time.Now().Add(time.Minute)}}
	if err := json.Unmarshal([]byte(`{"authorization":{"scope":"resource","resource":{"type":"order","id":{"source":"resource","selector":"AdOrderId.0"}},"requestedCapabilities":["read"]}}`), window); err != nil {
		t.Fatal(err)
	}
	calls := 0
	bridge := service.NewService(&service.Config{WindowDefinitions: &openInputCatalog{window: window}, WindowUIProjection: func(ctx context.Context, input *windowprotocol.PresentationInput) (*types.Window, error) {
		calls++
		bound, err := permittedview.BindResource(input.Window, "order", "", input.WindowForm, input.ResourceData)
		if err != nil {
			t.Fatal(err)
		}
		if bound.ResourceID != 2688911 {
			t.Fatalf("wrong authored selector input: %d", bound.ResourceID)
		}
		return nil, service.ErrWindowSelectionUnavailable
	}})
	parameters := map[string]any{"AdOrderId": []int{2688911}}
	_, err := bridge.UICommand(context.Background(), &service.UICommandInput{Method: "ui.window.open", Params: map[string]any{"windowKey": "order", "parameters": parameters}})
	if !errors.Is(err, service.ErrWindowSelectionUnavailable) || calls != 1 {
		t.Fatalf("projection was not reached: calls=%d err=%v", calls, err)
	}
	if parameters["AdOrderId"].([]int)[0] != 2688911 {
		t.Fatal("original caller inputs changed")
	}
}

type openInputCatalog struct{ window *types.Window }

func (c *openInputCatalog) List(context.Context, *service.WindowDefinitionListInput) (*service.WindowDefinitionListOutput, error) {
	return &service.WindowDefinitionListOutput{}, nil
}
func (c *openInputCatalog) Get(context.Context, *service.WindowDefinitionGetInput) (*service.WindowDefinitionGetOutput, error) {
	return &service.WindowDefinitionGetOutput{WindowID: "order", Definition: c.window}, nil
}
func (c *openInputCatalog) UsesResourceResolution() bool { return true }
