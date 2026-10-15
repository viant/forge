// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	runtimerequestctx "github.com/viant/forge/backend/requestctx"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"strings"
	"sync"
	"time"

	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type Service struct {
	cfg          *Config
	hub          *Hub
	ns           *NamespaceService
	resourceMu   sync.Mutex
	resourcePins map[windowPinKey]windowResourcePin
}

func NewService(cfg *Config) *Service {
	if cfg == nil {
		cfg = &Config{}
	}
	namespace := NewNamespaceService(cfg.NamespaceResolver)
	namespace.metadataScope = cfg.MetadataScope
	return &Service{
		cfg:          cfg,
		hub:          NewHub(cfg),
		ns:           namespace,
		resourcePins: map[windowPinKey]windowResourcePin{},
	}
}

func (s *Service) Hub() *Hub {
	return s.hub
}

func (s *Service) UseTextField() bool {
	return !s.cfg.UseData
}

type UISnapshotInput struct {
	ClientID string `json:"clientId,omitempty"`
}

type UISnapshotOutput struct {
	ClientID  string          `json:"clientId"`
	Snapshot  json.RawMessage `json:"snapshot,omitempty"`
	Connected bool            `json:"connected"`
	Clients   []string        `json:"clients,omitempty"`
}

func (s *Service) UISnapshot(ctx context.Context, in *UISnapshotInput) (*UISnapshotOutput, error) {
	ns, _ := s.ns.Namespace(ctx)
	clientID := ""
	if in != nil {
		clientID = in.ClientID
	}
	if clientID == "" {
		if id, ok := s.hub.DefaultClient(ns); ok {
			clientID = id
		}
	}
	clients := s.hub.ListClients(ns)
	if clientID == "" {
		return &UISnapshotOutput{ClientID: "", Connected: false, Clients: clients}, nil
	}
	snap := s.hub.Snapshot(ns, clientID)
	if s.canonicalWindowCatalog() && snap != nil {
		var err error
		snap, err = s.filterResourceSnapshot(ctx, ns, clientID, snap)
		if err != nil {
			return nil, err
		}
	}
	return &UISnapshotOutput{
		ClientID:  clientID,
		Snapshot:  snap,
		Connected: snap != nil,
		Clients:   clients,
	}, nil
}

type UICommandInput struct {
	ClientID  string      `json:"clientId,omitempty"`
	Namespace string      `json:"namespace,omitempty"`
	Method    string      `json:"method"`
	Params    interface{} `json:"params,omitempty"`
	TimeoutMs int         `json:"timeoutMs,omitempty"`
}

type UICommandOutput struct {
	ClientID string          `json:"clientId"`
	ID       string          `json:"id,omitempty"`
	OK       bool            `json:"ok"`
	Error    string          `json:"error,omitempty"`
	Result   json.RawMessage `json:"result,omitempty"`
}

