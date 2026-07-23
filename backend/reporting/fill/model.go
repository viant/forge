package reportfill

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"unicode/utf16"

	reportspec "github.com/viant/forge/backend/reporting/spec"
)

type ReportFill struct {
	Version          int              `json:"version"`
	Kind             string           `json:"kind"`
	SpecVersion      int              `json:"specVersion"`
	SpecHash         string           `json:"specHash"`
	Source           Source           `json:"source"`
	Parameters       map[string]any   `json:"parameters"`
	Refinements      []map[string]any `json:"refinements"`
	CalculatedFields []map[string]any `json:"calculatedFields"`
	Datasets         []Dataset        `json:"datasets"`
	Blocks           []Block          `json:"blocks"`
	Diagnostics      []Diagnostic     `json:"diagnostics"`
}

type Source struct {
	Kind          string `json:"kind"`
	ContainerID   string `json:"containerId"`
	StateKey      string `json:"stateKey"`
	DataSourceRef string `json:"dataSourceRef"`
}

type Diagnostic struct {
	ID           string `json:"id,omitempty"`
	Code         string `json:"code"`
	Severity     string `json:"severity"`
	BlockID      string `json:"blockId,omitempty"`
	Path         string `json:"path,omitempty"`
	Message      string `json:"message"`
	SuggestedFix string `json:"suggestedFix,omitempty"`
}

type Dataset struct {
	ID            string                    `json:"id"`
	DataSourceRef string                    `json:"dataSourceRef"`
	Request       reportspec.RequestPayload `json:"request"`
	Provenance    Provenance                `json:"provenance"`
	Rows          []map[string]any          `json:"rows"`

	requestPayload json.RawMessage
}

type Provenance struct {
	RequestHash string       `json:"requestHash"`
	RowCount    int          `json:"rowCount"`
	Truncated   bool         `json:"truncated"`
	HasMore     bool         `json:"hasMore"`
	Diagnostics []Diagnostic `json:"diagnostics"`
}

type Block struct {
	ID                       string                `json:"id"`
	Kind                     string                `json:"kind"`
	Title                    string                `json:"title,omitempty"`
	DatasetRef               string                `json:"datasetRef,omitempty"`
	Columns                  []TableColumn         `json:"columns,omitempty"`
	Content                  *TableContent         `json:"content,omitempty"`
	ChartSpec                map[string]any        `json:"chartSpec,omitempty"`
	ChartModel               map[string]any        `json:"chartModel,omitempty"`
	ValueField               string                `json:"valueField,omitempty"`
	ValueLabel               string                `json:"valueLabel,omitempty"`
	ValueFormat              string                `json:"valueFormat,omitempty"`
	SecondaryField           string                `json:"secondaryField,omitempty"`
	SecondaryLabel           string                `json:"secondaryLabel,omitempty"`
	SecondaryFormat          string                `json:"secondaryFormat,omitempty"`
	SecondaryDisplayKey      string                `json:"secondaryDisplayKey,omitempty"`
	SecondaryDisplayValueMap map[string]any        `json:"secondaryDisplayValueMap,omitempty"`
	Description              string                `json:"description,omitempty"`
	EmptyLabel               string                `json:"emptyLabel,omitempty"`
	RowSelector              string                `json:"rowSelector,omitempty"`
	PresentationMode         string                `json:"presentationMode,omitempty"`
	BodyFormat               string                `json:"bodyFormat,omitempty"`
	BodyTemplate             string                `json:"bodyTemplate,omitempty"`
	ParamIDs                 []string              `json:"paramIds,omitempty"`
	Mode                     string                `json:"mode,omitempty"`
	Placement                string                `json:"placement,omitempty"`
	GroupOrder               []string              `json:"groupOrder,omitempty"`
	VisibleGroups            []string              `json:"visibleGroups,omitempty"`
	CollapsedGroups          []string              `json:"collapsedGroups,omitempty"`
	Markdown                 string                `json:"markdown,omitempty"`
	Geo                      map[string]any        `json:"geo,omitempty"`
	Icon                     string                `json:"icon,omitempty"`
	Tone                     string                `json:"tone,omitempty"`
	Badges                   []string              `json:"badges,omitempty"`
	Items                    []BadgeItem           `json:"items,omitempty"`
	ChildBlockIDs            []string              `json:"childBlockIds,omitempty"`
	SectionIDs               []string              `json:"sectionIds,omitempty"`
	DefaultSectionID         string                `json:"defaultSectionId,omitempty"`
	ItemTitleField           string                `json:"itemTitleField,omitempty"`
	ItemTitleLabel           string                `json:"itemTitleLabel,omitempty"`
	ToneField                string                `json:"toneField,omitempty"`
	ToneRules                []map[string]any      `json:"toneRules,omitempty"`
	Layout                   string                `json:"layout,omitempty"`
	ChartContent             *ChartContent         `json:"-"`
	GeoContent               *GeoContent           `json:"-"`
	KPIContent               *KPIContent           `json:"-"`
	CollectionContent        *CollectionContent    `json:"-"`
	SectionContent           *SectionContent       `json:"-"`
	CompositeContent         *CompositeContent     `json:"-"`
	TabGroupContent          *TabGroupContent      `json:"-"`
	StepperContent           *StepperContent       `json:"-"`
	InfoPanelContent         *InfoPanelContent     `json:"-"`
	CalloutContent           *CalloutContent       `json:"-"`
	KanbanContent            *KanbanContent        `json:"-"`
	TimelineContent          *TimelineContent      `json:"-"`
	BadgesContent            *BadgesContent        `json:"-"`
	FilterBarContent         *FilterBarContent     `json:"-"`
	RefinementBarContent     *RefinementBarContent `json:"-"`
	MarkdownContent          *MarkdownContent      `json:"-"`
	Runtime                  map[string]any        `json:"runtime,omitempty"`
}

type TableColumn struct {
	Key               string `json:"key"`
	SourceKey         string `json:"sourceKey,omitempty"`
	DisplayKey        string `json:"displayKey,omitempty"`
	Label             string `json:"label"`
	Kind              string `json:"kind,omitempty"`
	Format            string `json:"format,omitempty"`
	Align             string `json:"align,omitempty"`
	CellVisual        any    `json:"cellVisual,omitempty"`
	RuntimeFilterable bool   `json:"runtimeFilterable,omitempty"`
}

type TableContent struct {
	Columns      []TableColumn      `json:"columns"`
	RowCount     int                `json:"rowCount"`
	ResolvedRows []ResolvedTableRow `json:"resolvedRows"`
}

type ResolvedTableRow struct {
	RowIndex int                 `json:"rowIndex"`
	Cells    []ResolvedTableCell `json:"cells"`
}

type ResolvedTableCell struct {
	Key          string                        `json:"key"`
	SourceKey    string                        `json:"sourceKey"`
	DisplayKey   string                        `json:"displayKey"`
	Value        any                           `json:"value"`
	DisplayValue any                           `json:"displayValue"`
	VisualState  *ResolvedTableCellVisualState `json:"visualState"`
}

type ResolvedTableCellVisualState struct {
	Kind            string                           `json:"kind"`
	Value           *float64                         `json:"value,omitempty"`
	Percent         *float64                         `json:"percent,omitempty"`
	Palette         []string                         `json:"palette,omitempty"`
	Tone            string                           `json:"tone,omitempty"`
	Label           string                           `json:"label,omitempty"`
	BackgroundColor string                           `json:"backgroundColor,omitempty"`
	BorderColor     string                           `json:"borderColor,omitempty"`
	TextColor       string                           `json:"textColor,omitempty"`
	Segments        []ResolvedTableCellVisualSegment `json:"segments,omitempty"`
}

type ResolvedTableCellVisualSegment struct {
	Label   string  `json:"label"`
	Color   string  `json:"color"`
	Value   float64 `json:"value"`
	Percent float64 `json:"percent"`
}

type ChartContent struct {
	ChartSpec     map[string]any `json:"chartSpec"`
	ChartModel    map[string]any `json:"chartModel"`
	RowCount      *int           `json:"rowCount"`
	ResolvedChart *ResolvedChart `json:"resolvedChart"`
}

type ResolvedChart struct {
	Kind       string           `json:"kind"`
	Type       string           `json:"type"`
	NameKey    string           `json:"nameKey,omitempty"`
	ValueKey   string           `json:"valueKey,omitempty"`
	XAxisKey   string           `json:"xAxisKey,omitempty"`
	SeriesKeys []string         `json:"seriesKeys"`
	Rows       []map[string]any `json:"rows"`
}

