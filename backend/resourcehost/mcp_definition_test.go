package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authcfg "github.com/viant/mcp/client/auth/config"
	mcpcfg "github.com/viant/mcp/client/config"
	_ "github.com/viant/scy/kms/blowfish"
	"gopkg.in/yaml.v3"
)

type forbiddenMCPResolver struct{ calls *atomic.Int32 }

func (r forbiddenMCPResolver) Resolve(context.Context, authcfg.Requirement) (*authcfg.Credential, error) {
	r.calls.Add(1)
	return nil, fmt.Errorf("must not resolve")
}
func (r forbiddenMCPResolver) Refresh(context.Context, authcfg.Requirement) (*authcfg.Credential, error) {
	r.calls.Add(1)
	return nil, fmt.Errorf("must not refresh")
}
func (r forbiddenMCPResolver) Invalidate(context.Context, authcfg.Requirement) error {
	r.calls.Add(1)
	return fmt.Errorf("must not invalidate")
}

func TestMCPDefinitionRoundTripsExistingOAuthModelsWithoutResolving(t *testing.T) {
	legacy := `name: legacy
transport: {type: streamable, url: 'https://example.com/mcp'}
auth:
  oauth2ConfigURL: ['scy://configs/client.json', '/missing/config.json']
  encryptionKey: blowfish://default
  useIdToken: true
  backendForFrontend: false
  passUserToken: false
metadata:
  resources:
    upstreams: [{name: fixture, secret: {URL: 'scy://configs/database.json', Key: 'blowfish://env/NOT_READ'}}]
`
	delegated := `name: delegated
version: v1
protocol: '2025-06-18'
transport: {type: streamable, url: 'https://example.com/mcp'}
toolTimeoutSec: 17
eagerLink: true
descriptions: {accessToken: Authored tool help}
cacheable: {token: true}
resourceCacheScopes: {workspace/mcp: user}
auth:
  mode: oauth
  clientRef: web
  resource: https://example.com/mcp
  scopes: [openid, records:read]
  tokenType: accessToken
  resolution: challenge
  workspaceTokenReuse: ifCompatible
  allowCrossOriginResource: true
  inlineProvider:
    id: operator
    issuer: https://identity.example.com
    discoveryURL: https://identity.example.com/.well-known/openid-configuration
    defaultClient: web
    clients:
      token: {configURL: "scy://configs/second-client.json", usePKCE: true}
      web:
        configURL: scy://configs/oauth-client.json
        redirectURI: https://app.example.com/callback
        confidential: true
        usePKCE: true
        refreshLead: 15m
        clockSkew: 30s
        authTimeout: 8m
        scopes: [openid, records:read]
`
	referenced := `name: reference
transport: {type: streamable, url: 'https://example.com/mcp'}
auth: {mode: oauth, providerRef: provider, clientRef: cli, tokenType: idToken, resolution: eager, workspaceTokenReuse: never}
`
	for name, source := range map[string]string{"legacy": legacy, "delegated": delegated, "referenced": referenced} {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			require.NoError(t, os.MkdirAll(filepath.Join(root, "mcp"), 0700))
			file := filepath.Join(root, "mcp", name+".yaml")
			require.NoError(t, os.WriteFile(file, []byte(source), 0600))
			definitions, err := SnapshotExtensionDefinitions(context.Background(), root, []ExtensionDirectory{MCPDirectory("workspace", "mcp")})
			require.NoError(t, err)
			snapshot, err := NewNativeAssetSnapshot(context.Background(), root, definitions)
			require.NoError(t, err)
			uri, _ := identity.ParseResourceURI("mcp://workspace/" + name)
			candidates, err := snapshot.Candidates(context.Background(), uri)
			require.NoError(t, err)
			raw, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
			require.NoError(t, err)
			config, err := DecodeMCPDefinition(1, raw)
			require.NoError(t, err)
			var expected mcpcfg.MCPClient
			require.NoError(t, yaml.Unmarshal([]byte(source), &expected))
			require.Equal(t, &expected, config)
			var calls atomic.Int32
			config.Auth.ExternalResolver = forbiddenMCPResolver{&calls}
			runtimeExcluded, err := json.Marshal(config)
			require.NoError(t, err)
			exported, err := MCPDefinitionYAML(1, runtimeExcluded)
			require.NoError(t, err)
			var roundtrip mcpcfg.MCPClient
			require.NoError(t, yaml.Unmarshal(exported, &roundtrip))
			require.Equal(t, expected.Auth, roundtrip.Auth)
			if expected.Transport.Arguments == nil {
				require.Empty(t, roundtrip.Transport.Arguments)
				expected.Transport.Arguments = roundtrip.Transport.Arguments
			}
			require.Equal(t, &expected, &roundtrip)
			require.Zero(t, calls.Load())
			actual, err := os.ReadFile(file)
			require.NoError(t, err)
			require.Equal(t, []byte(source), actual)
		})
	}
	for _, source := range []string{
		"name: bad\nauth: {clientSecret: literal}\n",
		"name: bad\nauth: {accessToken: literal}\n",
		"name: bad\nauth: {refreshToken: literal}\n",
		"name: bad\nauth: {encryptionKey: 'blowfish://inline/literal'}\n",
		"name: bad\nauth: {oauth2ConfigURL: ['inlined://base64/c2VjcmV0']}\n",
		"name: bad\nmetadata: {client_secret: literal}\n",
		"name: bad\ntransport: {type: streamable, url: 'https://user:literal@example.com/mcp'}\n",
		"name: bad\ntransport: {type: streamable, url: 'https://example.com/mcp?access_token=literal'}\n",
		"name: bad\nmetadata: {secret: {URL: 'scy://configs/x', Data: literal}}\n",
	} {
		root := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(root, "mcp"), 0700))
		require.NoError(t, os.WriteFile(filepath.Join(root, "mcp/bad.yaml"), []byte(source), 0600))
		defs, err := SnapshotExtensionDefinitions(context.Background(), root, []ExtensionDirectory{MCPDirectory("workspace", "mcp")})
		require.NoError(t, err)
		_, err = NewNativeAssetSnapshot(context.Background(), root, defs)
		require.Error(t, err, source)
	}
}

