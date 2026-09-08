package types

type DraftFormSpec struct {
	DataSourceRef  string                 `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	SaveLabel      string                 `json:"saveLabel,omitempty" yaml:"saveLabel,omitempty"`
	ResetLabel     string                 `json:"resetLabel,omitempty" yaml:"resetLabel,omitempty"`
	ValidWhen      map[string]interface{} `json:"validWhen,omitempty" yaml:"validWhen,omitempty"`
	DirtyWhen      map[string]interface{} `json:"dirtyWhen,omitempty" yaml:"dirtyWhen,omitempty"`
	ConfirmDiscard string                 `json:"confirmDiscard,omitempty" yaml:"confirmDiscard,omitempty"`
	OnReset        string                 `json:"onReset,omitempty" yaml:"onReset,omitempty"`
	Submit         *MutationCommand       `json:"submit,omitempty" yaml:"submit,omitempty"`
}

type QueryToolbarSpec struct {
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Items         []Item `json:"items,omitempty" yaml:"items,omitempty"`
	Density       string `json:"density,omitempty" yaml:"density,omitempty"`
	Layout        string `json:"layout,omitempty" yaml:"layout,omitempty"`
}

type StableTabsSpec struct {
	DefaultSelectedTabID        string `json:"defaultSelectedTabId,omitempty" yaml:"defaultSelectedTabId,omitempty"`
	DataSourceFetchMode         string `json:"dataSourceFetchMode,omitempty" yaml:"dataSourceFetchMode,omitempty"`
	Appearance                  string `json:"appearance,omitempty" yaml:"appearance,omitempty"`
	Compact                     bool   `json:"compact,omitempty" yaml:"compact,omitempty"`
	KeepVisitedTabPanelsMounted bool   `json:"keepVisitedTabPanelsMounted,omitempty" yaml:"keepVisitedTabPanelsMounted,omitempty"`
	RenderActiveTabPanelOnly    *bool  `json:"renderActiveTabPanelOnly,omitempty" yaml:"renderActiveTabPanelOnly,omitempty"`
}

type ResourceHeaderSpec struct {
	DataSourceRef string                 `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	TitleField    string                 `json:"titleField,omitempty" yaml:"titleField,omitempty"`
	SubtitleField string                 `json:"subtitleField,omitempty" yaml:"subtitleField,omitempty"`
	Fields        []ResourceHeaderField  `json:"fields,omitempty" yaml:"fields,omitempty"`
	Actions       []ResourceHeaderAction `json:"actions,omitempty" yaml:"actions,omitempty"`
}

type ResourceHeaderField struct {
	Label  string `json:"label" yaml:"label"`
	Field  string `json:"field" yaml:"field"`
	Format string `json:"format,omitempty" yaml:"format,omitempty"`
}

type ResourceHeaderAction struct {
	ID           string                 `json:"id" yaml:"id"`
	Label        string                 `json:"label,omitempty" yaml:"label,omitempty"`
	Icon         string                 `json:"icon,omitempty" yaml:"icon,omitempty"`
	Intent       string                 `json:"intent,omitempty" yaml:"intent,omitempty"`
	HideLabel    bool                   `json:"hideLabel,omitempty" yaml:"hideLabel,omitempty"`
	VisibleWhen  map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	DisabledWhen map[string]interface{} `json:"disabledWhen,omitempty" yaml:"disabledWhen,omitempty"`
	Handler      string                 `json:"handler,omitempty" yaml:"handler,omitempty"`
	Mutation     *MutationCommand       `json:"mutation,omitempty" yaml:"mutation,omitempty"`
}

type DataStateBoundarySpec struct {
	DataSourceRefs     []string               `json:"dataSourceRefs,omitempty" yaml:"dataSourceRefs,omitempty"`
	AllowPartial       bool                   `json:"allowPartial,omitempty" yaml:"allowPartial,omitempty"`
	RenderEmptyContent bool                   `json:"renderEmptyContent,omitempty" yaml:"renderEmptyContent,omitempty"`
	LoadingMessage     string                 `json:"loadingMessage,omitempty" yaml:"loadingMessage,omitempty"`
	EmptyMessage       string                 `json:"emptyMessage,omitempty" yaml:"emptyMessage,omitempty"`
	ErrorMessage       string                 `json:"errorMessage,omitempty" yaml:"errorMessage,omitempty"`
	StaleMessage       string                 `json:"staleMessage,omitempty" yaml:"staleMessage,omitempty"`
	SuppressErrorWhen  map[string]interface{} `json:"suppressErrorWhen,omitempty" yaml:"suppressErrorWhen,omitempty"`
}

