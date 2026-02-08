package mcp

import (
	"context"
	_ "embed"
	"encoding/json"

	"github.com/viant/forge/backend/mcp/service"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	protoserver "github.com/viant/mcp-protocol/server"
)

//go:embed tools/forgeUISnapshot.md
var descSnapshot string

//go:embed tools/forgeUICommand.md
var descCommand string

//go:embed tools/forgeUIWait.md
var descWait string

//go:embed tools/forgeWindowOpen.md
var descWindowOpen string

//go:embed tools/forgeWindowClose.md
var descWindowClose string

//go:embed tools/forgeWindowActivate.md
var descWindowActivate string

//go:embed tools/forgeFocusSet.md
var descFocusSet string

//go:embed tools/forgeControlSetValue.md
var descControlSetValue string

//go:embed tools/forgeFilterSet.md
var descFilterSet string

//go:embed tools/forgeDataFetch.md
var descDataFetch string

//go:embed tools/forgeTableSelectRow.md
var descTableSelectRow string

//go:embed tools/forgeTableSelectByKey.md
var descTableSelectByKey string

//go:embed tools/forgeFileBrowserOpenFolder.md
var descFileBrowserOpenFolder string

//go:embed tools/forgeFileBrowserSelectUri.md
var descFileBrowserSelectUri string

//go:embed tools/forgeDialogOpen.md
var descDialogOpen string

//go:embed tools/forgeDialogClose.md
var descDialogClose string

//go:embed tools/forgeDialogCommit.md
var descDialogCommit string

//go:embed tools/forgeKeyPress.md
var descKeyPress string

//go:embed tools/forgeKeySequence.md
var descKeySequence string

//go:embed tools/forgeWindowOpenDynamic.md
var descWindowOpenDynamic string

//go:embed tools/forgeControlsList.md
var descControlsList string

//go:embed tools/forgeControlsSearch.md
var descControlsSearch string

//go:embed tools/forgeFocusGet.md
var descFocusGet string