type GeoContent struct {
	Geo         map[string]any `json:"geo"`
	RowCount    *int           `json:"rowCount"`
	ResolvedGeo *ResolvedGeo   `json:"resolvedGeo"`
}

type ResolvedGeo struct {
	Shape        string              `json:"shape"`
	KeyField     string              `json:"keyField"`
	LabelField   string              `json:"labelField"`
	MetricKey    string              `json:"metricKey"`
	MetricLabel  string              `json:"metricLabel"`
	Format       string              `json:"format"`
	Aggregate    string              `json:"aggregate"`
	Regions      []ResolvedGeoRegion `json:"regions"`
	Ranking      []ResolvedGeoRegion `json:"ranking"`
	ActiveRegion *ResolvedGeoRegion  `json:"activeRegion"`
	Summary      *ResolvedGeoSummary `json:"summary"`
	Legend       *ResolvedGeoLegend  `json:"legend"`
}

type ResolvedGeoRegion struct {
	Key          string `json:"key"`
	Label        string `json:"label"`
	RawValue     any    `json:"rawValue"`
	DisplayValue string `json:"displayValue"`
	Color        string `json:"color"`
	StatusColor  string `json:"statusColor"`
	StatusLabel  string `json:"statusLabel"`
	RowCount     *int   `json:"rowCount"`
}

type ResolvedGeoSummary struct {
	RegionCount *int   `json:"regionCount"`
	TotalValue  string `json:"totalValue"`
	TopKey      string `json:"topKey"`
}

type ResolvedGeoLegend struct {
	Rules   []ResolvedGeoLegendRule `json:"rules,omitempty"`
	Min     string                  `json:"min,omitempty"`
	Max     string                  `json:"max,omitempty"`
	Palette []string                `json:"palette,omitempty"`
}

type ResolvedGeoLegendRule struct {
	Color string `json:"color"`
	Label string `json:"label"`
}

type KPIContent struct {
	Title                    string         `json:"title"`
	Description              string         `json:"description,omitempty"`
	ValueField               string         `json:"valueField"`
	ValueLabel               string         `json:"valueLabel"`
	ValueFormat              string         `json:"valueFormat,omitempty"`
	Value                    any            `json:"value"`
	RowCount                 *int           `json:"rowCount"`
	SecondaryField           string         `json:"secondaryField,omitempty"`
	SecondaryLabel           string         `json:"secondaryLabel,omitempty"`
	SecondaryFormat          string         `json:"secondaryFormat,omitempty"`
	SecondaryDisplayKey      string         `json:"secondaryDisplayKey,omitempty"`
	SecondaryDisplayValueMap map[string]any `json:"secondaryDisplayValueMap,omitempty"`
	SecondaryValue           any            `json:"secondaryValue,omitempty"`
	EmptyLabel               string         `json:"emptyLabel,omitempty"`
	RowSelector              string         `json:"rowSelector,omitempty"`
	PresentationMode         string         `json:"presentationMode,omitempty"`
	BodyFormat               string         `json:"bodyFormat,omitempty"`
	BodyTemplate             string         `json:"bodyTemplate,omitempty"`
	BodyMarkdown             string         `json:"bodyMarkdown,omitempty"`
}

type BadgeItem struct {
	ID              string                 `json:"id"`
	Label           string                 `json:"label,omitempty"`
	Value           any                    `json:"value,omitempty"`
	ValueField      string                 `json:"valueField,omitempty"`
	Format          string                 `json:"format,omitempty"`
	DisplayKey      string                 `json:"displayKey,omitempty"`
	DisplayValueMap map[string]any         `json:"displayValueMap,omitempty"`
	LabelMode       string                 `json:"labelMode,omitempty"`
	Rules           []reportspec.BadgeRule `json:"rules,omitempty"`
	Tone            string                 `json:"tone,omitempty"`
	DisplayValue    string                 `json:"displayValue,omitempty"`
}

type BadgesContent struct {
	Title    string      `json:"title"`
	RowCount *int        `json:"rowCount"`
	Items    []BadgeItem `json:"items"`
}

type CollectionItemContent struct {
	Index           *int   `json:"index,omitempty"`
	Title           any    `json:"title"`
	ItemTitleField  string `json:"itemTitleField,omitempty"`
	ItemTitleLabel  string `json:"itemTitleLabel,omitempty"`
	ValueField      string `json:"valueField,omitempty"`
	ValueLabel      string `json:"valueLabel,omitempty"`
	ValueFormat     string `json:"valueFormat,omitempty"`
	Value           any    `json:"value,omitempty"`
	SecondaryField  string `json:"secondaryField,omitempty"`
	SecondaryLabel  string `json:"secondaryLabel,omitempty"`
	SecondaryFormat string `json:"secondaryFormat,omitempty"`
	SecondaryValue  any    `json:"secondaryValue,omitempty"`
	BodyMarkdown    string `json:"bodyMarkdown,omitempty"`
	ToneField       string `json:"toneField,omitempty"`
	ToneValue       any    `json:"toneValue,omitempty"`
	Tone            string `json:"tone,omitempty"`
	ToneLabel       string `json:"toneLabel,omitempty"`
	BackgroundColor string `json:"backgroundColor,omitempty"`
	BorderColor     string `json:"borderColor,omitempty"`
	TextColor       string `json:"textColor,omitempty"`
}

type CollectionContent struct {
	Title       string                  `json:"title"`
	Description string                  `json:"description,omitempty"`
	EmptyLabel  string                  `json:"emptyLabel,omitempty"`
	Layout      string                  `json:"layout"`
	Columns     int                     `json:"columns"`
	RowCount    int                     `json:"rowCount"`
	RowLimit    int                     `json:"rowLimit"`
	Items       []CollectionItemContent `json:"items"`
}

type SectionContent struct {
	Title           string `json:"title"`
	Subtitle        string `json:"subtitle,omitempty"`
	Description     string `json:"description,omitempty"`
	NavigationLabel string `json:"navigationLabel"`
}

type CompositeContent struct {
	Title         string   `json:"title"`
	Description   string   `json:"description,omitempty"`
	ChildBlockIDs []string `json:"childBlockIds"`
}

type TabGroupTab struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	NavigationLabel string `json:"navigationLabel"`
}

type TabGroupContent struct {
	Title            string        `json:"title"`
	SectionIDs       []string      `json:"sectionIds"`
	DefaultSectionID string        `json:"defaultSectionId,omitempty"`
	Tabs             []TabGroupTab `json:"tabs"`
}

type StepperContent struct {
	Title       string                   `json:"title"`
	Description string                   `json:"description,omitempty"`
	Steps       []reportspec.StepperStep `json:"steps"`
}

type InfoPanelContent struct {
	Title       string `json:"title"`
	Eyebrow     string `json:"eyebrow,omitempty"`
	Description string `json:"description,omitempty"`
	Tone        string `json:"tone,omitempty"`
	BodyFormat  string `json:"bodyFormat,omitempty"`
	Body        string `json:"body"`
}

type CalloutContent struct {
	Title       string   `json:"title"`
	Icon        string   `json:"icon,omitempty"`
	Description string   `json:"description,omitempty"`
	Tone        string   `json:"tone,omitempty"`
	Badges      []string `json:"badges,omitempty"`
	BodyFormat  string   `json:"bodyFormat,omitempty"`
	Body        string   `json:"body"`
}

type KanbanContent struct {
	Title       string                    `json:"title"`
	Description string                    `json:"description,omitempty"`
	Columns     []reportspec.KanbanColumn `json:"columns"`
}

type TimelineContent struct {
	Title       string                     `json:"title"`
	Description string                     `json:"description,omitempty"`
	Events      []reportspec.TimelineEvent `json:"events"`
}

type FilterBarContent struct {
	Title           string                   `json:"title"`
	Mode            string                   `json:"mode,omitempty"`
	Placement       string                   `json:"placement,omitempty"`
	GroupOrder      []string                 `json:"groupOrder,omitempty"`
	VisibleGroups   []string                 `json:"visibleGroups,omitempty"`
	CollapsedGroups []string                 `json:"collapsedGroups,omitempty"`
	Params          []FilterBarContentParams `json:"params"`
}

type FilterBarContentParamOption struct {
	Label       string `json:"label"`
	Value       any    `json:"value"`
	Icon        string `json:"icon,omitempty"`
	Default     *bool  `json:"default,omitempty"`
	Description string `json:"description,omitempty"`
}

