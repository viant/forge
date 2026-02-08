package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

type Service struct {
	cfg *Config
	hub *Hub
	ns  *NamespaceService
}

func NewService(cfg *Config) *Service {
	if cfg == nil {
		cfg = &Config{}
	}
	return &Service{
		cfg: cfg,
		hub: NewHub(cfg),
		ns:  NewNamespaceService(),
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
	return &UISnapshotOutput{
		ClientID:  clientID,
		Snapshot:  snap,
		Connected: snap != nil,
		Clients:   clients,
	}, nil
}

type UICommandInput struct {
	ClientID  string      `json:"clientId,omitempty"`
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

func (s *Service) UICommand(ctx context.Context, in *UICommandInput) (*UICommandOutput, error) {
	if in == nil || in.Method == "" {
		return nil, errors.New("method is required")
	}
	timeout := 15 * time.Second
	if in.TimeoutMs > 0 {
		timeout = time.Duration(in.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ns, _ := s.ns.Namespace(ctx)
	resp, err := s.hub.Call(ctx, ns, in.ClientID, in.Method, in.Params)
	if err != nil {
		return nil, err
	}
	return &UICommandOutput{
		ClientID: in.ClientID,
		ID:       resp.ID,
		OK:       resp.OK,
		Error:    resp.Error,
		Result:   resp.Result,
	}, nil
}