func registerTools(base *protoserver.DefaultHandler, h *Handler) error {
	svc := h.service
	if err := registerTool[service.UISnapshotInput, service.UISnapshotOutput](base.Registry, "forgeUISnapshot", descSnapshot, svc, svc.UISnapshot); err != nil {
		return err
	}
	if err := registerTool[service.UICommandInput, service.UICommandOutput](base.Registry, "forgeUICommand", descCommand, svc, svc.UICommand); err != nil {
		return err
	}
	if err := registerTool[service.UIWaitInput, service.UIWaitOutput](base.Registry, "forgeUIWait", descWait, svc, svc.UIWait); err != nil {
		return err
	}

	// Typed convenience tools (thin wrappers)
	if err := registerTool[ForgeWindowOpenInput, ForgeWindowOpenOutput](base.Registry, "forgeWindowOpen", descWindowOpen, svc, func(ctx context.Context, in *ForgeWindowOpenInput) (*ForgeWindowOpenOutput, error) {
		out := &ForgeWindowOpenOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.window.open", map[string]any{
			"windowKey":   in.WindowKey,
			"windowTitle": in.WindowTitle,
			"title":       in.WindowTitle,
			"windowData":  in.WindowData,
			"inTab":       in.InTab,
			"parentKey":   in.ParentKey,
			"parameters":  in.Parameters,
			"options":     in.Options,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeWindowOpenDynamicInput, ForgeWindowOpenDynamicOutput](base.Registry, "forgeWindowOpenDynamic", descWindowOpenDynamic, svc, func(ctx context.Context, in *ForgeWindowOpenDynamicInput) (*ForgeWindowOpenDynamicOutput, error) {
		out := &ForgeWindowOpenDynamicOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.window.openDynamic", map[string]any{
			"windowKey":   in.WindowKey,
			"windowTitle": in.WindowTitle,
			"title":       in.WindowTitle,
			"windowData":  in.WindowData,
			"inTab":       in.InTab,
			"parentKey":   in.ParentKey,
			"parameters":  in.Parameters,
			"metadata":    in.Metadata,
			"options":     in.Options,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeWindowCloseInput, ForgeOKOutput](base.Registry, "forgeWindowClose", descWindowClose, svc, func(ctx context.Context, in *ForgeWindowCloseInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.window.close", map[string]any{
			"windowId": in.WindowID,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeWindowActivateInput, ForgeOKOutput](base.Registry, "forgeWindowActivate", descWindowActivate, svc, func(ctx context.Context, in *ForgeWindowActivateInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.window.activate", map[string]any{
			"windowId": in.WindowID,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeFocusSetInput, ForgeOKOutput](base.Registry, "forgeFocusSet", descFocusSet, svc, func(ctx context.Context, in *ForgeFocusSetInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.focus.set", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"controlId":     in.ControlID,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeControlSetValueInput, ForgeOKOutput](base.Registry, "forgeControlSetValue", descControlSetValue, svc, func(ctx context.Context, in *ForgeControlSetValueInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.control.setValue", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"controlId":     in.ControlID,
			"bindingPath":   in.BindingPath,
			"dataField":     in.DataField,
			"scope":         in.Scope,
			"value":         in.Value,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeFilterSetInput, ForgeOKOutput](base.Registry, "forgeFilterSet", descFilterSet, svc, func(ctx context.Context, in *ForgeFilterSetInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.filter.set", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"patch":         in.Patch,
			"fetch":         in.Fetch,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeDataFetchInput, ForgeOKOutput](base.Registry, "forgeDataFetch", descDataFetch, svc, func(ctx context.Context, in *ForgeDataFetchInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.data.fetch", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeTableSelectRowInput, ForgeOKOutput](base.Registry, "forgeTableSelectRow", descTableSelectRow, svc, func(ctx context.Context, in *ForgeTableSelectRowInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.table.selectRow", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"rowIndex":      in.RowIndex,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeTableSelectByKeyInput, ForgeOKOutput](base.Registry, "forgeTableSelectByKey", descTableSelectByKey, svc, func(ctx context.Context, in *ForgeTableSelectByKeyInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.table.selectByKey", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"key":           in.Key,
			"uniqueKey":     in.UniqueKey,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeFileBrowserOpenFolderInput, ForgeOKOutput](base.Registry, "forgeFileBrowserOpenFolder", descFileBrowserOpenFolder, svc, func(ctx context.Context, in *ForgeFileBrowserOpenFolderInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.fileBrowser.openFolder", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"uri":           in.URI,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeFileBrowserSelectURIInput, ForgeFileBrowserSelectURIOutput](base.Registry, "forgeFileBrowserSelectUri", descFileBrowserSelectUri, svc, func(ctx context.Context, in *ForgeFileBrowserSelectURIInput) (*ForgeFileBrowserSelectURIOutput, error) {
		out := &ForgeFileBrowserSelectURIOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.fileBrowser.selectUri", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"uri":           in.URI,
			"openParents":   in.OpenParents,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeDialogOpenInput, ForgeDialogOpenOutput](base.Registry, "forgeDialogOpen", descDialogOpen, svc, func(ctx context.Context, in *ForgeDialogOpenInput) (*ForgeDialogOpenOutput, error) {
		out := &ForgeDialogOpenOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.dialog.open", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"dialogId":      in.DialogID,
			"args":          in.Args,
			"options":       in.Options,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeDialogCloseInput, ForgeOKOutput](base.Registry, "forgeDialogClose", descDialogClose, svc, func(ctx context.Context, in *ForgeDialogCloseInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.dialog.close", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"dialogId":      in.DialogID,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeDialogCommitInput, ForgeOKOutput](base.Registry, "forgeDialogCommit", descDialogCommit, svc, func(ctx context.Context, in *ForgeDialogCommitInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.dialog.commit", map[string]any{
			"windowId": in.WindowID,
			"dialogId": in.DialogID,
			"payload":  in.Payload,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeKeyPressInput, ForgeOKOutput](base.Registry, "forgeKeyPress", descKeyPress, svc, func(ctx context.Context, in *ForgeKeyPressInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.key.press", map[string]any{
			"key":      in.Key,
			"ctrlKey":  in.CtrlKey,
			"shiftKey": in.ShiftKey,
			"altKey":   in.AltKey,
			"metaKey":  in.MetaKey,
			"type":     in.Type,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeKeySequenceInput, ForgeOKOutput](base.Registry, "forgeKeySequence", descKeySequence, svc, func(ctx context.Context, in *ForgeKeySequenceInput) (*ForgeOKOutput, error) {
		out := &ForgeOKOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.key.sequence", map[string]any{
			"keys": in.Keys,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeControlsListInput, ForgeControlsListOutput](base.Registry, "forgeControlsList", descControlsList, svc, func(ctx context.Context, in *ForgeControlsListInput) (*ForgeControlsListOutput, error) {
		out := &ForgeControlsListOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.controls.list", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeControlsSearchInput, ForgeControlsListOutput](base.Registry, "forgeControlsSearch", descControlsSearch, svc, func(ctx context.Context, in *ForgeControlsSearchInput) (*ForgeControlsListOutput, error) {
		out := &ForgeControlsListOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.controls.search", map[string]any{
			"windowId":      in.WindowID,
			"dataSourceRef": in.DataSourceRef,
			"query":         in.Query,
			"limit":         in.Limit,
		}, out)
	}); err != nil {
		return err
	}

	if err := registerTool[ForgeFocusGetInput, ForgeFocusGetOutput](base.Registry, "forgeFocusGet", descFocusGet, svc, func(ctx context.Context, in *ForgeFocusGetInput) (*ForgeFocusGetOutput, error) {
		out := &ForgeFocusGetOutput{}
		return out, callAndDecode(ctx, svc, in.ClientID, in.TimeoutMs, "ui.focus.get", map[string]any{}, out)
	}); err != nil {
		return err
	}

	return nil
}

func registerTool[I any, O any](
	registry *protoserver.Registry,
	name string,
	description string,
	svc *service.Service,
	fn func(context.Context, *I) (*O, error),
) error {
	return protoserver.RegisterTool[*I, *O](registry, name, description, func(ctx context.Context, in *I) (*schema.CallToolResult, *jsonrpc.Error) {
		out, err := fn(ctx, in)
		if err != nil {
			return nil, jsonrpc.NewError(jsonrpc.InvalidParams, err.Error(), nil)
		}
		if svc.UseTextField() {
			b, _ := json.Marshal(out)
			return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{{Type: "text", Text: string(b)}}}, nil
		}
		return &schema.CallToolResult{StructuredContent: map[string]any{"result": out}}, nil
	})
}

// Typed tool input/output models
type ForgeOKOutput struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

type ForgeWindowOpenInput struct {
	ClientID    string         `json:"clientId,omitempty"`
	TimeoutMs   int            `json:"timeoutMs,omitempty"`
	WindowKey   string         `json:"windowKey"`
	WindowTitle string         `json:"windowTitle,omitempty"`
	WindowData  string         `json:"windowData,omitempty"`
	InTab       *bool          `json:"inTab,omitempty"`
	ParentKey   string         `json:"parentKey,omitempty"`
	Parameters  map[string]any `json:"parameters,omitempty"`
	Options     map[string]any `json:"options,omitempty"`
}

type ForgeWindowOpenOutput struct {
	WindowID string `json:"windowId,omitempty"`
}

type ForgeWindowOpenDynamicInput struct {
	ClientID    string         `json:"clientId,omitempty"`
	TimeoutMs   int            `json:"timeoutMs,omitempty"`
	WindowKey   string         `json:"windowKey,omitempty"`
	WindowTitle string         `json:"windowTitle,omitempty"`
	WindowData  string         `json:"windowData,omitempty"`
	InTab       *bool          `json:"inTab,omitempty"`
	ParentKey   string         `json:"parentKey,omitempty"`
	Parameters  map[string]any `json:"parameters,omitempty"`
	Options     map[string]any `json:"options,omitempty"`
	Metadata    map[string]any `json:"metadata"`
}

type ForgeWindowOpenDynamicOutput struct {
	WindowID  string `json:"windowId,omitempty"`
	WindowKey string `json:"windowKey,omitempty"`
}

type ForgeWindowCloseInput struct {
	ClientID  string `json:"clientId,omitempty"`
	TimeoutMs int    `json:"timeoutMs,omitempty"`
	WindowID  string `json:"windowId"`
}

type ForgeWindowActivateInput struct {
	ClientID  string `json:"clientId,omitempty"`
	TimeoutMs int    `json:"timeoutMs,omitempty"`
	WindowID  string `json:"windowId"`
}

type ForgeFocusSetInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	ControlID     string `json:"controlId"`
}

type ForgeControlSetValueInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	ControlID     string `json:"controlId"`
	BindingPath   string `json:"bindingPath,omitempty"`
	DataField     string `json:"dataField,omitempty"`
	Scope         string `json:"scope,omitempty"`
	Value         any    `json:"value"`
}

type ForgeFilterSetInput struct {
	ClientID      string         `json:"clientId,omitempty"`
	TimeoutMs     int            `json:"timeoutMs,omitempty"`
	WindowID      string         `json:"windowId"`
	DataSourceRef string         `json:"dataSourceRef,omitempty"`
	Patch         map[string]any `json:"patch,omitempty"`
	Fetch         *bool          `json:"fetch,omitempty"`
}

type ForgeDataFetchInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
}

type ForgeTableSelectRowInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	RowIndex      int    `json:"rowIndex"`
}

type ForgeUniqueKeyField struct {
	Field     string `json:"field"`
	Parameter string `json:"parameter,omitempty"`
}

type ForgeTableSelectByKeyInput struct {
	ClientID      string                `json:"clientId,omitempty"`
	TimeoutMs     int                   `json:"timeoutMs,omitempty"`
	WindowID      string                `json:"windowId"`
	DataSourceRef string                `json:"dataSourceRef,omitempty"`
	Key           string                `json:"key"`
	UniqueKey     []ForgeUniqueKeyField `json:"uniqueKey,omitempty"`
}

type ForgeFileBrowserOpenFolderInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	URI           string `json:"uri"`
}

type ForgeFileBrowserSelectURIInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	URI           string `json:"uri"`
	OpenParents   *bool  `json:"openParents,omitempty"`
}

type ForgeFileBrowserSelectURIOutput struct {
	OK        bool   `json:"ok"`
	Error     string `json:"error,omitempty"`
	NodePath  []int  `json:"nodePath,omitempty"`
	Requested string `json:"requested,omitempty"`
}

type ForgeDialogOpenInput struct {
	ClientID      string         `json:"clientId,omitempty"`
	TimeoutMs     int            `json:"timeoutMs,omitempty"`
	WindowID      string         `json:"windowId"`
	DataSourceRef string         `json:"dataSourceRef,omitempty"`
	DialogID      string         `json:"dialogId"`
	Args          map[string]any `json:"args,omitempty"`
	Options       map[string]any `json:"options,omitempty"`
}

type ForgeDialogOpenOutput struct {
	OK      bool            `json:"ok"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type ForgeDialogCloseInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	DialogID      string `json:"dialogId"`
}

type ForgeDialogCommitInput struct {
	ClientID  string         `json:"clientId,omitempty"`
	TimeoutMs int            `json:"timeoutMs,omitempty"`
	WindowID  string         `json:"windowId"`
	DialogID  string         `json:"dialogId"`
	Payload   map[string]any `json:"payload,omitempty"`
}

type ForgeKeyPressInput struct {
	ClientID  string `json:"clientId,omitempty"`
	TimeoutMs int    `json:"timeoutMs,omitempty"`
	Key       string `json:"key"`
	Type      string `json:"type,omitempty"`
	CtrlKey   bool   `json:"ctrlKey,omitempty"`
	ShiftKey  bool   `json:"shiftKey,omitempty"`
	AltKey    bool   `json:"altKey,omitempty"`
	MetaKey   bool   `json:"metaKey,omitempty"`
}

type ForgeKeySequenceInput struct {
	ClientID  string        `json:"clientId,omitempty"`
	TimeoutMs int           `json:"timeoutMs,omitempty"`
	Keys      []interface{} `json:"keys"`
}

type ForgeControlsListInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId,omitempty"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
}

type ForgeControlsSearchInput struct {
	ClientID      string `json:"clientId,omitempty"`
	TimeoutMs     int    `json:"timeoutMs,omitempty"`
	WindowID      string `json:"windowId,omitempty"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	Query         string `json:"query"`
	Limit         int    `json:"limit,omitempty"`
}

type ForgeControlInfo struct {
	Key           string `json:"key,omitempty"`
	WindowID      string `json:"windowId,omitempty"`
	DataSourceRef string `json:"dataSourceRef,omitempty"`
	ControlID     string `json:"controlId,omitempty"`
	Label         string `json:"label,omitempty"`
	Type          string `json:"type,omitempty"`
	Scope         string `json:"scope,omitempty"`
	Ts            int64  `json:"ts,omitempty"`
}

type ForgeControlsListOutput struct {
	Controls []ForgeControlInfo `json:"controls,omitempty"`
}

type ForgeFocusGetInput struct {
	ClientID  string `json:"clientId,omitempty"`
	TimeoutMs int    `json:"timeoutMs,omitempty"`
}

type ForgeFocusGetOutput struct {
	Focused *ForgeControlInfo `json:"focused,omitempty"`
}

func callAndDecode(ctx context.Context, svc *service.Service, clientID string, timeoutMs int, method string, params any, out any) error {
	resp, err := svc.UICommand(ctx, &service.UICommandInput{
		ClientID:  clientID,
		Method:    method,
		Params:    params,
		TimeoutMs: timeoutMs,
	})
	if err != nil {
		return err
	}
	if resp == nil {
		return nil
	}
	if !resp.OK {
		if out != nil {
			b, _ := json.Marshal(map[string]any{"ok": false, "error": resp.Error})
			_ = json.Unmarshal(b, out)
		}
		return nil
	}
	if out == nil || len(resp.Result) == 0 {
		return nil
	}
	return json.Unmarshal(resp.Result, out)
}