type FilterBarContentParams struct {
	ID           string                        `json:"id"`
	GroupID      string                        `json:"groupId,omitempty"`
	Label        string                        `json:"label,omitempty"`
	Description  string                        `json:"description,omitempty"`
	Type         string                        `json:"type,omitempty"`
	Required     *bool                         `json:"required,omitempty"`
	Multiple     *bool                         `json:"multiple,omitempty"`
	Presentation string                        `json:"presentation,omitempty"`
	Options      []FilterBarContentParamOption `json:"options,omitempty"`
	Value        any                           `json:"value"`
}

type RefinementBarContent struct {
	Title       string           `json:"title,omitempty"`
	ActionKinds []string         `json:"actionKinds,omitempty"`
	EmptyLabel  string           `json:"emptyLabel,omitempty"`
	Refinements []map[string]any `json:"refinements"`
}

type MarkdownContent struct {
	Title    string `json:"title"`
	Markdown string `json:"markdown"`
}

type rawReportFill struct {
	Version          int               `json:"version"`
	Kind             string            `json:"kind"`
	SpecVersion      int               `json:"specVersion"`
	SpecHash         string            `json:"specHash"`
	Source           Source            `json:"source"`
	Parameters       map[string]any    `json:"parameters"`
	Refinements      []map[string]any  `json:"refinements"`
	CalculatedFields []map[string]any  `json:"calculatedFields"`
	Datasets         []rawDataset      `json:"datasets"`
	Blocks           []json.RawMessage `json:"blocks"`
	Diagnostics      []Diagnostic      `json:"diagnostics"`
}

type rawDataset struct {
	ID            string           `json:"id"`
	DataSourceRef string           `json:"dataSourceRef"`
	Request       json.RawMessage  `json:"request"`
	Provenance    Provenance       `json:"provenance"`
	Rows          []map[string]any `json:"rows"`
}

type rawBlockHeader struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Title      string `json:"title,omitempty"`
	DatasetRef string `json:"datasetRef,omitempty"`
}

type rawTableBlock struct {
	ID         string        `json:"id"`
	Kind       string        `json:"kind"`
	Title      string        `json:"title,omitempty"`
	DatasetRef string        `json:"datasetRef"`
	Columns    []TableColumn `json:"columns"`
	Content    TableContent  `json:"content"`
}

type rawChartBlock struct {
	ID         string         `json:"id"`
	Kind       string         `json:"kind"`
	Title      string         `json:"title,omitempty"`
	DatasetRef string         `json:"datasetRef"`
	ChartSpec  map[string]any `json:"chartSpec"`
	ChartModel map[string]any `json:"chartModel"`
	Content    ChartContent   `json:"content"`
}

type rawKPIBlock struct {
	ID                       string         `json:"id"`
	Kind                     string         `json:"kind"`
	Title                    string         `json:"title"`
	DatasetRef               string         `json:"datasetRef"`
	ValueField               string         `json:"valueField"`
	ValueLabel               string         `json:"valueLabel"`
	ValueFormat              string         `json:"valueFormat,omitempty"`
	SecondaryField           string         `json:"secondaryField,omitempty"`
	SecondaryLabel           string         `json:"secondaryLabel,omitempty"`
	SecondaryFormat          string         `json:"secondaryFormat,omitempty"`
	SecondaryDisplayKey      string         `json:"secondaryDisplayKey,omitempty"`
	SecondaryDisplayValueMap map[string]any `json:"secondaryDisplayValueMap,omitempty"`
	Description              string         `json:"description,omitempty"`
	EmptyLabel               string         `json:"emptyLabel,omitempty"`
	RowSelector              string         `json:"rowSelector,omitempty"`
	PresentationMode         string         `json:"presentationMode,omitempty"`
	BodyFormat               string         `json:"bodyFormat,omitempty"`
	BodyTemplate             string         `json:"bodyTemplate,omitempty"`
	Content                  KPIContent     `json:"content"`
}

type rawBadgesBlock struct {
	ID         string        `json:"id"`
	Kind       string        `json:"kind"`
	Title      string        `json:"title"`
	DatasetRef string        `json:"datasetRef"`
	Items      []BadgeItem   `json:"items"`
	Content    BadgesContent `json:"content"`
}

type rawFilterBarBlock struct {
	ID              string           `json:"id"`
	Kind            string           `json:"kind"`
	Title           string           `json:"title,omitempty"`
	DatasetRef      string           `json:"datasetRef,omitempty"`
	ParamIDs        []string         `json:"paramIds,omitempty"`
	Mode            string           `json:"mode,omitempty"`
	Placement       string           `json:"placement,omitempty"`
	GroupOrder      []string         `json:"groupOrder,omitempty"`
	VisibleGroups   []string         `json:"visibleGroups,omitempty"`
	CollapsedGroups []string         `json:"collapsedGroups,omitempty"`
	Content         FilterBarContent `json:"content"`
}

type rawRefinementBarBlock struct {
	ID          string               `json:"id"`
	Kind        string               `json:"kind"`
	Title       string               `json:"title,omitempty"`
	ActionKinds []string             `json:"actionKinds,omitempty"`
	EmptyLabel  string               `json:"emptyLabel,omitempty"`
	Content     RefinementBarContent `json:"content"`
}

type rawMarkdownBlock struct {
	ID       string          `json:"id"`
	Kind     string          `json:"kind"`
	Title    string          `json:"title,omitempty"`
	Markdown string          `json:"markdown,omitempty"`
	Content  MarkdownContent `json:"content"`
}

type rawGeoMapBlock struct {
	ID         string         `json:"id"`
	Kind       string         `json:"kind"`
	Title      string         `json:"title"`
	DatasetRef string         `json:"datasetRef"`
	Geo        map[string]any `json:"geo"`
	Content    GeoContent     `json:"content"`
}

type rawCollectionBlock struct {
	ID              string            `json:"id"`
	Kind            string            `json:"kind"`
	Title           string            `json:"title"`
	DatasetRef      string            `json:"datasetRef"`
	Description     string            `json:"description,omitempty"`
	ItemTitleField  string            `json:"itemTitleField"`
	ItemTitleLabel  string            `json:"itemTitleLabel,omitempty"`
	ToneField       string            `json:"toneField,omitempty"`
	ToneRules       []map[string]any  `json:"toneRules,omitempty"`
	ValueField      string            `json:"valueField,omitempty"`
	ValueLabel      string            `json:"valueLabel,omitempty"`
	ValueFormat     string            `json:"valueFormat,omitempty"`
	SecondaryField  string            `json:"secondaryField,omitempty"`
	SecondaryLabel  string            `json:"secondaryLabel,omitempty"`
	SecondaryFormat string            `json:"secondaryFormat,omitempty"`
	Layout          string            `json:"layout"`
	Columns         int               `json:"columns,omitempty"`
	RowLimit        int               `json:"rowLimit"`
	BodyFormat      string            `json:"bodyFormat,omitempty"`
	BodyTemplate    string            `json:"bodyTemplate,omitempty"`
	EmptyLabel      string            `json:"emptyLabel,omitempty"`
	Content         CollectionContent `json:"content"`
}

type rawSectionBlock struct {
	ID              string         `json:"id"`
	Kind            string         `json:"kind"`
	Title           string         `json:"title"`
	Subtitle        string         `json:"subtitle,omitempty"`
	Description     string         `json:"description,omitempty"`
	NavigationLabel string         `json:"navigationLabel,omitempty"`
	Content         SectionContent `json:"content"`
}

type rawCompositeBlock struct {
	ID            string           `json:"id"`
	Kind          string           `json:"kind"`
	Title         string           `json:"title"`
	Description   string           `json:"description,omitempty"`
	ChildBlockIDs []string         `json:"childBlockIds"`
	Content       CompositeContent `json:"content"`
}

type rawTabGroupBlock struct {
	ID               string          `json:"id"`
	Kind             string          `json:"kind"`
	Title            string          `json:"title,omitempty"`
	SectionIDs       []string        `json:"sectionIds"`
	DefaultSectionID string          `json:"defaultSectionId,omitempty"`
	Content          TabGroupContent `json:"content"`
}

type rawStepperBlock struct {
	ID          string                   `json:"id"`
	Kind        string                   `json:"kind"`
	Title       string                   `json:"title"`
	Description string                   `json:"description,omitempty"`
	Steps       []reportspec.StepperStep `json:"steps,omitempty"`
	Content     StepperContent           `json:"content"`
}

type rawInfoPanelBlock struct {
	ID          string           `json:"id"`
	Kind        string           `json:"kind"`
	Title       string           `json:"title"`
	Eyebrow     string           `json:"eyebrow,omitempty"`
	Description string           `json:"description,omitempty"`
	Tone        string           `json:"tone,omitempty"`
	BodyFormat  string           `json:"bodyFormat,omitempty"`
	Body        string           `json:"body,omitempty"`
	Content     InfoPanelContent `json:"content"`
}