func (s *Service) UICommand(ctx context.Context, in *UICommandInput) (output *UICommandOutput, resultErr error) {
	if in == nil || in.Method == "" {
		return nil, errors.New("method is required")
	}
	timeout := 15 * time.Second
	if in.TimeoutMs > 0 {
		timeout = time.Duration(in.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	ctx = WithoutMetadataReadScope(ctx, s.cfg.MetadataScope)
	baseCtx := runtimerequestctx.WithoutWindowReadDecision(ctx)
	pureOpen := s.canonicalWindowCatalog() && (in.Method == "ui.window.open" || in.Method == "ui.window.openDynamic")
	var preFinish func() error
	if pureOpen {
		var err error
		ctx, preFinish, err = s.BeginWindowReadDecision(baseCtx)
		if err != nil {
			return nil, err
		}
		defer func() {
			if preFinish != nil {
				if err := preFinish(); err != nil {
					output = nil
					resultErr = err
				}
			}
		}()
	} else {
		ctx = baseCtx
	}
	var openedPin *identity.ResolvedResource
	var openedTarget *types.WindowTarget
	var openedKey string
	var openedDefinition *types.Window
	var openedParameters map[string]any
	var openedLease time.Time
	if (in.Method == "ui.window.open" || in.Method == "ui.window.openDynamic" && s.canonicalWindowCatalog()) && s.cfg.WindowDefinitions != nil {
		windowKey, err := commandWindowKey(in.Params)
		if err != nil {
			return nil, errors.New("window definition is not available")
		}
		if catalog, ok := s.cfg.WindowDefinitions.(interface{ UsesResourceResolution() bool }); ok && catalog.UsesResourceResolution() {
			// Replace caller metadata with the exact admitted definition. The
			// browser's normal saved-window loader must not choose newer content.
			raw, err := json.Marshal(in.Params)
			if err != nil {
				return nil, errors.New("window definition is not available")
			}
			var params map[string]any
			if decodeSelectionJSON(raw, &params) != nil {
				return nil, errors.New("window definition is not available")
			}
			var request struct {
				Target           *types.WindowTarget        `json:"target"`
				Resource         *identity.ResourceRef      `json:"resource"`
				ResolvedResource *identity.ResolvedResource `json:"resolvedResource"`
			}
			if json.Unmarshal(raw, &request) != nil {
				return nil, errors.New("window definition is not available")
			}
			resolved, err := s.windowDefinitionForOpen(ctx, &WindowDefinitionGetInput{WindowID: windowKey, Resource: request.Resource, ResolvedResource: request.ResolvedResource, Target: request.Target})
			if err != nil || resolved == nil || resolved.Definition == nil || resolved.Definition.Resource == nil {
				return nil, windowDefinitionFailure(err, "window definition is not available")
			}
			parameters, _ := params["parameters"].(map[string]any)
			approved := resolved.Definition
			admitted, err := s.ProjectWindowWithInput(ctx, &windowprotocol.PresentationInput{Window: approved, WindowForm: parameters, ResourceData: parameters})
			if err != nil || admitted == nil {
				if err == nil {
					err = identity.ErrResourceDenied
				}
				return nil, windowVerificationFailure(err, "window admission is not available")
			}
			openedDefinition, openedParameters, openedLease = admitted, parameters, approved.Resource.ValidUntil
			resolved.Definition = admitted
			options, _ := params["options"].(map[string]any)
			if options == nil {
				options = map[string]any{}
			}
			options["inlineMetadata"] = resolved.Definition
			options["resource"] = resolved.Definition.Resource
			params["options"] = options
			params["resource"] = resolved.Definition.Resource
			params["target"] = resolved.Definition.ResourceTarget
			options["target"] = resolved.Definition.ResourceTarget
			if in.Method == "ui.window.openDynamic" {
				params["metadata"] = resolved.Definition
			}
			openedPin = resolved.Definition.Resource
			openedTarget = resolved.Definition.ResourceTarget
			openedKey = resolved.WindowID
			params["windowKey"] = resolved.WindowID
			inCopy := *in
			inCopy.Params = params
			in = &inCopy
		} else if authorizer, ok := s.cfg.WindowDefinitions.(interface {
			Authorize(context.Context, string) error
		}); ok {
			if err := authorizer.Authorize(ctx, windowKey); err != nil {
				return nil, err
			}
		} else if _, err := s.windowDefinitionForOpen(ctx, &WindowDefinitionGetInput{WindowID: windowKey}); err != nil {
			return nil, errors.New("window definition is not available")
		}
	}
	if in.Method == "ui.window.openDynamic" && (s.cfg.DynamicWindowAuthorizer != nil || s.AuthzReady() || catalogRequiresAuthz(s.cfg.WindowDefinitions)) {
		windowKey, err := commandWindowKey(in.Params)
		if err != nil || s.cfg.DynamicWindowAuthorizer == nil {
			return nil, errors.New("dynamic window is not available")
		}
		allowed, err := s.cfg.DynamicWindowAuthorizer(ctx, windowKey)
		if err != nil || ctx.Err() != nil {
			return nil, errors.New("dynamic window admission authority unavailable")
		}
		if !allowed {
			return nil, errors.New("dynamic window is not available")
		}
	}

	ns := strings.TrimSpace(in.Namespace)
	if s.canonicalWindowCatalog() || s.ns.Resolver != nil {
		trustedIdentity, err := s.ns.Identity(ctx)
		trustedNS := trustedIdentity.Namespace
		if err != nil || ns != "" && ns != trustedNS {
			return nil, errors.New("UI namespace is unavailable")
		}
		ns = trustedNS
		if !trustedIdentity.ValidUntil.IsZero() {
			var stop context.CancelFunc
			ctx, stop = context.WithDeadline(ctx, trustedIdentity.ValidUntil)
			defer stop()
		}
	}
	if ns == "" {
		ns, _ = s.ns.Namespace(ctx)
	}
	clientID := in.ClientID
	if clientID == "" {
		clientID, _ = s.hub.DefaultClient(ns)
	}
	var commandPin *windowResourcePin
	conversationFeed := s.canonicalWindowCatalog() && isConversationFeedCommand(in.Method)
	if conversationFeed {
		if err := s.authorizeConversationFeedCommand(ctx, ns, clientID, in.Params); err != nil {
			return nil, err
		}
	}
	if s.canonicalWindowCatalog() && openedPin == nil && !conversationFeed {
		var err error
		commandPin, err = s.authorizePinnedCommand(ctx, ns, clientID, in.Method, in.Params)
		if err != nil {
			return nil, err
		}
	}
	if preFinish != nil {
		finish := preFinish
		preFinish = nil
		if err := finish(); err != nil {
			return nil, err
		}
		ctx = baseCtx
		if openedPin != nil {
			terminalCtx, stop := identity.WithMetadataExpiry(ctx, identity.MinimumMetadataExpiry(openedLease, openedPin.ValidUntil))
			err := s.checkWindowContentCurrent(terminalCtx, windowResourcePin{WindowKey: openedKey, Resource: *openedPin, Target: openedTarget})
			stop()
			if err != nil {
				return nil, err
			}
		}
	}
	// Receiver verification must not allow an original resource/action lease
	// to expire while the command waits to be written or queued.
	callCtx := ctx
	lease := openedLease
	if openedPin != nil && (lease.IsZero() || openedPin.ValidUntil.Before(lease)) {
		lease = openedPin.ValidUntil
	}
	if commandPin != nil && (lease.IsZero() || commandPin.Resource.ValidUntil.Before(lease)) {
		lease = commandPin.Resource.ValidUntil
	}
	if !lease.IsZero() {
		var stop context.CancelFunc
		callCtx, stop = context.WithDeadline(ctx, lease)
		defer stop()
	}
	if openedPin != nil && s.cfg.WindowSelectionEmitter != nil {
		// Signing occurs only after final successful PRE admission and source checks,
		// immediately before metadata send. POST receiver checks remain independent.
		if callCtx.Err() != nil {
			return nil, sanitizedSelectionError(callCtx.Err())
		}
		admitted := openedDefinition
		if err := s.checkWindowContentCurrent(callCtx, windowResourcePin{WindowKey: openedKey, Resource: *openedPin, Target: openedTarget}); err != nil {
			return nil, err
		}
		emitted, err := s.EmitWindowSelection(callCtx, admitted, openedParameters)
		if err != nil {
			return nil, err
		}
		params := in.Params.(map[string]any)
		options := params["options"].(map[string]any)
		options["inlineMetadata"] = emitted
		if in.Method == "ui.window.openDynamic" {
			params["metadata"] = emitted
		}
	}
	resp, err := s.hub.Call(callCtx, ns, in.ClientID, in.Method, in.Params)
	if err != nil {
		return nil, err
	}
	if pureOpen {
		var finish func() error
		ctx, finish, err = s.BeginWindowReadDecision(baseCtx)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := finish(); err != nil {
				output = nil
				resultErr = err
				return
			}
			if openedPin != nil {
				terminalCtx, stop := identity.WithMetadataExpiry(baseCtx, openedPin.ValidUntil)
				defer stop()
				if !openedLease.IsZero() {
					var stopLease context.CancelFunc
					terminalCtx, stopLease = context.WithDeadline(terminalCtx, openedLease)
					defer stopLease()
				}
				if err := s.checkWindowContentCurrent(terminalCtx, windowResourcePin{WindowKey: openedKey, Resource: *openedPin, Target: openedTarget}); err != nil {
					output = nil
					resultErr = err
				}
			}
		}()
	}
	if openedPin != nil {
		if !openedLease.IsZero() && !openedLease.After(time.Now()) {
			return nil, identity.ErrResourceDenied
		}
		if _, err := s.revalidateWindowPin(ctx, windowResourcePin{WindowKey: openedKey, Resource: *openedPin, Target: openedTarget}); err != nil {
			return nil, windowVerificationFailure(err, "window access changed")
		}
		if resp.OK {
			var result struct {
				WindowID string `json:"windowId"`
			}
			if json.Unmarshal(resp.Result, &result) != nil || result.WindowID == "" {
				return nil, errors.New("UI window identity is unavailable")
			}
			if err := s.rememberWindowPin(ctx, windowPinKey{Namespace: ns, ClientID: clientID, WindowID: result.WindowID}, windowResourcePin{WindowKey: openedKey, Resource: *openedPin, Target: openedTarget}); err != nil {
				return nil, err
			}
		}
	}
	if conversationFeed {
		if err := s.authorizeConversationFeedCommand(ctx, ns, clientID, in.Params); err != nil {
			return nil, err
		}
	}
	if commandPin != nil {
		current, err := s.authorizePinnedCommand(ctx, ns, clientID, in.Method, in.Params)
		if err != nil || current.Resource.ResourceCandidate != commandPin.Resource.ResourceCandidate || current.Resource.AuthorityBinding != commandPin.Resource.AuthorityBinding {
			return nil, errors.New("window resource is unavailable")
		}
	}
	return &UICommandOutput{
		ClientID: in.ClientID,
		ID:       resp.ID,
		OK:       resp.OK,
		Error:    resp.Error,
		Result:   resp.Result,
	}, nil
}

func catalogRequiresAuthz(catalog WindowDefinitionCatalog) bool {
	ready, ok := catalog.(interface{ AuthzReady() bool })
	return ok && ready.AuthzReady()
}

func commandWindowKey(params interface{}) (string, error) {
	raw, err := json.Marshal(params)
	if err != nil {
		return "", err
	}
	var value struct {
		WindowKey string `json:"windowKey"`
	}
	if json.Unmarshal(raw, &value) != nil || value.WindowKey == "" || strings.TrimSpace(value.WindowKey) != value.WindowKey {
		return "", errors.New("window key is required")
	}
	return value.WindowKey, nil
}
