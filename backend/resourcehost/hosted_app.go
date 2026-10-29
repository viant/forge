package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/viant/forge/backend/clientpool"
	primitiveprovider "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp-protocol/schema"
)

// HostedAppBinding is trusted host installation data. A window or caller can
// reference a resource identity, never choose its endpoint, frame URL or sandbox.
type HostedAppBinding struct {
	WindowURI          string `json:"windowURI"`
	ProviderIdentity   string `json:"providerIdentity"`
	ResourceURI        string `json:"resourceURI"`
	RendererURL        string `json:"rendererURL,omitempty"`
	RendererOrigin     string `json:"rendererOrigin,omitempty"`
	RendererPathPrefix string `json:"rendererPathPrefix,omitempty"`
	Sandbox            string `json:"sandbox"`
}

const HostedAppSandbox = "allow-scripts allow-same-origin allow-forms allow-popups"

type HostedAppReader struct {
	bindings map[string]HostedAppBinding
	Gateway  *Gateway
	Manager  *manager.Manager
	Windows  primitiveprovider.WindowDefinitionCatalog
	Actor    ActorResolver
	Verify   ActorVerifier
}

func NewHostedAppReader(bindings []HostedAppBinding, gateway *Gateway, mgr *manager.Manager, windows primitiveprovider.WindowDefinitionCatalog, actor ActorResolver, verify ActorVerifier) (*HostedAppReader, error) {
	if gateway == nil || mgr == nil || windows == nil || actor == nil || verify == nil {
		return nil, fmt.Errorf("hosted apps require installed resource authority")
	}
	if err := ValidateHostedAppBindings(bindings); err != nil {
		return nil, err
	}
	r := &HostedAppReader{bindings: map[string]HostedAppBinding{}, Gateway: gateway, Manager: mgr, Windows: windows, Actor: actor, Verify: verify}
	for _, b := range bindings {
		r.bindings[b.ResourceURI] = b
	}
	return r, nil
}
func ValidateHostedAppBindings(bindings []HostedAppBinding) error {
	seen := map[string]bool{}
	for _, b := range bindings {
		window, err := identity.ParseResourceURI(b.WindowURI)
		resource, e := url.Parse(b.ResourceURI)
		resourceIdentity, resourceErr := identity.ParseResourceURI(b.ResourceURI)
		configuredURL := b.RendererURL
		if b.RendererOrigin != "" {
			configuredURL = b.RendererOrigin
		}
		renderer, re := url.Parse(configuredURL)
		if err != nil || window.Kind != "window" || strings.TrimSpace(b.ProviderIdentity) == "" || resourceErr != nil || resourceIdentity.Kind != "ui" || resourceIdentity.Namespace != b.ProviderIdentity || e != nil || resource.Scheme != "ui" || resource.Host == "" || resource.User != nil || resource.RawQuery != "" || resource.Fragment != "" || re != nil || renderer.Host == "" || renderer.User != nil || renderer.RawQuery != "" || renderer.Fragment != "" || renderer.Scheme != "https" && (renderer.Scheme != "http" || renderer.Hostname() != "127.0.0.1" && renderer.Hostname() != "localhost") || b.Sandbox != HostedAppSandbox {
			return fmt.Errorf("invalid hosted app installation")
		}
		if b.RendererOrigin != "" && (renderer.Path != "" || b.RendererURL != "" || !strings.HasPrefix(b.RendererPathPrefix, "/api/") || path.Clean(b.RendererPathPrefix) != b.RendererPathPrefix || strings.ContainsAny(b.RendererPathPrefix, "?#\\")) {
			return fmt.Errorf("invalid versioned hosted app mount")
		}
		if seen[b.ResourceURI] {
			return fmt.Errorf("duplicate hosted app resource")
		}
		seen[b.ResourceURI] = true
	}
	return nil
}

// BindContext validates an ordinary SDK read's untrusted opened-window input.
// It does not reselect a default candidate and cannot authorize another child.
func (r *HostedAppReader) BindContext(ctx context.Context, uri string, pin *identity.ResolvedResource, target *types.WindowTarget) (context.Context, error) {
	return r.bindContext(ctx, uri, pin, target, nil)
}