type rawCalloutBlock struct {
	ID          string         `json:"id"`
	Kind        string         `json:"kind"`
	Title       string         `json:"title"`
	Icon        string         `json:"icon,omitempty"`
	Description string         `json:"description,omitempty"`
	Tone        string         `json:"tone,omitempty"`
	Badges      []string       `json:"badges,omitempty"`
	BodyFormat  string         `json:"bodyFormat,omitempty"`
	Body        string         `json:"body,omitempty"`
	Content     CalloutContent `json:"content"`
}

type rawKanbanBlock struct {
	ID          string                    `json:"id"`
	Kind        string                    `json:"kind"`
	Title       string                    `json:"title"`
	Description string                    `json:"description,omitempty"`
	Columns     []reportspec.KanbanColumn `json:"columns,omitempty"`
	Content     KanbanContent             `json:"content"`
}

type rawTimelineBlock struct {
	ID          string                     `json:"id"`
	Kind        string                     `json:"kind"`
	Title       string                     `json:"title"`
	Description string                     `json:"description,omitempty"`
	Events      []reportspec.TimelineEvent `json:"events,omitempty"`
	Content     TimelineContent            `json:"content"`
}

func DecodeJSON(data []byte) (*ReportFill, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var raw rawReportFill
	if err := decoder.Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode reportFill: %w", err)
	}
	if err := rejectTrailingJSON(decoder, "reportFill"); err != nil {
		return nil, err
	}
	fill := &ReportFill{
		Version:          raw.Version,
		Kind:             raw.Kind,
		SpecVersion:      raw.SpecVersion,
		SpecHash:         raw.SpecHash,
		Source:           raw.Source,
		Parameters:       raw.Parameters,
		Refinements:      raw.Refinements,
		CalculatedFields: raw.CalculatedFields,
		Datasets:         make([]Dataset, 0, len(raw.Datasets)),
		Diagnostics:      raw.Diagnostics,
		Blocks:           make([]Block, 0, len(raw.Blocks)),
	}
	for index, dataset := range raw.Datasets {
		request, err := decodeRequestPayload(dataset.Request, index)
		if err != nil {
			return nil, err
		}
		fill.Datasets = append(fill.Datasets, Dataset{
			ID:             dataset.ID,
			DataSourceRef:  dataset.DataSourceRef,
			Request:        request,
			Provenance:     dataset.Provenance,
			Rows:           dataset.Rows,
			requestPayload: bytes.TrimSpace(dataset.Request),
		})
	}
	for index, block := range raw.Blocks {
		runtime, sanitizedBlock, err := extractFillBlockRuntime(block, fmt.Sprintf("reportFill.blocks[%d]", index))
		if err != nil {
			return nil, err
		}
		block = sanitizedBlock
		blockCountBefore := len(fill.Blocks)
		header := rawBlockHeader{}
		if err := json.Unmarshal(block, &header); err != nil {
			return nil, fmt.Errorf("decode reportFill.blocks[%d]: %w", index, err)
		}
		switch strings.TrimSpace(header.Kind) {
		case "tableBlock":
			tableBlock := rawTableBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&tableBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] tableBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:         tableBlock.ID,
				Kind:       tableBlock.Kind,
				Title:      tableBlock.Title,
				DatasetRef: tableBlock.DatasetRef,
				Columns:    tableBlock.Columns,
				Content:    &tableBlock.Content,
			})
		case "chartBlock":
			chartBlock := rawChartBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&chartBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] chartBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:           chartBlock.ID,
				Kind:         chartBlock.Kind,
				Title:        chartBlock.Title,
				DatasetRef:   chartBlock.DatasetRef,
				ChartSpec:    chartBlock.ChartSpec,
				ChartModel:   chartBlock.ChartModel,
				ChartContent: &chartBlock.Content,
			})
		case "kpiBlock":
			kpiBlock := rawKPIBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&kpiBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] kpiBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:                       kpiBlock.ID,
				Kind:                     kpiBlock.Kind,
				Title:                    kpiBlock.Title,
				DatasetRef:               kpiBlock.DatasetRef,
				ValueField:               kpiBlock.ValueField,
				ValueLabel:               kpiBlock.ValueLabel,
				ValueFormat:              kpiBlock.ValueFormat,
				SecondaryField:           kpiBlock.SecondaryField,
				SecondaryLabel:           kpiBlock.SecondaryLabel,
				SecondaryFormat:          kpiBlock.SecondaryFormat,
				SecondaryDisplayKey:      kpiBlock.SecondaryDisplayKey,
				SecondaryDisplayValueMap: kpiBlock.SecondaryDisplayValueMap,
				Description:              kpiBlock.Description,
				EmptyLabel:               kpiBlock.EmptyLabel,
				RowSelector:              kpiBlock.RowSelector,
				PresentationMode:         kpiBlock.PresentationMode,
				BodyFormat:               kpiBlock.BodyFormat,
				BodyTemplate:             kpiBlock.BodyTemplate,
				KPIContent:               &kpiBlock.Content,
			})
		case "badgesBlock":
			badgesBlock := rawBadgesBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&badgesBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] badgesBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:            badgesBlock.ID,
				Kind:          badgesBlock.Kind,
				Title:         badgesBlock.Title,
				DatasetRef:    badgesBlock.DatasetRef,
				Items:         badgesBlock.Items,
				BadgesContent: &badgesBlock.Content,
			})
		case "collectionBlock":
			collectionBlock := rawCollectionBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&collectionBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] collectionBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:                collectionBlock.ID,
				Kind:              collectionBlock.Kind,
				Title:             collectionBlock.Title,
				DatasetRef:        collectionBlock.DatasetRef,
				Description:       collectionBlock.Description,
				ValueField:        collectionBlock.ValueField,
				ValueLabel:        collectionBlock.ValueLabel,
				ValueFormat:       collectionBlock.ValueFormat,
				SecondaryField:    collectionBlock.SecondaryField,
				SecondaryLabel:    collectionBlock.SecondaryLabel,
				SecondaryFormat:   collectionBlock.SecondaryFormat,
				ItemTitleField:    collectionBlock.ItemTitleField,
				ItemTitleLabel:    collectionBlock.ItemTitleLabel,
				ToneField:         collectionBlock.ToneField,
				ToneRules:         collectionBlock.ToneRules,
				Layout:            collectionBlock.Layout,
				BodyFormat:        collectionBlock.BodyFormat,
				BodyTemplate:      collectionBlock.BodyTemplate,
				EmptyLabel:        collectionBlock.EmptyLabel,
				CollectionContent: &collectionBlock.Content,
			})
		case "sectionBlock":
			sectionBlock := rawSectionBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&sectionBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] sectionBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:             sectionBlock.ID,
				Kind:           sectionBlock.Kind,
				Title:          sectionBlock.Title,
				Description:    sectionBlock.Description,
				SectionContent: &sectionBlock.Content,
			})
		case "compositeBlock":
			compositeBlock := rawCompositeBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&compositeBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] compositeBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:               compositeBlock.ID,
				Kind:             compositeBlock.Kind,
				Title:            compositeBlock.Title,
				Description:      compositeBlock.Description,
				ChildBlockIDs:    compositeBlock.ChildBlockIDs,
				CompositeContent: &compositeBlock.Content,
			})
		case "tabGroupBlock":
			tabGroupBlock := rawTabGroupBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&tabGroupBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] tabGroupBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:               tabGroupBlock.ID,
				Kind:             tabGroupBlock.Kind,
				Title:            tabGroupBlock.Title,
				SectionIDs:       tabGroupBlock.SectionIDs,
				DefaultSectionID: tabGroupBlock.DefaultSectionID,
				TabGroupContent:  &tabGroupBlock.Content,
			})
		case "stepperBlock":
			stepperBlock := rawStepperBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&stepperBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] stepperBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:             stepperBlock.ID,
				Kind:           stepperBlock.Kind,
				Title:          stepperBlock.Title,
				Description:    stepperBlock.Description,
				StepperContent: &stepperBlock.Content,
			})
		case "infoPanelBlock":
			infoPanelBlock := rawInfoPanelBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&infoPanelBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] infoPanelBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:               infoPanelBlock.ID,
				Kind:             infoPanelBlock.Kind,
				Title:            infoPanelBlock.Title,
				Description:      infoPanelBlock.Description,
				InfoPanelContent: &infoPanelBlock.Content,
			})
		case "calloutBlock":
			calloutBlock := rawCalloutBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&calloutBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] calloutBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:             calloutBlock.ID,
				Kind:           calloutBlock.Kind,
				Title:          calloutBlock.Title,
				Icon:           calloutBlock.Icon,
				Description:    calloutBlock.Description,
				Tone:           calloutBlock.Tone,
				Badges:         calloutBlock.Badges,
				CalloutContent: &calloutBlock.Content,
			})
		case "kanbanBlock":
			kanbanBlock := rawKanbanBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&kanbanBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] kanbanBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:            kanbanBlock.ID,
				Kind:          kanbanBlock.Kind,
				Title:         kanbanBlock.Title,
				Description:   kanbanBlock.Description,
				KanbanContent: &kanbanBlock.Content,
			})
		case "timelineBlock":
			timelineBlock := rawTimelineBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&timelineBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] timelineBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:              timelineBlock.ID,
				Kind:            timelineBlock.Kind,
				Title:           timelineBlock.Title,
				Description:     timelineBlock.Description,
				TimelineContent: &timelineBlock.Content,
			})
		case "filterBarBlock":
			filterBarBlock := rawFilterBarBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&filterBarBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] filterBarBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:               filterBarBlock.ID,
				Kind:             filterBarBlock.Kind,
				Title:            filterBarBlock.Title,
				DatasetRef:       filterBarBlock.DatasetRef,
				ParamIDs:         filterBarBlock.ParamIDs,
				Mode:             filterBarBlock.Mode,
				Placement:        filterBarBlock.Placement,
				GroupOrder:       filterBarBlock.GroupOrder,
				VisibleGroups:    filterBarBlock.VisibleGroups,
				CollapsedGroups:  filterBarBlock.CollapsedGroups,
				FilterBarContent: &filterBarBlock.Content,
			})
		case "refinementBarBlock":
			refinementBarBlock := rawRefinementBarBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&refinementBarBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] refinementBarBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:                   refinementBarBlock.ID,
				Kind:                 refinementBarBlock.Kind,
				Title:                refinementBarBlock.Title,
				RefinementBarContent: &refinementBarBlock.Content,
			})
		case "markdownBlock":
			markdownBlock := rawMarkdownBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&markdownBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] markdownBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:              markdownBlock.ID,
				Kind:            markdownBlock.Kind,
				Title:           markdownBlock.Title,
				Markdown:        markdownBlock.Markdown,
				MarkdownContent: &markdownBlock.Content,
			})
		case "geoMapBlock":
			geoMapBlock := rawGeoMapBlock{}
			decoder := json.NewDecoder(bytes.NewReader(block))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&geoMapBlock); err != nil {
				return nil, fmt.Errorf("decode reportFill.blocks[%d] geoMapBlock: %w", index, err)
			}
			fill.Blocks = append(fill.Blocks, Block{
				ID:         geoMapBlock.ID,
				Kind:       geoMapBlock.Kind,
				Title:      geoMapBlock.Title,
				DatasetRef: geoMapBlock.DatasetRef,
				Geo:        geoMapBlock.Geo,
				GeoContent: &geoMapBlock.Content,
			})
		default:
			fill.Blocks = append(fill.Blocks, Block{
				ID:         header.ID,
				Kind:       header.Kind,
				Title:      header.Title,
				DatasetRef: header.DatasetRef,
			})
		}
		if len(fill.Blocks) > blockCountBefore && len(runtime) > 0 {
			fill.Blocks[len(fill.Blocks)-1].Runtime = runtime
		}
	}
	if err := fill.Validate(); err != nil {
		return nil, err
	}
	return fill, nil
}