func TestMCPDefinitionsUseSameGenericMCPHandlerAndYAMLResourceRead(t *testing.T) {
	var targetCalls atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		targetCalls.Add(1)
		http.Error(w, "must not connect", 500)
	}))
	defer target.Close()
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "mcp"), 0700))
	original := []byte(fmt.Sprintf("name: target\ntransport: {type: streamable, url: '%s'}\nauth: {mode: oauth, providerRef: existing, clientRef: web}\n", target.URL))
	require.NoError(t, os.WriteFile(filepath.Join(root, "mcp/target.yaml"), original, 0600))
	defs, err := SnapshotExtensionDefinitions(context.Background(), root, []ExtensionDirectory{MCPDirectory("private", "mcp")})
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, defs)
	require.NoError(t, err)
	actor, verify := PublicReadActors()
	bindings, err := snapshot.Bindings("definitions", extensionPolicy)
	require.NoError(t, err)
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "definitions", Actor: actor, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"mcp": ValidateMCPDefinition}})
	require.NoError(t, err)
	documents, err := MCPResourceDocuments(provider)
	require.NoError(t, err)
	require.NoError(t, provider.ConfigureNativeResources(documents))
	client, err := NewLocalMCPClient(provider)
	require.NoError(t, err)
	methods, err := client.ListTools(context.Background(), nil)
	require.NoError(t, err)
	names := map[string]bool{}
	for _, tool := range methods.Tools {
		names[tool.Name] = true
	}
	require.True(t, names["mcps/list"])
	require.True(t, names["mcps/get"])
	caps, err := provider.NamespaceGet(context.Background(), primitive.NamespaceGetRequest{Namespace: "private"})
	require.NoError(t, err)
	require.Len(t, caps.Kinds, 1)
	require.Equal(t, "mcp", caps.Kinds[0].Kind)
	require.Equal(t, primitive.Methods("mcp", []string{"list", "get"}), caps.Kinds[0].Methods)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "definitions", &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "definitions"}, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
	gateway := NewGateway(mgr, actor, verify, "consumer")
	defer gateway.Close()
	list, err := List[*mcpcfg.MCPClient](context.Background(), gateway, "mcp", "private")
	require.NoError(t, err)
	require.Len(t, list, 1)
	uri := "mcp://private/target"
	get, err := Get[*mcpcfg.MCPClient](context.Background(), gateway, list[0].Connection, identity.ResourceRef{URI: uri}, nil, func(raw json.RawMessage) (*mcpcfg.MCPClient, error) { return DecodeMCPDefinition(1, raw) })
	require.NoError(t, err)
	require.Equal(t, "existing", get.Definition.Auth.ProviderRef)
	inventory, err := client.ListResources(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, inventory.Resources, 1)
	require.Equal(t, uri, inventory.Resources[0].Uri)
	require.Equal(t, "application/yaml", *inventory.Resources[0].MimeType)
	yamlResult, err := client.ReadResource(context.Background(), &schema.ReadResourceRequestParams{Uri: uri})
	require.NoError(t, err)
	require.Len(t, yamlResult.Contents, 1)
	require.Equal(t, "application/yaml", *yamlResult.Contents[0].MimeType)
	var delivered mcpcfg.MCPClient
	require.NoError(t, yaml.Unmarshal([]byte(yamlResult.Contents[0].Text), &delivered))
	require.Equal(t, "web", delivered.Auth.ClientRef)
	require.Equal(t, target.URL, delivered.Transport.URL)
	require.Zero(t, targetCalls.Load(), "publishing, listing, getting and YAML reads never connect to target MCP")
	_, err = mgr.Options(context.Background(), "target")
	require.Error(t, err, "definition reads do not register described MCP")
}
