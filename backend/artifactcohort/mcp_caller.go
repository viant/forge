package artifactcohort

import (
	"context"
	"encoding/json"

	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

// ToolClient is the authenticated, operator-configured MCP connection. Its
// credentials must come from the host configuration, never browser input.
type ToolClient interface {
	CallTool(context.Context, *schema.CallToolRequestParams, ...mcpclient.RequestOption) (*schema.CallToolResult, error)
}

type MCPCaller struct{ Client ToolClient }

func (c MCPCaller) Discover(ctx context.Context) (Manifest, error) {
	return c.DiscoverKnown(ctx, "")
}

// DiscoverKnown permits a compact unchanged response on reconnect. The
// producer compares the hash of its complete current snapshot; no sequence or
// extra signature layer is introduced.
func (c MCPCaller) DiscoverKnown(ctx context.Context, knownHash string) (Manifest, error) {
	var value Manifest
	if c.Client == nil {
		return value, ErrUnavailable
	}
	args := map[string]any{}
	if knownHash != "" {
		args["knownHash"] = knownHash
	}
	result, err := c.Client.CallTool(ctx, &schema.CallToolRequestParams{Name: MethodDiscover, Arguments: args}, mcpclient.WithNoRetry())
	if err != nil {
		return value, err
	}
	raw, err := exactText(result)
	if err != nil {
		return value, err
	}
	if err = json.Unmarshal(raw, &value); err != nil {
		return Manifest{}, ErrInvalid
	}
	if value.Unchanged {
		if knownHash == "" || value.Hash != knownHash || len(value.Cohorts) != 0 || len(value.Policies) != 0 || len(value.PartitionHashes) != 0 {
			return Manifest{}, ErrInvalid
		}
		return value, nil
	}
	if err = ValidateManifest(value); err != nil {
		return Manifest{}, err
	}
	return value, nil
}

func (c MCPCaller) Fetch(ctx context.Context, input FetchInput) (*Artifact, error) {
	if c.Client == nil || input.Tenant == "" || input.Root.URI == "" {
		return nil, ErrInvalid
	}
	result, err := c.Client.CallTool(ctx, &schema.CallToolRequestParams{Name: MethodFetch, Arguments: map[string]any{"tenant": input.Tenant, "root": input.Root}}, mcpclient.WithNoRetry())
	if err != nil {
		return nil, err
	}
	raw, err := exactText(result)
	if err != nil {
		return nil, err
	}
	var value Artifact
	if err = json.Unmarshal(raw, &value); err != nil {
		return nil, ErrInvalid
	}
	if err = ValidateArtifact(&value); err != nil {
		return nil, err
	}
	if value.Root != input.Root {
		return nil, ErrInvalid
	}
	return &value, nil
}

// exactText deliberately ignores StructuredContent: its decoded map cannot
// preserve the exact JSON RawMessage bytes covered by the producer's hash.
func exactText(result *schema.CallToolResult) ([]byte, error) {
	if result == nil || result.IsError != nil && *result.IsError || len(result.Content) != 1 {
		return nil, ErrInvalid
	}
	var value string
	switch content := result.Content[0].(type) {
	case schema.TextContent:
		if content.Type != "text" {
			return nil, ErrInvalid
		}
		value = content.Text
	case *schema.TextContent:
		if content == nil || content.Type != "text" {
			return nil, ErrInvalid
		}
		value = content.Text
	case map[string]any:
		if content["type"] != "text" {
			return nil, ErrInvalid
		}
		value, _ = content["text"].(string)
	default:
		return nil, ErrInvalid
	}
	if !json.Valid([]byte(value)) {
		return nil, ErrInvalid
	}
	return []byte(value), nil
}