func extractFillBlockRuntime(payload json.RawMessage, label string) (map[string]any, json.RawMessage, error) {
	fields := map[string]json.RawMessage{}
	if err := json.Unmarshal(payload, &fields); err != nil {
		return nil, nil, fmt.Errorf("decode %s: %w", label, err)
	}
	runtime := map[string]any{}
	if rawRuntime, ok := fields["runtime"]; ok {
		if err := json.Unmarshal(rawRuntime, &runtime); err != nil {
			return nil, nil, fmt.Errorf("decode %s.runtime: %w", label, err)
		}
		delete(fields, "runtime")
	}
	sanitized, err := json.Marshal(fields)
	if err != nil {
		return nil, nil, fmt.Errorf("normalize %s: %w", label, err)
	}
	return runtime, sanitized, nil
}

func (r *ReportFill) Validate() error {
	if r == nil {
		return fmt.Errorf("reportFill is required")
	}
	if r.Version < 1 {
		return fmt.Errorf("reportFill.version must be >= 1")
	}
	if strings.TrimSpace(r.Kind) != "reportFill" {
		return fmt.Errorf("reportFill.kind must be reportFill")
	}
	if r.SpecVersion < 1 {
		return fmt.Errorf("reportFill.specVersion must be >= 1")
	}
	if strings.TrimSpace(r.SpecHash) == "" {
		return fmt.Errorf("reportFill.specHash is required")
	}
	if strings.TrimSpace(r.Source.Kind) == "" || strings.TrimSpace(r.Source.ContainerID) == "" || strings.TrimSpace(r.Source.StateKey) == "" || strings.TrimSpace(r.Source.DataSourceRef) == "" {
		return fmt.Errorf("reportFill.source.kind, containerId, stateKey, and dataSourceRef are required")
	}
	if len(r.Datasets) == 0 {
		return fmt.Errorf("reportFill.datasets must not be empty")
	}
	for index, dataset := range r.Datasets {
		if strings.TrimSpace(dataset.ID) == "" {
			return fmt.Errorf("reportFill.datasets[%d].id is required", index)
		}
		if strings.TrimSpace(dataset.DataSourceRef) == "" {
			return fmt.Errorf("reportFill.datasets[%d].dataSourceRef is required", index)
		}
		requestHash, err := computeRequestHash(dataset)
		if err != nil {
			return fmt.Errorf("reportFill.datasets[%d].request: %w", index, err)
		}
		if dataset.Request.Kind == "staticCsv" || dataset.Request.Kind == "staticJson" {
			if strings.TrimSpace(dataset.Request.Format) == "" {
				return fmt.Errorf("reportFill.datasets[%d].request.format is required", index)
			}
			if dataset.Request.RowCount == nil || *dataset.Request.RowCount < 0 {
				return fmt.Errorf("reportFill.datasets[%d].request.rowCount must be >= 0", index)
			}
			if dataset.Request.ColumnKeys == nil {
				return fmt.Errorf("reportFill.datasets[%d].request.columnKeys is required", index)
			}
		} else if dataset.Request.Limit == nil {
			return fmt.Errorf("reportFill.datasets[%d].request.limit is required", index)
		} else if *dataset.Request.Limit < 1 {
			return fmt.Errorf("reportFill.datasets[%d].request.limit must be >= 1", index)
		} else if dataset.Request.Offset == nil {
			return fmt.Errorf("reportFill.datasets[%d].request.offset is required", index)
		} else if *dataset.Request.Offset < 0 {
			return fmt.Errorf("reportFill.datasets[%d].request.offset must be >= 0", index)
		}
		if dataset.Request.TimeoutMs != nil && *dataset.Request.TimeoutMs < 0 {
			return fmt.Errorf("reportFill.datasets[%d].request.timeoutMs must be >= 0", index)
		}
		for orderIndex, entry := range dataset.Request.OrderBy {
			if strings.TrimSpace(entry) == "" {
				return fmt.Errorf("reportFill.datasets[%d].request.orderBy[%d] must not be blank", index, orderIndex)
			}
		}
		if dataset.Request.SemanticSelection != nil {
			selection := dataset.Request.SemanticSelection
			if strings.TrimSpace(selection.ModelRef) == "" {
				return fmt.Errorf("reportFill.datasets[%d].request.semanticSelection.modelRef is required", index)
			}
			if strings.TrimSpace(selection.Entity) == "" {
				return fmt.Errorf("reportFill.datasets[%d].request.semanticSelection.entity is required", index)
			}
			if selection.Selection.Dimensions == nil {
				return fmt.Errorf("reportFill.datasets[%d].request.semanticSelection.selection.dimensions is required", index)
			}
			if selection.Selection.Measures == nil {
				return fmt.Errorf("reportFill.datasets[%d].request.semanticSelection.selection.measures is required", index)
			}
			if selection.Refinements == nil {
				return fmt.Errorf("reportFill.datasets[%d].request.semanticSelection.refinements is required", index)
			}
			if selection.Parameters == nil {
				return fmt.Errorf("reportFill.datasets[%d].request.semanticSelection.parameters is required", index)
			}
		}
		if strings.TrimSpace(dataset.Provenance.RequestHash) == "" {
			return fmt.Errorf("reportFill.datasets[%d].provenance.requestHash is required", index)
		}
		if strings.TrimSpace(dataset.Provenance.RequestHash) != requestHash {
			return fmt.Errorf("reportFill.datasets[%d].provenance.requestHash must match request", index)
		}
		if dataset.Provenance.RowCount != len(dataset.Rows) {
			return fmt.Errorf("reportFill.datasets[%d].provenance.rowCount must match rows length", index)
		}
	}
	if len(r.Blocks) == 0 {
		return fmt.Errorf("reportFill.blocks must not be empty")
	}
	for index, block := range r.Blocks {
		if strings.TrimSpace(block.ID) == "" {
			return fmt.Errorf("reportFill.blocks[%d].id is required", index)
		}
		if strings.TrimSpace(block.Kind) == "" {
			return fmt.Errorf("reportFill.blocks[%d].kind is required", index)
		}
		if strings.TrimSpace(block.Kind) == "tableBlock" {
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportFill.blocks[%d].datasetRef is required for tableBlock", index)
			}
			if len(block.Columns) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].columns must not be empty for tableBlock", index)
			}
			if block.Content == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for tableBlock", index)
			}
			if len(block.Content.Columns) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.columns must not be empty for tableBlock", index)
			}
			for rowIndex, row := range block.Content.ResolvedRows {
				if row.RowIndex < 0 {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].rowIndex must be >= 0 for tableBlock", index, rowIndex)
				}
				if row.Cells == nil {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells is required for tableBlock", index, rowIndex)
				}
				for cellIndex, cell := range row.Cells {
					if strings.TrimSpace(cell.Key) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].key is required for tableBlock", index, rowIndex, cellIndex)
					}
					if strings.TrimSpace(cell.SourceKey) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].sourceKey is required for tableBlock", index, rowIndex, cellIndex)
					}
					if strings.TrimSpace(cell.DisplayKey) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].displayKey is required for tableBlock", index, rowIndex, cellIndex)
					}
				}
			}
			for rowIndex, row := range block.Content.ResolvedRows {
				for cellIndex, cell := range row.Cells {
					if cell.VisualState == nil {
						continue
					}
					switch strings.TrimSpace(cell.VisualState.Kind) {
					case "dataBar", "progressBar", "sparkBar":
						if cell.VisualState.Value == nil {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.value is required for %s", index, rowIndex, cellIndex, strings.TrimSpace(cell.VisualState.Kind))
						}
						if cell.VisualState.Percent == nil {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.percent is required for %s", index, rowIndex, cellIndex, strings.TrimSpace(cell.VisualState.Kind))
						}
						if cell.VisualState.Palette == nil {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.palette is required for %s", index, rowIndex, cellIndex, strings.TrimSpace(cell.VisualState.Kind))
						}
					case "shareBar":
						if len(cell.VisualState.Segments) == 0 {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.segments is required for shareBar", index, rowIndex, cellIndex)
						}
						for segmentIndex, segment := range cell.VisualState.Segments {
							if strings.TrimSpace(segment.Label) == "" {
								return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.segments[%d].label is required for shareBar", index, rowIndex, cellIndex, segmentIndex)
							}
							if strings.TrimSpace(segment.Color) == "" {
								return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.segments[%d].color is required for shareBar", index, rowIndex, cellIndex, segmentIndex)
							}
						}
					case "badge", "tone", "delta", "rank":
						if strings.TrimSpace(cell.VisualState.Tone) == "" {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.tone is required for %s", index, rowIndex, cellIndex, strings.TrimSpace(cell.VisualState.Kind))
						}
						if strings.TrimSpace(cell.VisualState.Label) == "" {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.label is required for %s", index, rowIndex, cellIndex, strings.TrimSpace(cell.VisualState.Kind))
						}
					default:
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.kind %q is not supported", index, rowIndex, cellIndex, cell.VisualState.Kind)
					}
				}
			}
		}
		if strings.TrimSpace(block.Kind) == "chartBlock" {
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportFill.blocks[%d].datasetRef is required for chartBlock", index)
			}
			if len(block.ChartSpec) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].chartSpec is required for chartBlock", index)
			}
			if len(block.ChartModel) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].chartModel is required for chartBlock", index)
			}
			if block.ChartContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for chartBlock", index)
			}
			if len(block.ChartContent.ChartSpec) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.chartSpec is required for chartBlock", index)
			}
			if len(block.ChartContent.ChartModel) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.chartModel is required for chartBlock", index)
			}
			if block.ChartContent.RowCount == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.rowCount is required for chartBlock", index)
			}
			if block.ChartContent.ResolvedChart == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart is required for chartBlock", index)
			}
			if strings.TrimSpace(block.ChartContent.ResolvedChart.Kind) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.kind is required for chartBlock", index)
			}
			if strings.TrimSpace(block.ChartContent.ResolvedChart.Type) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.type is required for chartBlock", index)
			}
			if block.ChartContent.ResolvedChart.SeriesKeys == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.seriesKeys is required for chartBlock", index)
			}
			if len(block.ChartContent.ResolvedChart.SeriesKeys) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.seriesKeys must not be empty for chartBlock", index)
			}
			for seriesIndex, seriesKey := range block.ChartContent.ResolvedChart.SeriesKeys {
				if strings.TrimSpace(seriesKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.seriesKeys[%d] must not be blank for chartBlock", index, seriesIndex)
				}
			}
			if block.ChartContent.ResolvedChart.Rows == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.rows is required for chartBlock", index)
			}
			switch strings.TrimSpace(block.ChartContent.ResolvedChart.Kind) {
			case "directSeries":
				if strings.TrimSpace(block.ChartContent.ResolvedChart.XAxisKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.xAxisKey is required for directSeries", index)
				}
			case "groupedSeries":
				if strings.TrimSpace(block.ChartContent.ResolvedChart.XAxisKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.xAxisKey is required for groupedSeries", index)
				}
				if strings.TrimSpace(block.ChartContent.ResolvedChart.NameKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.nameKey is required for groupedSeries", index)
				}
				if strings.TrimSpace(block.ChartContent.ResolvedChart.ValueKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.valueKey is required for groupedSeries", index)
				}
			case "category":
				if strings.TrimSpace(block.ChartContent.ResolvedChart.NameKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.nameKey is required for category", index)
				}
				if strings.TrimSpace(block.ChartContent.ResolvedChart.ValueKey) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.valueKey is required for category", index)
				}
			default:
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedChart.kind %q is not supported", index, block.ChartContent.ResolvedChart.Kind)
			}
		}
		if strings.TrimSpace(block.Kind) == "kpiBlock" {
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].title is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportFill.blocks[%d].datasetRef is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.ValueField) == "" {
				return fmt.Errorf("reportFill.blocks[%d].valueField is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.ValueLabel) == "" {
				return fmt.Errorf("reportFill.blocks[%d].valueLabel is required for kpiBlock", index)
			}
			if !isAllowedReportValueFormat(block.ValueFormat) {
				return fmt.Errorf("reportFill.blocks[%d].valueFormat %q is not supported for kpiBlock", index, block.ValueFormat)
			}
			if !isAllowedReportValueFormat(block.SecondaryFormat) {
				return fmt.Errorf("reportFill.blocks[%d].secondaryFormat %q is not supported for kpiBlock", index, block.SecondaryFormat)
			}
			if !isAllowedReportRowSelector(block.RowSelector) {
				return fmt.Errorf("reportFill.blocks[%d].rowSelector %q is not supported for kpiBlock", index, block.RowSelector)
			}
			if !isAllowedReportPresentationMode(block.PresentationMode) {
				return fmt.Errorf("reportFill.blocks[%d].presentationMode %q is not supported for kpiBlock", index, block.PresentationMode)
			}
			if !isAllowedReportBodyFormat(block.BodyFormat) {
				return fmt.Errorf("reportFill.blocks[%d].bodyFormat %q is not supported for kpiBlock", index, block.BodyFormat)
			}
			if block.KPIContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.KPIContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.KPIContent.ValueField) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.valueField is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.KPIContent.ValueLabel) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.valueLabel is required for kpiBlock", index)
			}
			if !isAllowedReportValueFormat(block.KPIContent.ValueFormat) {
				return fmt.Errorf("reportFill.blocks[%d].content.valueFormat %q is not supported for kpiBlock", index, block.KPIContent.ValueFormat)
			}
			if !isAllowedReportValueFormat(block.KPIContent.SecondaryFormat) {
				return fmt.Errorf("reportFill.blocks[%d].content.secondaryFormat %q is not supported for kpiBlock", index, block.KPIContent.SecondaryFormat)
			}
			if !isAllowedReportRowSelector(block.KPIContent.RowSelector) {
				return fmt.Errorf("reportFill.blocks[%d].content.rowSelector %q is not supported for kpiBlock", index, block.KPIContent.RowSelector)
			}
			if !isAllowedReportPresentationMode(block.KPIContent.PresentationMode) {
				return fmt.Errorf("reportFill.blocks[%d].content.presentationMode %q is not supported for kpiBlock", index, block.KPIContent.PresentationMode)
			}
			if !isAllowedReportBodyFormat(block.KPIContent.BodyFormat) {
				return fmt.Errorf("reportFill.blocks[%d].content.bodyFormat %q is not supported for kpiBlock", index, block.KPIContent.BodyFormat)
			}
			if block.KPIContent.RowCount == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.rowCount is required for kpiBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "collectionBlock" {
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportFill.blocks[%d].datasetRef is required for collectionBlock", index)
			}
			if block.CollectionContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for collectionBlock", index)
			}
			if strings.TrimSpace(block.CollectionContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for collectionBlock", index)
			}
			if strings.TrimSpace(block.CollectionContent.Layout) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.layout is required for collectionBlock", index)
			}
			if !isAllowedCollectionLayout(block.Layout) && strings.TrimSpace(block.Layout) != "" {
				return fmt.Errorf("reportFill.blocks[%d].layout %q is not supported for collectionBlock", index, block.Layout)
			}
			if !isAllowedCollectionLayout(block.CollectionContent.Layout) {
				return fmt.Errorf("reportFill.blocks[%d].content.layout %q is not supported for collectionBlock", index, block.CollectionContent.Layout)
			}
			if !isAllowedReportValueFormat(block.ValueFormat) {
				return fmt.Errorf("reportFill.blocks[%d].valueFormat %q is not supported for collectionBlock", index, block.ValueFormat)
			}
			if !isAllowedReportValueFormat(block.SecondaryFormat) {
				return fmt.Errorf("reportFill.blocks[%d].secondaryFormat %q is not supported for collectionBlock", index, block.SecondaryFormat)
			}
			if !isAllowedReportBodyFormat(block.BodyFormat) {
				return fmt.Errorf("reportFill.blocks[%d].bodyFormat %q is not supported for collectionBlock", index, block.BodyFormat)
			}
			if block.CollectionContent.Columns < 1 {
				return fmt.Errorf("reportFill.blocks[%d].content.columns must be >= 1 for collectionBlock", index)
			}
			if block.CollectionContent.Columns > 4 {
				return fmt.Errorf("reportFill.blocks[%d].content.columns must be <= 4 for collectionBlock", index)
			}
			if block.CollectionContent.RowLimit < 1 {
				return fmt.Errorf("reportFill.blocks[%d].content.rowLimit must be >= 1 for collectionBlock", index)
			}
			if block.CollectionContent.Items == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.items is required for collectionBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "badgesBlock" {
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportFill.blocks[%d].datasetRef is required for badgesBlock", index)
			}
			if block.Items == nil {
				return fmt.Errorf("reportFill.blocks[%d].items is required for badgesBlock", index)
			}
			if block.BadgesContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for badgesBlock", index)
			}
			if strings.TrimSpace(block.BadgesContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for badgesBlock", index)
			}
			if block.BadgesContent.RowCount == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.rowCount is required for badgesBlock", index)
			}
			if *block.BadgesContent.RowCount < 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.rowCount must be >= 0 for badgesBlock", index)
			}
			if block.BadgesContent.Items == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.items is required for badgesBlock", index)
			}
			for itemIndex, item := range block.BadgesContent.Items {
				if strings.TrimSpace(item.ID) == "" {
					return fmt.Errorf("reportFill.blocks[%d].content.items[%d].id is required for badgesBlock", index, itemIndex)
				}
			}
		}
		if strings.TrimSpace(block.Kind) == "sectionBlock" {
			if block.SectionContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for sectionBlock", index)
			}
			if strings.TrimSpace(block.SectionContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for sectionBlock", index)
			}
			if strings.TrimSpace(block.SectionContent.NavigationLabel) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.navigationLabel is required for sectionBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "compositeBlock" {
			if len(block.ChildBlockIDs) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].childBlockIds must not be empty for compositeBlock", index)
			}
			if block.CompositeContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for compositeBlock", index)
			}
			if strings.TrimSpace(block.CompositeContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for compositeBlock", index)
			}
			if block.CompositeContent.ChildBlockIDs == nil || len(block.CompositeContent.ChildBlockIDs) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.childBlockIds must not be empty for compositeBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "tabGroupBlock" {
			if len(block.SectionIDs) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].sectionIds must not be empty for tabGroupBlock", index)
			}
			if block.TabGroupContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for tabGroupBlock", index)
			}
			if strings.TrimSpace(block.TabGroupContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for tabGroupBlock", index)
			}
			if block.TabGroupContent.SectionIDs == nil || len(block.TabGroupContent.SectionIDs) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.sectionIds must not be empty for tabGroupBlock", index)
			}
			if block.TabGroupContent.Tabs == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.tabs is required for tabGroupBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "stepperBlock" {
			if block.StepperContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for stepperBlock", index)
			}
			if strings.TrimSpace(block.StepperContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for stepperBlock", index)
			}
			if block.StepperContent.Steps == nil || len(block.StepperContent.Steps) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.steps must not be empty for stepperBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "infoPanelBlock" {
			if block.InfoPanelContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for infoPanelBlock", index)
			}
			if strings.TrimSpace(block.InfoPanelContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for infoPanelBlock", index)
			}
			if strings.TrimSpace(block.InfoPanelContent.Body) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.body is required for infoPanelBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "calloutBlock" {
			if block.CalloutContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for calloutBlock", index)
			}
			if strings.TrimSpace(block.CalloutContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for calloutBlock", index)
			}
			if strings.TrimSpace(block.CalloutContent.Body) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.body is required for calloutBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "kanbanBlock" {
			if block.KanbanContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for kanbanBlock", index)
			}
			if strings.TrimSpace(block.KanbanContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for kanbanBlock", index)
			}
			if block.KanbanContent.Columns == nil || len(block.KanbanContent.Columns) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.columns must not be empty for kanbanBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "timelineBlock" {
			if block.TimelineContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for timelineBlock", index)
			}
			if strings.TrimSpace(block.TimelineContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for timelineBlock", index)
			}
			if block.TimelineContent.Events == nil || len(block.TimelineContent.Events) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.events must not be empty for timelineBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "filterBarBlock" {
			if block.FilterBarContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for filterBarBlock", index)
			}
			if strings.TrimSpace(block.FilterBarContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for filterBarBlock", index)
			}
			if block.FilterBarContent.Params == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.params is required for filterBarBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "refinementBarBlock" {
			if block.RefinementBarContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for refinementBarBlock", index)
			}
			if block.RefinementBarContent.Refinements == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.refinements is required for refinementBarBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "markdownBlock" {
			if block.MarkdownContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for markdownBlock", index)
			}
			if strings.TrimSpace(block.MarkdownContent.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.title is required for markdownBlock", index)
			}
			if strings.TrimSpace(block.MarkdownContent.Markdown) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.markdown is required for markdownBlock", index)
			}
		}
		if strings.TrimSpace(block.Kind) == "geoMapBlock" {
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportFill.blocks[%d].title is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportFill.blocks[%d].datasetRef is required for geoMapBlock", index)
			}
			if len(block.Geo) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].geo is required for geoMapBlock", index)
			}
			if block.GeoContent == nil {
				return fmt.Errorf("reportFill.blocks[%d].content is required for geoMapBlock", index)
			}
			if len(block.GeoContent.Geo) == 0 {
				return fmt.Errorf("reportFill.blocks[%d].content.geo is required for geoMapBlock", index)
			}
			if block.GeoContent.RowCount == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.rowCount is required for geoMapBlock", index)
			}
			if block.GeoContent.ResolvedGeo == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.Shape) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.shape is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.KeyField) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.keyField is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.LabelField) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.labelField is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.MetricKey) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.metricKey is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.MetricLabel) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.metricLabel is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.Format) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.format is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.Aggregate) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.aggregate is required for geoMapBlock", index)
			}
			if block.GeoContent.ResolvedGeo.Regions == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.regions is required for geoMapBlock", index)
			}
			if block.GeoContent.ResolvedGeo.Ranking == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.ranking is required for geoMapBlock", index)
			}
			for regionIndex, region := range block.GeoContent.ResolvedGeo.Regions {
				if err := validateResolvedGeoRegion(region, fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.regions[%d]", index, regionIndex)); err != nil {
					return err
				}
			}
			for regionIndex, region := range block.GeoContent.ResolvedGeo.Ranking {
				if err := validateResolvedGeoRegion(region, fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.ranking[%d]", index, regionIndex)); err != nil {
					return err
				}
			}
			if block.GeoContent.ResolvedGeo.ActiveRegion != nil {
				if err := validateResolvedGeoRegion(*block.GeoContent.ResolvedGeo.ActiveRegion, fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.activeRegion", index)); err != nil {
					return err
				}
			}
			if block.GeoContent.ResolvedGeo.Summary == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.summary is required for geoMapBlock", index)
			}
			if block.GeoContent.ResolvedGeo.Summary.RegionCount == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.summary.regionCount is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.Summary.TotalValue) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.summary.totalValue is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.GeoContent.ResolvedGeo.Summary.TopKey) == "" {
				return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.summary.topKey is required for geoMapBlock", index)
			}
			if block.GeoContent.ResolvedGeo.Legend != nil {
				hasRules := len(block.GeoContent.ResolvedGeo.Legend.Rules) > 0
				hasRangeFields := strings.TrimSpace(block.GeoContent.ResolvedGeo.Legend.Min) != "" ||
					strings.TrimSpace(block.GeoContent.ResolvedGeo.Legend.Max) != "" ||
					len(block.GeoContent.ResolvedGeo.Legend.Palette) > 0
				if !hasRules && !hasRangeFields {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend must define rules or range for geoMapBlock", index)
				}
				if hasRules && hasRangeFields {
					return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend must use either rules or range for geoMapBlock", index)
				}
				for legendIndex, rule := range block.GeoContent.ResolvedGeo.Legend.Rules {
					if strings.TrimSpace(rule.Color) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend.rules[%d].color is required for geoMapBlock", index, legendIndex)
					}
					if strings.TrimSpace(rule.Label) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend.rules[%d].label is required for geoMapBlock", index, legendIndex)
					}
				}
				if hasRangeFields {
					if strings.TrimSpace(block.GeoContent.ResolvedGeo.Legend.Min) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend.min is required for range geoMapBlock legend", index)
					}
					if strings.TrimSpace(block.GeoContent.ResolvedGeo.Legend.Max) == "" {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend.max is required for range geoMapBlock legend", index)
					}
					if len(block.GeoContent.ResolvedGeo.Legend.Palette) == 0 {
						return fmt.Errorf("reportFill.blocks[%d].content.resolvedGeo.legend.palette must not be empty for range geoMapBlock legend", index)
					}
				}
			}
		}
	}
	return nil
}

