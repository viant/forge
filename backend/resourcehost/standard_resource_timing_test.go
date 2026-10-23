package resource

import (
	"context"
	"sync"
	"testing"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

func TestStandardResourceReadSeparatesTransportAndDecodeTiming(t *testing.T) {
	const uri = "datasource://demo/orders"
	client := &revisionReadClient{}
	caps := capabilities{connection: Connection{Name: "fixture", ProviderIdentity: "fixture"}, indexedResources: map[string]primitive.ResourceState{uri: {URI: uri, Kind: "datasource"}}}
	var mu sync.Mutex
	events := map[observe.Phase][]observe.Event{}
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		mu.Lock()
		events[event.Phase] = append(events[event.Phase], event)
		mu.Unlock()
	}))
	if _, err := standardDefinitionGet(ctx, client, caps, identity.ResourceRef{URI: uri}); err != nil {
		t.Fatal(err)
	}
	for _, phase := range []observe.Phase{"gateway.resource.prepare", "gateway.resource.read", "gateway.resource.decode"} {
		observed := events[phase]
		if len(observed) != 1 || observed[0].Outcome != observe.OK || observed[0].Kind != "datasource" || observed[0].Provider != "fixture" {
			t.Fatalf("phase %s: %+v", phase, observed)
		}
	}
	client.pin = &identity.ResolvedResource{}
	if _, err := standardDefinitionGet(ctx, client, caps, identity.ResourceRef{URI: uri}); err == nil {
		t.Fatal("invalid provider metadata was accepted")
	}
	if observed := events["gateway.resource.decode"]; len(observed) != 2 || observed[1].Outcome != observe.Error {
		t.Fatalf("decode failure was not timed: %+v", observed)
	}
}
