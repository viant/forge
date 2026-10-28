package artifactcohort

import (
	"context"
	"encoding/json"
	"strings"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

// NamespaceCaller obtains the policy/cohort index through the existing namespace
// API. It never retries through artifact/discover when synchronization is absent.
// Fetch uses the same producer's immutable artifact/fetch contract.
type NamespaceCaller struct {
	Client    ToolClient
	Namespace string
}

func (c NamespaceCaller) Discover(ctx context.Context) (Manifest, error) {
	return c.DiscoverKnown(ctx, "")
}

func (c NamespaceCaller) DiscoverKnown(ctx context.Context, knownHash string) (Manifest, error) {
	if c.Client == nil || c.Namespace == "" || strings.ContainsAny(c.Namespace, "/:?#") {
		return Manifest{}, ErrInvalid
	}
	result, err := c.Client.CallTool(ctx, &schema.CallToolRequestParams{Name: "namespaces/get", Arguments: map[string]any{"namespace": c.Namespace, "sync": primitive.NamespaceSyncRequest{KnownHash: knownHash}}}, mcpclient.WithNoRetry())
	if err != nil {
		return Manifest{}, err
	}
	raw, err := exactText(result)
	if err != nil {
		return Manifest{}, err
	}
	var response struct {
		Sync *primitive.NamespaceSyncResult `json:"sync"`
	}
	if json.Unmarshal(raw, &response) != nil || response.Sync == nil || response.Sync.FetchMethod != MethodFetch {
		return Manifest{}, ErrUnsupported
	}
	var manifest Manifest
	if json.Unmarshal(response.Sync.Catalog, &manifest) != nil {
		return Manifest{}, ErrInvalid
	}
	if manifest.Unchanged {
		if knownHash == "" || manifest.Hash != knownHash || len(manifest.Cohorts) != 0 || len(manifest.Policies) != 0 || len(manifest.PartitionHashes) != 0 {
			return Manifest{}, ErrInvalid
		}
		return manifest, nil
	}
	if err = ValidateManifest(manifest); err != nil {
		return Manifest{}, err
	}
	for key := range manifest.PartitionHashes {
		namespace, _, ok := cutPartition(key)
		if !ok || namespace != c.Namespace {
			return Manifest{}, ErrInvalid
		}
	}
	return manifest, nil
}

func (c NamespaceCaller) Fetch(ctx context.Context, input FetchInput) (*Artifact, error) {
	partition, err := RootPartition(input.Root)
	namespace, _, ok := cutPartition(partition)
	if err != nil || !ok || namespace != c.Namespace {
		return nil, ErrInvalid
	}
	return (MCPCaller{Client: c.Client}).Fetch(ctx, input)
}