func validateResolvedGeoRegion(region ResolvedGeoRegion, path string) error {
	if strings.TrimSpace(region.Key) == "" {
		return fmt.Errorf("%s.key is required for geoMapBlock", path)
	}
	if strings.TrimSpace(region.Label) == "" {
		return fmt.Errorf("%s.label is required for geoMapBlock", path)
	}
	if strings.TrimSpace(region.DisplayValue) == "" {
		return fmt.Errorf("%s.displayValue is required for geoMapBlock", path)
	}
	if strings.TrimSpace(region.Color) == "" {
		return fmt.Errorf("%s.color is required for geoMapBlock", path)
	}
	if region.RowCount == nil {
		return fmt.Errorf("%s.rowCount is required for geoMapBlock", path)
	}
	if region.RawValue != nil {
		switch region.RawValue.(type) {
		case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		default:
			return fmt.Errorf("%s.rawValue must be numeric or null for geoMapBlock", path)
		}
	}
	return nil
}

func rejectTrailingJSON(decoder *json.Decoder, label string) error {
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("decode %s: trailing content after top-level object", label)
		}
		return fmt.Errorf("decode %s: %w", label, err)
	}
	return nil
}

func computeJSONFNV1aHash(value any) (string, error) {
	canonicalJSON, err := marshalCanonicalJSON(value)
	if err != nil {
		return "", err
	}
	var hash uint32 = 2166136261
	for _, codeUnit := range utf16.Encode([]rune(canonicalJSON)) {
		hash ^= uint32(codeUnit)
		hash *= 16777619
	}
	return fmt.Sprintf("fnv1a:%08x", hash), nil
}

