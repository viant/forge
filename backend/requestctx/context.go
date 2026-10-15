// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	"strings"
	"sync"

	"github.com/google/uuid"
)

type conversationIDKey string

var ConversationIDKey = conversationIDKey("conversationID")

func ConversationIDFromContext(ctx context.Context) string {
	value := ctx.Value(ConversationIDKey)
	if value == nil {
		return ""
	}
	if id, ok := value.(string); ok {
		return id
	}
	return ""
}

func WithConversationID(ctx context.Context, conversationID string) context.Context {
	if conversationID == "" {
		conversationID = uuid.New().String()
	}
	prev := ctx.Value(ConversationIDKey)
	if prev != nil && prev == conversationID {
		return ctx
	}
	return context.WithValue(ctx, ConversationIDKey, conversationID)
}

// WithoutConversationTracking removes conversation / turn-local tracking keys
// from context for internal sidecar model calls that must not participate in
// transcript persistence, SSE ownership, or continuation anchoring.
func WithoutConversationTracking(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx = context.WithValue(ctx, ConversationIDKey, "")
	ctx = context.WithValue(ctx, ModelMessageIDKey, "")
	ctx = context.WithValue(ctx, ToolMessageIDKey, "")
	ctx = context.WithValue(ctx, turnMetaKey, TurnMeta{})
	ctx = context.WithValue(ctx, modelCompletionMetaKey, ModelCompletionMeta{})
	return ctx
}

type modelMessageIDKey string

var ModelMessageIDKey = modelMessageIDKey("modelMessageID")

func WithModelMessageID(ctx context.Context, messageID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if messageID == "" {
		return ctx
	}
	return context.WithValue(ctx, ModelMessageIDKey, messageID)
}

func ModelMessageIDFromContext(ctx context.Context) string {
	value := ctx.Value(ModelMessageIDKey)
	if value == nil {
		return ""
	}
	if id, ok := value.(string); ok {
		return id
	}
	return ""
}

type toolMessageIDKey string

var ToolMessageIDKey = toolMessageIDKey("toolMessageID")

func WithToolMessageID(ctx context.Context, messageID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if messageID == "" {
		return ctx
	}
	return context.WithValue(ctx, ToolMessageIDKey, messageID)
}

func ToolMessageIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	value := ctx.Value(ToolMessageIDKey)
	if value == nil {
		return ""
	}
	if id, ok := value.(string); ok {
		return id
	}
	return ""
}

// TurnMeta captures minimal per-turn context for downstream persistence.
type TurnMeta struct {
	TurnID          string
	Assistant       string
	ConversationID  string
	ParentMessageID string
}

type turnMetaKeyT string

var turnMetaKey = turnMetaKeyT("turnMeta")

var turnTrace sync.Map
var turnModelMsgID sync.Map

func SetTurnTrace(turnID, traceID string) {
	if turnID == "" || traceID == "" {
		return
	}
	turnTrace.Store(turnID, traceID)
}

func TurnTrace(turnID string) string {
	if turnID == "" {
		return ""
	}
	if v, ok := turnTrace.Load(turnID); ok {
		if s, ok2 := v.(string); ok2 {
			return s
		}
	}
	return ""
}

func SetTurnModelMessageID(turnID, msgID string) {
	if turnID == "" || msgID == "" {
		return
	}
	turnModelMsgID.Store(turnID, msgID)
}

func TurnModelMessageID(turnID string) string {
	if turnID == "" {
		return ""
	}
	if v, ok := turnModelMsgID.Load(turnID); ok {
		if s, ok2 := v.(string); ok2 {
			return s
		}
	}
	return ""
}

func CleanupTurn(turnID string) {
	if turnID == "" {
		return
	}
	turnTrace.Delete(turnID)
	turnModelMsgID.Delete(turnID)
}

func WithTurnMeta(ctx context.Context, meta TurnMeta) context.Context {
	if meta.ConversationID != "" {
		ctx = context.WithValue(ctx, ConversationIDKey, meta.ConversationID)
	}
	return context.WithValue(ctx, turnMetaKey, meta)
}

func TurnMetaFromContext(ctx context.Context) (TurnMeta, bool) {
	if ctx == nil {
		return TurnMeta{}, false
	}
	if v := ctx.Value(turnMetaKey); v != nil {
		if m, ok := v.(TurnMeta); ok {
			return m, true
		}
	}
	return TurnMeta{}, false
}

type ModelCompletionMeta struct {
	Content       string
	Narration     string
	FinalResponse bool
	FinishReason  string
}

type modelCompletionMetaKeyT string

var modelCompletionMetaKey = modelCompletionMetaKeyT("modelCompletionMeta")

