package resource

import (
	"bytes"
	"context"
	"github.com/stretchr/testify/require"
	ui "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWindowTerminalContentCallbackAndAuthoritativeFallback(t *testing.T) {
	p := provider("studio-a")
	p.definition = localWindowBytes(t)
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	proof, _ := types.NewWindowTargetHMAC(bytes.Repeat([]byte{1}, 32))
	catalog := &WindowCatalog{Gateway: g, TargetProof: proof}
	opened, err := catalog.Get(context.Background(), &ui.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.NoError(t, err)
	pin := *opened.Definition.Resource
	before := p.calls["windows/get"]
	require.NoError(t, catalog.CheckWindowContent(context.Background(), "window://example/sales", pin, opened.Definition.ResourceTarget))
	require.Equal(t, before+1, p.calls["windows/get"], "terminal validation checks current working content with its owner")
	p.definition = append(p.definition, byte(32))
	p.resourceChanged()
	require.Error(t, catalog.CheckWindowContent(context.Background(), "window://example/sales", pin, opened.Definition.ResourceTarget))
	callbackCalls := 0
	catalog.ContentCurrent = map[string]WindowContentCheck{"studio-a": func(context.Context, identity.ResolvedResource) error {
		callbackCalls++
		return identity.ErrResourceStale
	}}
	require.ErrorIs(t, catalog.CheckWindowContent(context.Background(), "window://example/sales", pin, nil), identity.ErrResourceStale)
	require.Equal(t, 1, callbackCalls)
	require.ErrorIs(t, catalog.CheckWindowContent(context.Background(), "window://other/sales", pin, nil), identity.ErrResourceDenied)
	require.Equal(t, 1, callbackCalls)
	other := pin
	other.ProviderIdentity = "studio-b"
	require.Error(t, catalog.CheckWindowContent(context.Background(), "window://example/sales", other, nil))
	require.Equal(t, 1, callbackCalls)
}
func TestNativeTerminalCheckUsesCapturedGenerationUntilExplicitReload(t *testing.T) {
	root, bindings := nativeWindowFixture(t)
	defs, err := SnapshotWindowDefinitions(context.Background(), root, bindings, nil)
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, defs, NativeSnapshotOptions{})
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(bindings[0].URI)
	candidates, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	require.NoError(t, snapshot.CheckCandidate(context.Background(), uri, candidates[0]))
	imported := filepath.Join(root, "extension/forge/windows/campaign/detail/mobile/phone/main.js")
	original, err := os.ReadFile(imported)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(imported, append(original, byte(32)), 0600))
	require.NoError(t, snapshot.CheckCandidate(context.Background(), uri, candidates[0]))
	require.NoError(t, snapshot.Reload(context.Background()))
	require.ErrorIs(t, snapshot.CheckCandidate(context.Background(), uri, candidates[0]), identity.ErrResourceStale)
	require.NoError(t, os.WriteFile(imported, original, 0600))
	require.ErrorIs(t, snapshot.CheckCandidate(context.Background(), uri, candidates[0]), identity.ErrResourceStale)
	require.EqualValues(t, 2, snapshot.CompileCount())
	require.NoError(t, snapshot.Reload(context.Background()))
	require.NoError(t, snapshot.CheckCandidate(context.Background(), uri, candidates[0]))
}

type olderTerminalLocal struct {
	get func(context.Context, *ui.WindowDefinitionGetInput) (*ui.WindowDefinitionGetOutput, error)
}

func (*olderTerminalLocal) AuthzReady() bool { return true }
func (*olderTerminalLocal) List(context.Context, *ui.WindowDefinitionListInput) (*ui.WindowDefinitionListOutput, error) {
	return &ui.WindowDefinitionListOutput{}, nil
}
func (c *olderTerminalLocal) Get(ctx context.Context, in *ui.WindowDefinitionGetInput) (*ui.WindowDefinitionGetOutput, error) {
	return c.get(ctx, in)
}

func TestCompositeTerminalOlderLocalExactAuthorizedFallback(t *testing.T) {
	p := provider("studio-a")
	p.definition = localWindowBytes(t)
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	proof, _ := types.NewWindowTargetHMAC(bytes.Repeat([]byte{1}, 32))
	remote := &WindowCatalog{Gateway: g, TargetProof: proof}
	opened, err := remote.Get(context.Background(), &ui.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.NoError(t, err)
	pin := *opened.Definition.Resource
	target := opened.Definition.ResourceTarget
	actorKey := struct{}{}
	for _, name := range []string{"allowed", "unauthenticated", "bytes", "provider", "binding", "renewed", "expired", "narrowed-during-get", "error", "nil", "nil-definition", "nil-resource"} {
		t.Run(name, func(t *testing.T) {
			local := &olderTerminalLocal{get: func(ctx context.Context, in *ui.WindowDefinitionGetInput) (*ui.WindowDefinitionGetOutput, error) {
				require.Equal(t, "legacy-sales", in.WindowID)
				require.Equal(t, pin, *in.ResolvedResource)
				require.Same(t, target, in.Target)
				deadline, ok := ctx.Deadline()
				require.True(t, ok)
				require.False(t, deadline.After(pin.ValidUntil))
				if ctx.Value(actorKey) != true {
					return nil, identity.ErrResourceDenied
				}
				current := pin
				switch name {
				case "bytes":
					current.ContentFingerprint += "changed"
				case "provider":
					current.ProviderIdentity = "foreign"
				case "binding":
					current.AuthorityBinding += "changed"
				case "renewed":
					current.ValidUntil = pin.ValidUntil.Add(time.Second)
				case "expired":
					current.ValidUntil = time.Now().Add(-time.Second)
				case "narrowed-during-get":
					current.ValidUntil = time.Now().Add(5 * time.Millisecond)
					time.Sleep(15 * time.Millisecond)
				case "error":
					return nil, identity.ErrResourceStale
				case "nil":
					return nil, nil
				case "nil-definition":
					return &ui.WindowDefinitionGetOutput{}, nil
				case "nil-resource":
					return &ui.WindowDefinitionGetOutput{Definition: &types.Window{}}, nil
				}
				return &ui.WindowDefinitionGetOutput{Definition: &types.Window{Resource: &current}}, nil
			}}
			composite := &CompositeWindowCatalog{Local: local, LocalProviderIdentity: pin.ProviderIdentity, Remote: remote}
			ctx := context.WithValue(context.Background(), actorKey, true)
			if name == "unauthenticated" {
				ctx = context.Background()
			}
			err := composite.CheckWindowContent(ctx, "legacy-sales", pin, target)
			if name == "allowed" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