type RelationDrillSpec struct {
	DataSourceRef string     `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	LabelField    string     `json:"labelField,omitempty" yaml:"labelField,omitempty"`
	CountField    string     `json:"countField,omitempty" yaml:"countField,omitempty"`
	SingularLabel string     `json:"singularLabel,omitempty" yaml:"singularLabel,omitempty"`
	PluralLabel   string     `json:"pluralLabel,omitempty" yaml:"pluralLabel,omitempty"`
	EmptyText     string     `json:"emptyText,omitempty" yaml:"emptyText,omitempty"`
	Link          *TableLink `json:"link,omitempty" yaml:"link,omitempty"`
}

type NotificationRulesSpec struct {
	Rules []NotificationRule `json:"rules,omitempty" yaml:"rules,omitempty"`
}

type NotificationRule struct {
	ID          string                 `json:"id" yaml:"id"`
	Message     string                 `json:"message" yaml:"message"`
	Intent      string                 `json:"intent,omitempty" yaml:"intent,omitempty"`
	Icon        string                 `json:"icon,omitempty" yaml:"icon,omitempty"`
	VisibleWhen map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	Action      *ResourceHeaderAction  `json:"action,omitempty" yaml:"action,omitempty"`
}

type MetricSummarySpec struct {
	DataSourceRef string              `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Columns       int                 `json:"columns,omitempty" yaml:"columns,omitempty"`
	Metrics       []MetricSummaryItem `json:"metrics,omitempty" yaml:"metrics,omitempty"`
}

type MetricSummaryItem struct {
	ID               string `json:"id" yaml:"id"`
	Label            string `json:"label" yaml:"label"`
	Field            string `json:"field" yaml:"field"`
	Format           string `json:"format,omitempty" yaml:"format,omitempty"`
	CurrencyField    string `json:"currencyField,omitempty" yaml:"currencyField,omitempty"`
	ComparisonField  string `json:"comparisonField,omitempty" yaml:"comparisonField,omitempty"`
	ComparisonFormat string `json:"comparisonFormat,omitempty" yaml:"comparisonFormat,omitempty"`
	BetterWhen       string `json:"betterWhen,omitempty" yaml:"betterWhen,omitempty"` // higher|lower|neutral
	EmptyText        string `json:"emptyText,omitempty" yaml:"emptyText,omitempty"`
}

type DetailViewSpec struct {
	DataSourceRef     string              `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Source            string              `json:"source,omitempty" yaml:"source,omitempty"` // form|selection|collection|metrics
	Columns           int                 `json:"columns,omitempty" yaml:"columns,omitempty"`
	ResponsiveColumns map[string]int      `json:"responsiveColumns,omitempty" yaml:"responsiveColumns,omitempty"`
	EmptyText         string              `json:"emptyText,omitempty" yaml:"emptyText,omitempty"`
	Fields            []DetailViewField   `json:"fields,omitempty" yaml:"fields,omitempty"`
	Sections          []DetailViewSection `json:"sections,omitempty" yaml:"sections,omitempty"`
}

type DetailViewSection struct {
	ID          string                 `json:"id" yaml:"id"`
	Label       string                 `json:"label,omitempty" yaml:"label,omitempty"`
	Description string                 `json:"description,omitempty" yaml:"description,omitempty"`
	VisibleWhen map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	Fields      []DetailViewField      `json:"fields,omitempty" yaml:"fields,omitempty"`
}

type DetailViewField struct {
	ID               string                 `json:"id" yaml:"id"`
	Label            string                 `json:"label" yaml:"label"`
	Field            string                 `json:"field" yaml:"field"`
	Format           string                 `json:"format,omitempty" yaml:"format,omitempty"`
	TimeZone         string                 `json:"timeZone,omitempty" yaml:"timeZone,omitempty"`
	TimeZoneSelector string                 `json:"timeZoneSelector,omitempty" yaml:"timeZoneSelector,omitempty"`
	CurrencyField    string                 `json:"currencyField,omitempty" yaml:"currencyField,omitempty"`
	EmptyText        string                 `json:"emptyText,omitempty" yaml:"emptyText,omitempty"`
	Span             int                    `json:"span,omitempty" yaml:"span,omitempty"`
	Copyable         bool                   `json:"copyable,omitempty" yaml:"copyable,omitempty"`
	VisibleWhen      map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	Link             *TableLink             `json:"link,omitempty" yaml:"link,omitempty"`
}

type MasterDetailSpec struct {
	StateKey              string             `json:"stateKey,omitempty" yaml:"stateKey,omitempty"`
	IdentityFields        []string           `json:"identityFields" yaml:"identityFields"`
	Master                MasterDetailRegion `json:"master" yaml:"master"`
	Detail                MasterDetailRegion `json:"detail" yaml:"detail"`
	EmptyDetail           MasterDetailEmpty  `json:"emptyDetail,omitempty" yaml:"emptyDetail,omitempty"`
	SelectionInvalidation string             `json:"selectionInvalidation,omitempty" yaml:"selectionInvalidation,omitempty"`
	Responsive            map[string]string  `json:"responsive,omitempty" yaml:"responsive,omitempty"`
}

type MasterDetailRegion struct {
	ContainerID string                 `json:"containerId" yaml:"containerId"`
	Parameters  map[string]interface{} `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	AllowedWhen map[string]interface{} `json:"allowedWhen,omitempty" yaml:"allowedWhen,omitempty"`
}

type MasterDetailEmpty struct {
	Message string `json:"message,omitempty" yaml:"message,omitempty"`
}