func marshalCanonicalJSON(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("marshal json: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var normalized any
	if err := decoder.Decode(&normalized); err != nil {
		return "", fmt.Errorf("decode canonical json: %w", err)
	}
	buffer := new(bytes.Buffer)
	if err := writeCanonicalJSON(buffer, normalized); err != nil {
		return "", err
	}
	return buffer.String(), nil
}

func writeCanonicalJSON(buffer *bytes.Buffer, value any) error {
	switch actual := value.(type) {
	case nil:
		buffer.WriteString("null")
	case bool:
		if actual {
			buffer.WriteString("true")
		} else {
			buffer.WriteString("false")
		}
	case string:
		data, err := json.Marshal(actual)
		if err != nil {
			return fmt.Errorf("marshal canonical string: %w", err)
		}
		buffer.Write(data)
	case json.Number:
		buffer.WriteString(actual.String())
	case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		data, err := json.Marshal(actual)
		if err != nil {
			return fmt.Errorf("marshal canonical number: %w", err)
		}
		buffer.Write(data)
	case []any:
		buffer.WriteByte('[')
		for index, entry := range actual {
			if index > 0 {
				buffer.WriteByte(',')
			}
			if err := writeCanonicalJSON(buffer, entry); err != nil {
				return err
			}
		}
		buffer.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(actual))
		for key := range actual {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		buffer.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				buffer.WriteByte(',')
			}
			keyJSON, err := json.Marshal(key)
			if err != nil {
				return fmt.Errorf("marshal canonical key: %w", err)
			}
			buffer.Write(keyJSON)
			buffer.WriteByte(':')
			if err := writeCanonicalJSON(buffer, actual[key]); err != nil {
				return err
			}
		}
		buffer.WriteByte('}')
	default:
		data, err := json.Marshal(actual)
		if err != nil {
			return fmt.Errorf("marshal canonical value: %w", err)
		}
		buffer.Write(data)
	}
	return nil
}