func WithModelCompletionMeta(ctx context.Context, meta ModelCompletionMeta) context.Context {
	return context.WithValue(ctx, modelCompletionMetaKey, meta)
}

func ModelCompletionMetaFromContext(ctx context.Context) (ModelCompletionMeta, bool) {
	if ctx == nil {
		return ModelCompletionMeta{}, false
	}
	if v := ctx.Value(modelCompletionMetaKey); v != nil {
		if m, ok := v.(ModelCompletionMeta); ok {
			return m, true
		}
	}
	return ModelCompletionMeta{}, false
}

type requestModeKeyT string

var requestModeKey = requestModeKeyT("requestMode")

type userAskKeyT string

var userAskKey = userAskKeyT("userAsk")

type messageAddEventKeyT string

var messageAddEventKey = messageAddEventKeyT("messageAddEvent")

type promptProfileAllowListKeyT string

var promptProfileAllowListKey = promptProfileAllowListKeyT("promptProfileAllowList")

type preferredUIClientIDKeyT string

var preferredUIClientIDKey = preferredUIClientIDKeyT("preferredUIClientID")

func WithRequestMode(ctx context.Context, mode string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	mode = strings.TrimSpace(mode)
	if mode == "" {
		return ctx
	}
	return context.WithValue(ctx, requestModeKey, mode)
}

func WithPreferredUIClientID(ctx context.Context, clientID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	clientID = strings.TrimSpace(clientID)
	if clientID == "" {
		return ctx
	}
	return context.WithValue(ctx, preferredUIClientIDKey, clientID)
}

func PreferredUIClientIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	value := ctx.Value(preferredUIClientIDKey)
	if value == nil {
		return ""
	}
	if id, ok := value.(string); ok {
		return strings.TrimSpace(id)
	}
	return ""
}

func RequestModeFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	value := ctx.Value(requestModeKey)
	if value == nil {
		return ""
	}
	if mode, ok := value.(string); ok {
		return mode
	}
	return ""
}

func CloneUserAsk(dst, src context.Context) context.Context {
	if ask := UserAskFromContext(src); ask != "" {
		return WithUserAsk(dst, ask)
	}
	return dst
}

func WithUserAsk(ctx context.Context, ask string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	ask = strings.TrimSpace(ask)
	if ask == "" {
		return ctx
	}
	return context.WithValue(ctx, userAskKey, ask)
}

func UserAskFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	value := ctx.Value(userAskKey)
	if value == nil {
		return ""
	}
	if ask, ok := value.(string); ok {
		return strings.TrimSpace(ask)
	}
	return ""
}

func WithPromptProfileAllowList(ctx context.Context, ids []string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if len(ids) == 0 {
		return ctx
	}
	cloned := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		cloned = append(cloned, id)
	}
	if len(cloned) == 0 {
		return ctx
	}
	return context.WithValue(ctx, promptProfileAllowListKey, cloned)
}

func PromptProfileAllowListFromContext(ctx context.Context) []string {
	if ctx == nil {
		return nil
	}
	value := ctx.Value(promptProfileAllowListKey)
	if value == nil {
		return nil
	}
	list, ok := value.([]string)
	if !ok || len(list) == 0 {
		return nil
	}
	cloned := make([]string, len(list))
	copy(cloned, list)
	return cloned
}

func WithMessageAddEvent(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, messageAddEventKey, true)
}

func MessageAddEventFromContext(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	value := ctx.Value(messageAddEventKey)
	flag, ok := value.(bool)
	return ok && flag
}

// RunMeta captures the active persisted run identity and loop iteration.
type RunMeta struct {
	RunID     string
	Iteration int
}

type runMetaKeyT string

var runMetaKey = runMetaKeyT("runMeta")

type toolResultPreviewLimitKeyT string

var toolResultPreviewLimitKey = toolResultPreviewLimitKeyT("toolResultPreviewLimit")

func WithRunMeta(ctx context.Context, meta RunMeta) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, runMetaKey, meta)
}

func RunMetaFromContext(ctx context.Context) (RunMeta, bool) {
	if ctx == nil {
		return RunMeta{}, false
	}
	if v := ctx.Value(runMetaKey); v != nil {
		if meta, ok := v.(RunMeta); ok {
			return meta, true
		}
	}
	return RunMeta{}, false
}

func WithToolResultPreviewLimit(ctx context.Context, limit int) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if limit <= 0 {
		return ctx
	}
	return context.WithValue(ctx, toolResultPreviewLimitKey, limit)
}

func ToolResultPreviewLimitFromContext(ctx context.Context) int {
	if ctx == nil {
		return 0
	}
	value := ctx.Value(toolResultPreviewLimitKey)
	if value == nil {
		return 0
	}
	if limit, ok := value.(int); ok && limit > 0 {
		return limit
	}
	return 0
}
