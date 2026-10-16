// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"strings"
	"time"
)

func isConversationFeedCommand(method string) bool {
	return method == "ui.feed.get" || method == "ui.feed.update"
}

// Feed commands address current conversation presentation state, not a window
// definition. Exact owner/client attachment is required independently of pins.
func (s *Service) authorizeConversationFeedCommand(ctx context.Context, namespace, clientID string, params any) error {
	if ctx == nil || ctx.Err() != nil || s.ns.Resolver == nil || clientID == "" {
		return identity.ErrResourceDenied
	}
	current, err := s.ns.Identity(ctx)
	if err != nil || current.Namespace != namespace || (!current.ValidUntil.IsZero() && !current.ValidUntil.After(time.Now())) {
		return identity.ErrResourceDenied
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return identity.ErrResourceDenied
	}
	var input struct {
		ConversationID string `json:"conversationId"`
		FeedID         string `json:"feedId"`
		WindowID       string `json:"windowId"`
	}
	if json.Unmarshal(raw, &input) != nil || input.WindowID != "" || input.FeedID == "" || strings.TrimSpace(input.FeedID) != input.FeedID {
		return identity.ErrResourceDenied
	}
	conversation := requestctx.ConversationIDFromContext(ctx)
	if conversation == "" || input.ConversationID != conversation {
		return identity.ErrResourceDenied
	}
	return s.authorizeConversationClient(ctx, namespace, clientID, conversation)
}

// authorizeConversationClient retains the existing current conversation attachment check.
func (s *Service) authorizeConversationClient(ctx context.Context, namespace, clientID, conversation string) error {
	now := time.Now()
	for _, entry := range s.hub.SnapshotEntries() {
		if entry.Namespace != namespace || entry.ClientID != clientID {
			continue
		}
		attached := !entry.UpdatedAt.IsZero() && now.Sub(entry.UpdatedAt) <= 15*time.Second || entry.Transport == "ws" || !entry.LastPollAt.IsZero() && now.Sub(entry.LastPollAt) <= 30*time.Second
		if !attached {
			return identity.ErrResourceDenied
		}
		var snapshot struct {
			ConversationID string `json:"conversationId"`
			Windows        []struct {
				ConversationID string `json:"conversationId"`
			} `json:"windows"`
		}
		if json.Unmarshal(entry.Snapshot, &snapshot) != nil {
			return identity.ErrResourceDenied
		}
		if snapshot.ConversationID == conversation {
			return nil
		}
		for _, window := range snapshot.Windows {
			if window.ConversationID == conversation {
				return nil
			}
		}
		return identity.ErrResourceDenied
	}
	return identity.ErrResourceDenied
}