func (r *HostedAppReader) bindContext(ctx context.Context, uri string, pin *identity.ResolvedResource, target *types.WindowTarget, closure *primitive.MCPAppClosure) (context.Context, error) {
	b, ok := r.bindings[uri]
	if !ok || pin == nil || target == nil || target.SelectionToken == "" || pin.URI != b.WindowURI || pin.ProviderIdentity != b.ProviderIdentity {
		return nil, identity.ErrResourceDenied
	}
	checker, ok := r.Windows.(interface {
		RevalidateWindowResource(context.Context, string, identity.ResolvedResource, *types.WindowTarget) (*identity.ResolvedResource, error)
	})
	if !ok {
		return nil, identity.ErrResourceDenied
	}
	fresh, err := checker.RevalidateWindowResource(ctx, b.WindowURI, *pin, target)
	if err != nil || fresh == nil || !sameHostedPin(*fresh, *pin) || !identity.MetadataExpiryValid(fresh.ValidUntil, r.Gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	opened, err := r.Windows.Get(ctx, &primitiveprovider.WindowDefinitionGetInput{WindowID: b.WindowURI, ResolvedResource: pin, Target: target})
	if err != nil || opened == nil || !hostedWindowMatches(opened.Definition, b) || !sameHostedPin(*opened.Definition.Resource, *pin) || closure != nil && *opened.Definition.View.Content.MCPApp.AssetClosure != *closure {
		return nil, identity.ErrResourceDenied
	}
	ctx = requestctx.WithResolvedResource(ctx, *pin)
	return requestctx.WithWindowTarget(ctx, target), nil
}
func hostedWindowMatches(w *types.Window, b HostedAppBinding) bool {
	return w != nil && w.Resource != nil && w.Resource.URI == b.WindowURI && w.Resource.ProviderIdentity == b.ProviderIdentity && w.View.Content != nil && w.View.Content.Kind == "mcpApp" && w.View.Content.MCPApp != nil && w.View.Content.MCPApp.ResourceURI == b.ResourceURI && w.View.Content.MCPApp.AssetClosure != nil
}
func sameHostedPin(a, b identity.ResolvedResource) bool {
	return a.URI == b.URI && a.ProviderIdentity == b.ProviderIdentity && a.ResourceCandidate == b.ResourceCandidate && a.AuthorityBinding == b.AuthorityBinding
}

var hostedInstanceID = regexp.MustCompile(`^[a-zA-Z0-9_-]{20,80}$`)

func hostedRendererMatches(b HostedAppBinding, opened primitive.MCPAppOpenResult) bool {
	parsed, err := url.Parse(opened.RendererURL)
	if err != nil || parsed.User != nil || parsed.RawPath != "" || parsed.RawQuery != "" || parsed.Fragment != "" || opened.Sandbox != b.Sandbox {
		return false
	}
	if b.RendererOrigin == "" {
		return false
	} // Mutable legacy URLs cannot authorize hosted windows.
	origin, err := url.Parse(b.RendererOrigin)
	if err != nil || parsed.Scheme != origin.Scheme || parsed.Host != origin.Host {
		return false
	}
	prefix := b.RendererPathPrefix + "/" + opened.AssetClosure.Fingerprint + "/"
	if !strings.HasPrefix(parsed.Path, prefix) || !strings.HasSuffix(parsed.Path, "/"+opened.AssetClosure.EntryPath) {
		return false
	}
	instance := strings.TrimSuffix(strings.TrimPrefix(parsed.Path, prefix), "/"+opened.AssetClosure.EntryPath)
	return hostedInstanceID.MatchString(instance)
}
func hostedSHA256(value string) bool {
	if len(value) != 64 || strings.ToLower(value) != value {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == 32
}
func (r *HostedAppReader) Read(ctx context.Context, uri string) (*schema.ReadResourceResult, error) {
	b, ok := r.bindings[uri]
	if !ok {
		return nil, identity.ErrResourceDenied
	}
	original, hasPin := requestctx.ResolvedResourceFromContext(ctx)
	target, hasTarget := requestctx.WindowTargetFromContext(ctx)
	if !hasPin || !hasTarget || original == nil || target.SelectionToken == "" || original.URI != b.WindowURI || original.ProviderIdentity != b.ProviderIdentity {
		return nil, identity.ErrResourceDenied
	}
	pin := *original
	actor, err := r.Actor(ctx)
	if err != nil {
		return nil, err
	}
	if !actor.Valid(r.Gateway.now()) || !identity.MetadataExpiryValid(pin.ValidUntil, r.Gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	ctx, cancel := context.WithDeadline(ctx, actor.ValidUntil)
	defer cancel()
	ctx, pinCancel := identity.WithMetadataExpiry(ctx, pin.ValidUntil)
	defer pinCancel()
	if err = r.Verify(ctx, actor); err != nil {
		return nil, err
	}
	opened, err := r.Windows.Get(ctx, &primitiveprovider.WindowDefinitionGetInput{WindowID: b.WindowURI, ResolvedResource: &pin, Target: target})
	if err != nil || opened == nil || !hostedWindowMatches(opened.Definition, b) || !sameHostedPin(*opened.Definition.Resource, pin) {
		return nil, identity.ErrResourceDenied
	}
	closure := *opened.Definition.View.Content.MCPApp.AssetClosure
	if closure.EntryPath != "index.html" || !hostedSHA256(closure.Fingerprint) || !hostedSHA256(closure.EntrySHA256) {
		return nil, identity.ErrResourceDenied
	}
	connection, err := r.Gateway.ConnectionForNamespace(ctx, b.ProviderIdentity, resourceNamespace(b.WindowURI))
	if err != nil {
		return nil, err
	}
	held, err := r.Gateway.resolveReadBinding(ctx, actor, connection.Name)
	if err != nil {
		return nil, err
	}
	// The fresh provider proof is for the explicit held candidate, never default/latest.
	current, err := Get[json.RawMessage](ctx, r.Gateway, connection, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin)
	if err != nil || current == nil || current.ExecutionProof == nil || current.ResolvedResource == nil || !current.ExecutionProof.Resource.ValidUntil.After(time.Now()) || !sameHostedPin(*current.ResolvedResource, pin) {
		return nil, identity.ErrResourceDenied
	}
	ctx, currentCancel := identity.WithMetadataExpiry(ctx, current.ResolvedResource.ValidUntil)
	defer currentCancel()
	// Definition metadata can be event-bound; the owning execution proof cannot.
	ctx, proofCancel := context.WithDeadline(ctx, current.ExecutionProof.Resource.ValidUntil)
	defer proofCancel()
	client := held.client
	if err = r.Gateway.checkReadBinding(ctx, actor, held); err != nil {
		return nil, err
	}
	if err = r.Verify(ctx, actor); err != nil {
		return nil, err
	}
	response, err := client.CallTool(r.Manager.WithAuthTokenContext(ctx, connection.Name), &schema.CallToolRequestParams{Name: "apps/open", Arguments: map[string]any{"resource": pin, "executionProof": current.ExecutionProof, "resourceURI": uri, "assetClosure": closure}})
	if err != nil || response == nil || response.IsError != nil && *response.IsError {
		return nil, identity.ErrResourceDenied
	}
	raw, err := json.Marshal(response.StructuredContent)
	if err != nil {
		return nil, identity.ErrResourceDenied
	}
	var app primitive.MCPAppOpenResult
	if json.Unmarshal(raw, &app) != nil || !sameHostedPin(app.Resource, pin) || app.ProviderIdentity != b.ProviderIdentity || app.ResourceURI != uri || app.AssetClosure != closure || !hostedRendererMatches(b, app) {
		return nil, identity.ErrResourceDenied
	}
	readURI, e := identity.ParseResourceURI(app.ReadResourceURI)
	if e != nil || readURI.Kind != "ui" || readURI.Namespace != b.ProviderIdentity || app.ReadResourceURI == uri {
		return nil, identity.ErrResourceDenied
	}
	if err = r.Gateway.checkReadBinding(ctx, actor, held); err != nil {
		return nil, err
	}
	ctx, appCancel := context.WithDeadline(ctx, app.Resource.ValidUntil)
	defer appCancel()
	if err = r.Verify(ctx, actor); err != nil {
		return nil, err
	}
	result, err := client.ReadResource(r.Manager.WithAuthTokenContext(ctx, connection.Name), &schema.ReadResourceRequestParams{Uri: app.ReadResourceURI})
	if err != nil || result == nil || result.ResultType != schema.ResultTypeComplete || len(result.Contents) != 1 {
		return nil, identity.ErrResourceDenied
	}
	content := result.Contents[0]
	if content.Uri != app.ReadResourceURI || content.MimeType == nil || *content.MimeType != "text/html;profile=mcp-app" || content.Text == "" || content.Blob != "" {
		return nil, identity.ErrResourceDenied
	}
	digest := sha256.Sum256([]byte(content.Text))
	if hex.EncodeToString(digest[:]) != closure.EntrySHA256 {
		return nil, identity.ErrResourceDenied
	}
	// Policy/provenance lives in ordinary typed tool DTOs, not MCP wire _meta.
	// Only host-validated standard UI presentation is released to the browser.
	mime := *content.MimeType
	detached := &schema.ReadResourceResult{CacheScope: schema.ReadResourceResultCacheScopePrivate, ResultType: schema.ResultTypeComplete, TtlMs: 0, Contents: []schema.ReadResourceResultContentsElem{{Uri: uri, MimeType: &mime, Text: content.Text, Meta: map[string]any{"ui": map[string]any{"rendererUrl": app.RendererURL, "sandbox": app.Sandbox}}}}}
	if _, err = r.bindContext(ctx, uri, &pin, target, &closure); err != nil {
		return nil, err
	}
	if err = r.Verify(ctx, actor); err != nil {
		return nil, err
	}
	freshActor, err := r.Actor(ctx)
	if err != nil || !freshActor.Valid(r.Gateway.now()) || freshActor.Subject != actor.Subject || freshActor.Issuer != actor.Issuer || freshActor.TenantID != actor.TenantID || freshActor.AccountID != actor.AccountID || freshActor.IdentityRevision != actor.IdentityRevision || freshActor.ValidUntil.Before(actor.ValidUntil) {
		return nil, identity.ErrResourceDenied
	}
	if err = r.Verify(ctx, freshActor); err != nil {
		return nil, err
	}
	if err = r.Gateway.checkReadBinding(ctx, actor, held); err != nil {
		return nil, err
	}
	if ctx.Err() != nil {
		return nil, identity.ErrResourceDenied
	}
	return detached, nil
}
func (r *HostedAppReader) Handles(uri string) bool { _, ok := r.bindings[uri]; return ok }
