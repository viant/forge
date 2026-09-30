package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
)

// WindowListInput selects a connected Forge UI client in the current MCP namespace.
type WindowListInput struct {
	ClientID string `json:"clientId,omitempty"`
}

type WindowSummary struct {
	WindowID    string `json:"windowId"`
	WindowKey   string `json:"windowKey,omitempty"`
	WindowTitle string `json:"windowTitle,omitempty"`
	InTab       bool   `json:"inTab"`
	IsModal     bool   `json:"isModal"`
	IsMinimized bool   `json:"isMinimized"`
	Selected    bool   `json:"selected"`
}

type WindowListOutput struct {
	ClientID  string          `json:"clientId"`
	Connected bool            `json:"connected"`
	Windows   []WindowSummary `json:"windows"`
}

type WindowGetInput struct {
	ClientID string `json:"clientId,omitempty"`
	WindowID string `json:"windowId"`
}

type WindowGetOutput struct {
	ClientID string          `json:"clientId"`
	Window   json.RawMessage `json:"window"`
}

type windowEnvelope struct {
	Selected struct {
		WindowID string `json:"windowId"`
	} `json:"selected"`
	Windows []json.RawMessage `json:"windows"`
}

type windowIdentity struct {
	WindowID    string `json:"windowId"`
	WindowKey   string `json:"windowKey"`
	WindowTitle string `json:"windowTitle"`
	InTab       bool   `json:"inTab"`
	IsModal     bool   `json:"isModal"`
	IsMinimized bool   `json:"isMinimized"`
}

func (s *Service) WindowList(ctx context.Context, in *WindowListInput) (*WindowListOutput, error) {
	clientID := ""
	if in != nil {
		clientID = in.ClientID
	}
	snapshot, err := s.UISnapshot(ctx, &UISnapshotInput{ClientID: clientID})
	if err != nil {
		return nil, err
	}
	connected := snapshot.Connected && containsClient(snapshot.Clients, snapshot.ClientID)
	result := &WindowListOutput{ClientID: snapshot.ClientID, Connected: connected, Windows: []WindowSummary{}}
	if !connected {
		return result, nil
	}
	envelope, err := decodeWindowEnvelope(snapshot.Snapshot)
	if err != nil {
		return nil, err
	}
	for _, raw := range envelope.Windows {
		identity, err := decodeWindowIdentity(raw)
		if err != nil {
			return nil, err
		}
		result.Windows = append(result.Windows, WindowSummary{WindowID: identity.WindowID, WindowKey: identity.WindowKey,
			WindowTitle: identity.WindowTitle, InTab: identity.InTab, IsModal: identity.IsModal,
			IsMinimized: identity.IsMinimized, Selected: envelope.Selected.WindowID == identity.WindowID})
	}
	return result, nil
}

func (s *Service) WindowGet(ctx context.Context, in *WindowGetInput) (*WindowGetOutput, error) {
	if in == nil || strings.TrimSpace(in.WindowID) == "" || in.WindowID != strings.TrimSpace(in.WindowID) {
		return nil, errors.New("windowId is required")
	}
	snapshot, err := s.UISnapshot(ctx, &UISnapshotInput{ClientID: in.ClientID})
	if err != nil {
		return nil, err
	}
	if !snapshot.Connected || !containsClient(snapshot.Clients, snapshot.ClientID) {
		return nil, errors.New("Forge UI client is not connected")
	}
	envelope, err := decodeWindowEnvelope(snapshot.Snapshot)
	if err != nil {
		return nil, err
	}
	for _, raw := range envelope.Windows {
		identity, err := decodeWindowIdentity(raw)
		if err != nil {
			return nil, err
		}
		if identity.WindowID == in.WindowID {
			return &WindowGetOutput{ClientID: snapshot.ClientID, Window: append(json.RawMessage(nil), raw...)}, nil
		}
	}
	return nil, errors.New("windowId is not present in the selected Forge UI client")
}

func containsClient(clients []string, clientID string) bool {
	for _, id := range clients {
		if id == clientID {
			return true
		}
	}
	return false
}

func decodeWindowEnvelope(raw json.RawMessage) (*windowEnvelope, error) {
	var envelope windowEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil || envelope.Windows == nil {
		return nil, errors.New("Forge UI snapshot has no window list")
	}
	seen := make(map[string]bool, len(envelope.Windows))
	for _, window := range envelope.Windows {
		identity, err := decodeWindowIdentity(window)
		if err != nil {
			return nil, err
		}
		if seen[identity.WindowID] {
			return nil, errors.New("Forge UI snapshot contains duplicate windowId")
		}
		seen[identity.WindowID] = true
	}
	return &envelope, nil
}

func decodeWindowIdentity(raw json.RawMessage) (windowIdentity, error) {
	var identity windowIdentity
	if err := json.Unmarshal(raw, &identity); err != nil || strings.TrimSpace(identity.WindowID) == "" {
		return windowIdentity{}, errors.New("Forge UI snapshot contains an invalid windowId")
	}
	return identity, nil
}