func computeRequestHash(dataset Dataset) (string, error) {
	return computeJSONFNV1aHash(dataset.Request)
}

func computeJSONFNV1aRawHash(payload json.RawMessage) (string, error) {
	trimmed := bytes.TrimSpace(payload)
	if len(trimmed) == 0 {
		return "", fmt.Errorf("payload is required")
	}
	buffer := new(bytes.Buffer)
	if err := json.Compact(buffer, trimmed); err != nil {
		return "", fmt.Errorf("compact json: %w", err)
	}
	var hash uint32 = 2166136261
	for _, codeUnit := range utf16.Encode([]rune(buffer.String())) {
		hash ^= uint32(codeUnit)
		hash *= 16777619
	}
	return fmt.Sprintf("fnv1a:%08x", hash), nil
}

func decodeRequestPayload(payload json.RawMessage, index int) (reportspec.RequestPayload, error) {
	trimmed := bytes.TrimSpace(payload)
	if len(trimmed) == 0 {
		return reportspec.RequestPayload{}, fmt.Errorf("decode reportFill.datasets[%d].request: request is required", index)
	}
	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.DisallowUnknownFields()
	request := reportspec.RequestPayload{}
	if err := decoder.Decode(&request); err != nil {
		return reportspec.RequestPayload{}, fmt.Errorf("decode reportFill.datasets[%d].request: %w", index, err)
	}
	if err := rejectTrailingJSON(decoder, fmt.Sprintf("reportFill.datasets[%d].request", index)); err != nil {
		return reportspec.RequestPayload{}, err
	}
	return request, nil
}

func isAllowedReportValueFormat(value string) bool {
	switch strings.TrimSpace(value) {
	case "", "currency", "number", "number5", "percent", "percentFraction", "compact", "compactNumber":
		return true
	default:
		return false
	}
}

func isAllowedReportRowSelector(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "firstrow", "maxbyvalue", "minbyvalue":
		return true
	default:
		return false
	}
}

func isAllowedReportPresentationMode(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "card", "body", "both":
		return true
	default:
		return false
	}
}

func isAllowedReportBodyFormat(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "markdown":
		return true
	default:
		return false
	}
}

func isAllowedCollectionLayout(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "grid", "list":
		return true
	default:
		return false
	}
}
