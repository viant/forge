package provider_test

import (
	"context"
	"encoding/json"
	"testing"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/mcp-protocol/schema"
)

func TestConfigurationSnapshotOwnsCatalogContainers(t *testing.T) {
	metadata := map[string]primitive.NamespaceMetadata{"team": {Description: "original", UseCases: []string{"original use case"}}}
	config := producer.LocalConfig{ProviderIdentity: "snapshot", Actor: func(context.Context) (identity.VerifiedActor, error) { return identity.VerifiedActor{}, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, NativeResources: []producer.NativeResource{{Metadata: schema.Resource{Uri: "document://original"}, Read: func(context.Context) ([]byte, error) { return nil, nil }}}, NamespaceMetadata: metadata, Validators: map[string]producer.LocalResourceValidator{"skill": func(int64, json.RawMessage) error { return nil }}}
	p, err := producer.NewLocalProvider(config)
	if err != nil {
		t.Fatal(err)
	}
	metadata["team"].UseCases[0] = "changed input"
	metadata["team"] = primitive.NamespaceMetadata{Description: "changed input"}
	delete(config.Validators, "skill")
	config.NativeResources[0].Metadata.Uri = "document://changed-input"
	snapshot := p.ConfigurationSnapshot()
	if snapshot.NamespaceMetadata["team"].Description != "original" || snapshot.NamespaceMetadata["team"].UseCases[0] != "original use case" || snapshot.NativeResources[0].Metadata.Uri != "document://original" || snapshot.Validators["skill"] == nil {
		t.Fatal("constructor retained caller-owned catalog containers")
	}
	snapshot.NamespaceMetadata["team"].UseCases[0] = "changed snapshot"
	delete(snapshot.NamespaceMetadata, "team")
	delete(snapshot.Validators, "skill")
	snapshot.NativeResources[0].Metadata.Uri = "document://changed-snapshot"
	again := p.ConfigurationSnapshot()
	if again.NamespaceMetadata["team"].Description != "original" || again.NamespaceMetadata["team"].UseCases[0] != "original use case" || again.NativeResources[0].Metadata.Uri != "document://original" || again.Validators["skill"] == nil {
		t.Fatal("configuration snapshot aliases published catalog containers")
	}
}
