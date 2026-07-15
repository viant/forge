package reportspec

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

type ReportSpec struct {
	Version          int              `json:"version"`
	Kind             string           `json:"kind"`
	Source           Source           `json:"source"`
	Title            string           `json:"title"`
	Theme            map[string]any   `json:"theme,omitempty"`
	Binding          *Binding         `json:"binding,omitempty"`
	SemanticSummary  *SemanticSummary `json:"semanticSummary,omitempty"`
	Parameters       *Parameters      `json:"parameters"`
	LayoutIntent     *LayoutIntent    `json:"layoutIntent"`
	Scope            *Scope           `json:"scope,omitempty"`
	DrillMetadata    map[string]any   `json:"drillMetadata,omitempty"`
	Refinements      []map[string]any `json:"refinements"`
	CalculatedFields []map[string]any `json:"calculatedFields"`
	Datasets         []Dataset        `json:"datasets"`
	Blocks           []Block          `json:"blocks"`
}

type Source struct {
	Kind          string `json:"kind"`
	ContainerID   string `json:"containerId"`
	StateKey      string `json:"stateKey"`
	DataSourceRef string `json:"dataSourceRef"`
}

type Binding struct {
	Mode               string   `json:"mode"`
	ModelRef           string   `json:"modelRef"`
	Entity             string   `json:"entity"`
	SelectedDimensions []string `json:"selectedDimensions"`
	SelectedMeasures   []string `json:"selectedMeasures"`
}

type SemanticSummary struct {
	Kind               string                 `json:"kind"`
	ModelRef           string                 `json:"modelRef"`
	ModelLabel         string                 `json:"modelLabel,omitempty"`
	ModelDescription   string                 `json:"modelDescription,omitempty"`
	Entity             string                 `json:"entity"`
	EntityLabel        string                 `json:"entityLabel,omitempty"`
	EntityDescription  string                 `json:"entityDescription,omitempty"`
	SelectedDimensions []SemanticSummaryField `json:"selectedDimensions"`
	SelectedMeasures   []SemanticSummaryField `json:"selectedMeasures"`
	SelectedParameters []SemanticSummaryField `json:"selectedParameters,omitempty"`
}

type SemanticSummaryField struct {
	ID            string         `json:"id"`
	RawID         string         `json:"rawId,omitempty"`
	Label         string         `json:"label"`
	Description   string         `json:"description,omitempty"`
	Format        string         `json:"format,omitempty"`
	Category      string         `json:"category,omitempty"`
	DefinitionRef string         `json:"definitionRef,omitempty"`
	Governance    map[string]any `json:"governance,omitempty"`
}

type Parameters struct {
	ViewMode   string `json:"viewMode"`
	GroupBy    string `json:"groupBy"`
	PageSize   int    `json:"pageSize"`
	OrderField string `json:"orderField"`
	OrderDir   string `json:"orderDir"`
}

type LayoutIntent struct {
	Kind               string             `json:"kind"`
	ResultPanePosition string             `json:"resultPanePosition"`
	BlockOrder         []string           `json:"blockOrder"`
	Items              []LayoutIntentItem `json:"items,omitempty"`
}

type LayoutIntentItem struct {
	BlockID string `json:"blockId"`
	Size    string `json:"size,omitempty"`
}

type Scope struct {
	Params        []ScopeParam `json:"params"`
	DataSourceRef string       `json:"dataSourceRef"`
}

type ScopeParamOption struct {
	Label       string `json:"label"`
	Value       any    `json:"value"`
	Icon        string `json:"icon,omitempty"`
	Default     *bool  `json:"default,omitempty"`
	Description string `json:"description,omitempty"`
}

type ScopeParam struct {
	ID           string             `json:"id"`
	Kind         string             `json:"kind"`
	Label        string             `json:"label"`
	Description  string             `json:"description,omitempty"`
	DatasetRef   string             `json:"datasetRef,omitempty"`
	Required     bool               `json:"required"`
	Multiple     bool               `json:"multiple,omitempty"`
	Presentation string             `json:"presentation,omitempty"`
	Options      []ScopeParamOption `json:"options,omitempty"`
	Value        any                `json:"value"`
}

type Dataset struct {
	ID            string         `json:"id"`
	DataSourceRef string         `json:"dataSourceRef"`
	Request       RequestPayload `json:"request"`
}

type RequestPayload struct {
	Measures          map[string]bool    `json:"measures,omitempty"`
	Dimensions        map[string]bool    `json:"dimensions,omitempty"`
	Filters           map[string]any     `json:"filters,omitempty"`
	SemanticSelection *SemanticSelection `json:"semanticSelection,omitempty"`
	Refinements       []map[string]any   `json:"refinements,omitempty"`
	Limit             *int               `json:"limit"`
	Offset            *int               `json:"offset"`
	TimeoutMs         *int               `json:"timeoutMs,omitempty"`
	OrderBy           []string           `json:"orderBy,omitempty"`
}

type SemanticSelection struct {
	ModelRef    string                  `json:"modelRef"`
	Entity      string                  `json:"entity"`
	Selection   SemanticSelectionItems  `json:"selection"`
	Refinements []map[string]any        `json:"refinements"`
	Parameters  map[string]any          `json:"parameters"`
	Unmapped    *SemanticSelectionItems `json:"unmapped,omitempty"`
}

type SemanticSelectionItems struct {
	Dimensions []string `json:"dimensions"`
	Measures   []string `json:"measures"`
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

type StepperStep struct {
	ID    string `json:"id"`
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
	Tone  string `json:"tone,omitempty"`
}

type KanbanCard struct {
	ID    string `json:"id"`
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
	Badge string `json:"badge,omitempty"`
	Tone  string `json:"tone,omitempty"`
}

type KanbanColumn struct {
	ID    string       `json:"id"`
	Title string       `json:"title,omitempty"`
	Tone  string       `json:"tone,omitempty"`
	Cards []KanbanCard `json:"cards,omitempty"`
}

type TimelineEvent struct {
	ID    string `json:"id"`
	Date  string `json:"date,omitempty"`
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
	Badge string `json:"badge,omitempty"`
	Tone  string `json:"tone,omitempty"`
}

type Block struct {
	ID                       string          `json:"id"`
	Kind                     string          `json:"kind"`
	Title                    string          `json:"title,omitempty"`
	DatasetRef               string          `json:"datasetRef,omitempty"`
	Columns                  []TableColumn   `json:"columns,omitempty"`
	ChartSpec                map[string]any  `json:"chartSpec,omitempty"`
	ChartModel               map[string]any  `json:"chartModel,omitempty"`
	ValueField               string          `json:"valueField,omitempty"`
	ValueLabel               string          `json:"valueLabel,omitempty"`
	ValueFormat              string          `json:"valueFormat,omitempty"`
	SecondaryField           string          `json:"secondaryField,omitempty"`
	SecondaryLabel           string          `json:"secondaryLabel,omitempty"`
	SecondaryFormat          string          `json:"secondaryFormat,omitempty"`
	SecondaryDisplayKey      string          `json:"secondaryDisplayKey,omitempty"`
	SecondaryDisplayValueMap map[string]any  `json:"secondaryDisplayValueMap,omitempty"`
	Description              string          `json:"description,omitempty"`
	EmptyLabel               string          `json:"emptyLabel,omitempty"`
	RowSelector              string          `json:"rowSelector,omitempty"`
	PresentationMode         string          `json:"presentationMode,omitempty"`
	ParamIDs                 []string        `json:"paramIds,omitempty"`
	Mode                     string          `json:"mode,omitempty"`
	Placement                string          `json:"placement,omitempty"`
	GroupOrder               []string        `json:"groupOrder,omitempty"`
	VisibleGroups            []string        `json:"visibleGroups,omitempty"`
	CollapsedGroups          []string        `json:"collapsedGroups,omitempty"`
	ActionKinds              []string        `json:"actionKinds,omitempty"`
	Markdown                 string          `json:"markdown,omitempty"`
	Geo                      map[string]any  `json:"geo,omitempty"`
	Subtitle                 string          `json:"subtitle,omitempty"`
	NavigationLabel          string          `json:"navigationLabel,omitempty"`
	ChildBlockIDs            []string        `json:"childBlockIds,omitempty"`
	SectionIDs               []string        `json:"sectionIds,omitempty"`
	DefaultSectionID         string          `json:"defaultSectionId,omitempty"`
	Steps                    []StepperStep   `json:"steps,omitempty"`
	Eyebrow                  string          `json:"eyebrow,omitempty"`
	Icon                     string          `json:"icon,omitempty"`
	Tone                     string          `json:"tone,omitempty"`
	Badges                   []string        `json:"badges,omitempty"`
	BodyFormat               string          `json:"bodyFormat,omitempty"`
	Body                     string          `json:"body,omitempty"`
	ColumnsLayout            []KanbanColumn  `json:"columns,omitempty"`
	Events                   []TimelineEvent `json:"events,omitempty"`
	CollectionCols           int             `json:"columnsCount,omitempty"`
	ItemTitleField           string          `json:"itemTitleField,omitempty"`
	ItemTitleLabel           string          `json:"itemTitleLabel,omitempty"`
	Layout                   string          `json:"layout,omitempty"`
	RowLimit                 *int            `json:"rowLimit,omitempty"`
	BodyTemplate             string          `json:"bodyTemplate,omitempty"`
}

type rawReportSpec struct {
	Version          int               `json:"version"`
	Kind             string            `json:"kind"`
	Source           Source            `json:"source"`
	Title            string            `json:"title"`
	Theme            map[string]any    `json:"theme,omitempty"`
	Binding          *Binding          `json:"binding,omitempty"`
	SemanticSummary  *SemanticSummary  `json:"semanticSummary,omitempty"`
	Parameters       *Parameters       `json:"parameters"`
	LayoutIntent     *LayoutIntent     `json:"layoutIntent"`
	Scope            *Scope            `json:"scope,omitempty"`
	DrillMetadata    map[string]any    `json:"drillMetadata,omitempty"`
	Refinements      []map[string]any  `json:"refinements"`
	CalculatedFields []map[string]any  `json:"calculatedFields"`
	Datasets         []Dataset         `json:"datasets"`
	Blocks           []json.RawMessage `json:"blocks"`
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
}

type rawChartBlock struct {
	ID         string         `json:"id"`
	Kind       string         `json:"kind"`
	Title      string         `json:"title,omitempty"`
	DatasetRef string         `json:"datasetRef"`
	ChartSpec  map[string]any `json:"chartSpec"`
	ChartModel map[string]any `json:"chartModel"`
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
}

type rawFilterBarBlock struct {
	DatasetRef      string   `json:"datasetRef,omitempty"`
	ID              string   `json:"id"`
	Kind            string   `json:"kind"`
	Title           string   `json:"title"`
	ParamIDs        []string `json:"paramIds,omitempty"`
	Mode            string   `json:"mode,omitempty"`
	Placement       string   `json:"placement,omitempty"`
	GroupOrder      []string `json:"groupOrder,omitempty"`
	VisibleGroups   []string `json:"visibleGroups,omitempty"`
	CollapsedGroups []string `json:"collapsedGroups,omitempty"`
}

type rawRefinementBarBlock struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title,omitempty"`
	ActionKinds []string `json:"actionKinds,omitempty"`
	EmptyLabel  string   `json:"emptyLabel,omitempty"`
}

type rawMarkdownBlock struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	Markdown string `json:"markdown"`
}

type rawGeoMapBlock struct {
	ID         string         `json:"id"`
	Kind       string         `json:"kind"`
	Title      string         `json:"title"`
	DatasetRef string         `json:"datasetRef"`
	Geo        map[string]any `json:"geo"`
}

type rawSectionBlock struct {
	ID              string `json:"id"`
	Kind            string `json:"kind"`
	Title           string `json:"title"`
	Subtitle        string `json:"subtitle,omitempty"`
	Description     string `json:"description,omitempty"`
	NavigationLabel string `json:"navigationLabel"`
}

type rawCompositeBlock struct {
	ID            string   `json:"id"`
	Kind          string   `json:"kind"`
	Title         string   `json:"title"`
	Description   string   `json:"description,omitempty"`
	ChildBlockIDs []string `json:"childBlockIds"`
}

type rawTabGroupBlock struct {
	ID               string   `json:"id"`
	Kind             string   `json:"kind"`
	Title            string   `json:"title,omitempty"`
	SectionIDs       []string `json:"sectionIds"`
	DefaultSectionID string   `json:"defaultSectionId,omitempty"`
}

type rawStepperBlock struct {
	ID          string        `json:"id"`
	Kind        string        `json:"kind"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	Steps       []StepperStep `json:"steps"`
}

type rawInfoPanelBlock struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Title       string `json:"title"`
	Eyebrow     string `json:"eyebrow,omitempty"`
	Description string `json:"description,omitempty"`
	Tone        string `json:"tone,omitempty"`
	BodyFormat  string `json:"bodyFormat,omitempty"`
	Body        string `json:"body"`
}

type rawCalloutBlock struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	Icon        string   `json:"icon,omitempty"`
	Description string   `json:"description,omitempty"`
	Tone        string   `json:"tone,omitempty"`
	Badges      []string `json:"badges,omitempty"`
	BodyFormat  string   `json:"bodyFormat,omitempty"`
	Body        string   `json:"body"`
}

type rawKanbanBlock struct {
	ID          string         `json:"id"`
	Kind        string         `json:"kind"`
	Title       string         `json:"title"`
	Description string         `json:"description,omitempty"`
	Columns     []KanbanColumn `json:"columns"`
}

type rawTimelineBlock struct {
	ID          string          `json:"id"`
	Kind        string          `json:"kind"`
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	Events      []TimelineEvent `json:"events"`
}

type rawCollectionBlock struct {
	ID              string `json:"id"`
	Kind            string `json:"kind"`
	Title           string `json:"title"`
	Description     string `json:"description,omitempty"`
	DatasetRef      string `json:"datasetRef"`
	ItemTitleField  string `json:"itemTitleField"`
	ItemTitleLabel  string `json:"itemTitleLabel,omitempty"`
	ValueField      string `json:"valueField,omitempty"`
	ValueLabel      string `json:"valueLabel,omitempty"`
	ValueFormat     string `json:"valueFormat,omitempty"`
	SecondaryField  string `json:"secondaryField,omitempty"`
	SecondaryLabel  string `json:"secondaryLabel,omitempty"`
	SecondaryFormat string `json:"secondaryFormat,omitempty"`
	Layout          string `json:"layout"`
	Columns         int    `json:"columns"`
	RowLimit        int    `json:"rowLimit"`
	BodyFormat      string `json:"bodyFormat,omitempty"`
	BodyTemplate    string `json:"bodyTemplate,omitempty"`
	EmptyLabel      string `json:"emptyLabel,omitempty"`
}

func DecodeJSON(data []byte) (*ReportSpec, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var raw rawReportSpec
	if err := decoder.Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode reportSpec: %w", err)
	}
	if err := rejectTrailingJSON(decoder, "reportSpec"); err != nil {
		return nil, err
	}
	spec := &ReportSpec{
		Version:          raw.Version,
		Kind:             raw.Kind,
		Source:           raw.Source,
		Title:            raw.Title,
		Theme:            raw.Theme,
		Binding:          raw.Binding,
		SemanticSummary:  raw.SemanticSummary,
		Parameters:       raw.Parameters,
		LayoutIntent:     raw.LayoutIntent,
		Scope:            raw.Scope,
		DrillMetadata:    raw.DrillMetadata,
		Refinements:      raw.Refinements,
		CalculatedFields: raw.CalculatedFields,
		Datasets:         raw.Datasets,
		Blocks:           make([]Block, 0, len(raw.Blocks)),
	}
	for index, block := range raw.Blocks {
		parsedBlock, err := decodeBlock(block, index)
		if err != nil {
			return nil, err
		}
		spec.Blocks = append(spec.Blocks, parsedBlock)
	}
	if err := spec.Validate(); err != nil {
		return nil, err
	}
	return spec, nil
}

func (r *ReportSpec) Validate() error {
	if r == nil {
		return fmt.Errorf("reportSpec is required")
	}
	if r.Version < 1 {
		return fmt.Errorf("reportSpec.version must be >= 1")
	}
	if strings.TrimSpace(r.Kind) != "reportSpec" {
		return fmt.Errorf("reportSpec.kind must be reportSpec")
	}
	if strings.TrimSpace(r.Source.Kind) == "" || strings.TrimSpace(r.Source.ContainerID) == "" || strings.TrimSpace(r.Source.StateKey) == "" || strings.TrimSpace(r.Source.DataSourceRef) == "" {
		return fmt.Errorf("reportSpec.source.kind, containerId, stateKey, and dataSourceRef are required")
	}
	if strings.TrimSpace(r.Title) == "" {
		return fmt.Errorf("reportSpec.title is required")
	}
	if r.Parameters == nil {
		return fmt.Errorf("reportSpec.parameters is required")
	}
	if strings.TrimSpace(r.Parameters.ViewMode) == "" {
		return fmt.Errorf("reportSpec.parameters.viewMode is required")
	}
	if r.Parameters.PageSize < 1 {
		return fmt.Errorf("reportSpec.parameters.pageSize must be >= 1")
	}
	switch strings.TrimSpace(r.Parameters.OrderDir) {
	case "asc", "desc":
	default:
		return fmt.Errorf("reportSpec.parameters.orderDir must be asc or desc")
	}
	if r.LayoutIntent == nil {
		return fmt.Errorf("reportSpec.layoutIntent is required")
	}
	if strings.TrimSpace(r.LayoutIntent.Kind) == "" {
		return fmt.Errorf("reportSpec.layoutIntent.kind is required")
	}
	if strings.TrimSpace(r.LayoutIntent.ResultPanePosition) == "" {
		return fmt.Errorf("reportSpec.layoutIntent.resultPanePosition is required")
	}
	if len(r.LayoutIntent.BlockOrder) == 0 {
		return fmt.Errorf("reportSpec.layoutIntent.blockOrder must not be empty")
	}
	if r.Refinements == nil {
		return fmt.Errorf("reportSpec.refinements is required")
	}
	if r.CalculatedFields == nil {
		return fmt.Errorf("reportSpec.calculatedFields is required")
	}
	if len(r.Datasets) == 0 {
		return fmt.Errorf("reportSpec.datasets must not be empty")
	}
	for index, dataset := range r.Datasets {
		if strings.TrimSpace(dataset.ID) == "" {
			return fmt.Errorf("reportSpec.datasets[%d].id is required", index)
		}
		if strings.TrimSpace(dataset.DataSourceRef) == "" {
			return fmt.Errorf("reportSpec.datasets[%d].dataSourceRef is required", index)
		}
		if dataset.Request.Limit == nil {
			return fmt.Errorf("reportSpec.datasets[%d].request.limit is required", index)
		}
		if *dataset.Request.Limit < 1 {
			return fmt.Errorf("reportSpec.datasets[%d].request.limit must be >= 1", index)
		}
		if dataset.Request.Offset == nil {
			return fmt.Errorf("reportSpec.datasets[%d].request.offset is required", index)
		}
		if *dataset.Request.Offset < 0 {
			return fmt.Errorf("reportSpec.datasets[%d].request.offset must be >= 0", index)
		}
		if dataset.Request.TimeoutMs != nil && *dataset.Request.TimeoutMs < 0 {
			return fmt.Errorf("reportSpec.datasets[%d].request.timeoutMs must be >= 0", index)
		}
		for orderIndex, entry := range dataset.Request.OrderBy {
			if strings.TrimSpace(entry) == "" {
				return fmt.Errorf("reportSpec.datasets[%d].request.orderBy[%d] must not be blank", index, orderIndex)
			}
		}
		if dataset.Request.SemanticSelection != nil {
			selection := dataset.Request.SemanticSelection
			if strings.TrimSpace(selection.ModelRef) == "" {
				return fmt.Errorf("reportSpec.datasets[%d].request.semanticSelection.modelRef is required", index)
			}
			if strings.TrimSpace(selection.Entity) == "" {
				return fmt.Errorf("reportSpec.datasets[%d].request.semanticSelection.entity is required", index)
			}
			if selection.Selection.Dimensions == nil {
				return fmt.Errorf("reportSpec.datasets[%d].request.semanticSelection.selection.dimensions is required", index)
			}
			if selection.Selection.Measures == nil {
				return fmt.Errorf("reportSpec.datasets[%d].request.semanticSelection.selection.measures is required", index)
			}
			if selection.Refinements == nil {
				return fmt.Errorf("reportSpec.datasets[%d].request.semanticSelection.refinements is required", index)
			}
			if selection.Parameters == nil {
				return fmt.Errorf("reportSpec.datasets[%d].request.semanticSelection.parameters is required", index)
			}
		}
	}
	if len(r.Blocks) == 0 {
		return fmt.Errorf("reportSpec.blocks must not be empty")
	}
	for index, block := range r.Blocks {
		if strings.TrimSpace(block.ID) == "" {
			return fmt.Errorf("reportSpec.blocks[%d].id is required", index)
		}
		kind := strings.TrimSpace(block.Kind)
		if kind == "" {
			return fmt.Errorf("reportSpec.blocks[%d].kind is required", index)
		}
		switch kind {
		case "tableBlock":
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].datasetRef is required for tableBlock", index)
			}
			if len(block.Columns) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].columns must not be empty for tableBlock", index)
			}
			for columnIndex, column := range block.Columns {
				if strings.TrimSpace(column.Key) == "" {
					return fmt.Errorf("reportSpec.blocks[%d].columns[%d].key is required", index, columnIndex)
				}
				if strings.TrimSpace(column.Label) == "" {
					return fmt.Errorf("reportSpec.blocks[%d].columns[%d].label is required", index, columnIndex)
				}
			}
		case "chartBlock":
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].datasetRef is required for chartBlock", index)
			}
			if len(block.ChartSpec) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].chartSpec is required for chartBlock", index)
			}
			if len(block.ChartModel) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].chartModel is required for chartBlock", index)
			}
		case "kpiBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].datasetRef is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.ValueField) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].valueField is required for kpiBlock", index)
			}
			if strings.TrimSpace(block.ValueLabel) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].valueLabel is required for kpiBlock", index)
			}
			if !isAllowedReportValueFormat(block.ValueFormat) {
				return fmt.Errorf("reportSpec.blocks[%d].valueFormat %q is not supported for kpiBlock", index, block.ValueFormat)
			}
			if !isAllowedReportValueFormat(block.SecondaryFormat) {
				return fmt.Errorf("reportSpec.blocks[%d].secondaryFormat %q is not supported for kpiBlock", index, block.SecondaryFormat)
			}
			if !isAllowedReportRowSelector(block.RowSelector) {
				return fmt.Errorf("reportSpec.blocks[%d].rowSelector %q is not supported for kpiBlock", index, block.RowSelector)
			}
			if !isAllowedReportPresentationMode(block.PresentationMode) {
				return fmt.Errorf("reportSpec.blocks[%d].presentationMode %q is not supported for kpiBlock", index, block.PresentationMode)
			}
			if !isAllowedReportBodyFormat(block.BodyFormat) {
				return fmt.Errorf("reportSpec.blocks[%d].bodyFormat %q is not supported for kpiBlock", index, block.BodyFormat)
			}
		case "collectionBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for collectionBlock", index)
			}
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].datasetRef is required for collectionBlock", index)
			}
			if strings.TrimSpace(block.ItemTitleField) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].itemTitleField is required for collectionBlock", index)
			}
			if strings.TrimSpace(block.Layout) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].layout is required for collectionBlock", index)
			}
			if !isAllowedCollectionLayout(block.Layout) {
				return fmt.Errorf("reportSpec.blocks[%d].layout %q is not supported for collectionBlock", index, block.Layout)
			}
			if !isAllowedReportValueFormat(block.ValueFormat) {
				return fmt.Errorf("reportSpec.blocks[%d].valueFormat %q is not supported for collectionBlock", index, block.ValueFormat)
			}
			if !isAllowedReportValueFormat(block.SecondaryFormat) {
				return fmt.Errorf("reportSpec.blocks[%d].secondaryFormat %q is not supported for collectionBlock", index, block.SecondaryFormat)
			}
			if !isAllowedReportBodyFormat(block.BodyFormat) {
				return fmt.Errorf("reportSpec.blocks[%d].bodyFormat %q is not supported for collectionBlock", index, block.BodyFormat)
			}
			if block.CollectionCols < 1 {
				return fmt.Errorf("reportSpec.blocks[%d].columns must be >= 1 for collectionBlock", index)
			}
			if block.CollectionCols > 4 {
				return fmt.Errorf("reportSpec.blocks[%d].columns must be <= 4 for collectionBlock", index)
			}
			if block.RowLimit == nil || *block.RowLimit < 1 {
				return fmt.Errorf("reportSpec.blocks[%d].rowLimit must be >= 1 for collectionBlock", index)
			}
		case "sectionBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for sectionBlock", index)
			}
			if strings.TrimSpace(block.NavigationLabel) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].navigationLabel is required for sectionBlock", index)
			}
		case "compositeBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for compositeBlock", index)
			}
			if len(block.ChildBlockIDs) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].childBlockIds must not be empty for compositeBlock", index)
			}
		case "tabGroupBlock":
			if len(block.SectionIDs) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].sectionIds must not be empty for tabGroupBlock", index)
			}
		case "stepperBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for stepperBlock", index)
			}
			if len(block.Steps) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].steps must not be empty for stepperBlock", index)
			}
		case "infoPanelBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for infoPanelBlock", index)
			}
			if strings.TrimSpace(block.Body) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].body is required for infoPanelBlock", index)
			}
		case "calloutBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for calloutBlock", index)
			}
			if strings.TrimSpace(block.Body) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].body is required for calloutBlock", index)
			}
		case "kanbanBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for kanbanBlock", index)
			}
			if len(block.ColumnsLayout) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].columns must not be empty for kanbanBlock", index)
			}
		case "timelineBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for timelineBlock", index)
			}
			if len(block.Events) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].events must not be empty for timelineBlock", index)
			}
		case "filterBarBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for filterBarBlock", index)
			}
			mode := strings.ToLower(strings.TrimSpace(block.Mode))
			if len(block.ParamIDs) == 0 && !(mode == "unified" && len(block.VisibleGroups) > 0) {
				return fmt.Errorf("reportSpec.blocks[%d].paramIds must not be empty for filterBarBlock", index)
			}
		case "refinementBarBlock":
		case "markdownBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for markdownBlock", index)
			}
			if strings.TrimSpace(block.Markdown) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].markdown is required for markdownBlock", index)
			}
		case "geoMapBlock":
			if strings.TrimSpace(block.Title) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].title is required for geoMapBlock", index)
			}
			if strings.TrimSpace(block.DatasetRef) == "" {
				return fmt.Errorf("reportSpec.blocks[%d].datasetRef is required for geoMapBlock", index)
			}
			if len(block.Geo) == 0 {
				return fmt.Errorf("reportSpec.blocks[%d].geo is required for geoMapBlock", index)
			}
		default:
			return fmt.Errorf("reportSpec.blocks[%d].kind %q is not supported", index, kind)
		}
	}
	if r.Binding != nil {
		if strings.TrimSpace(r.Binding.Mode) == "" || strings.TrimSpace(r.Binding.ModelRef) == "" || strings.TrimSpace(r.Binding.Entity) == "" {
			return fmt.Errorf("reportSpec.binding.mode, modelRef, and entity are required")
		}
		if r.Binding.SelectedDimensions == nil {
			return fmt.Errorf("reportSpec.binding.selectedDimensions is required")
		}
		if r.Binding.SelectedMeasures == nil {
			return fmt.Errorf("reportSpec.binding.selectedMeasures is required")
		}
	}
	if r.SemanticSummary != nil {
		if strings.TrimSpace(r.SemanticSummary.Kind) != "semantic" {
			return fmt.Errorf("reportSpec.semanticSummary.kind must be semantic")
		}
		if strings.TrimSpace(r.SemanticSummary.ModelRef) == "" || strings.TrimSpace(r.SemanticSummary.Entity) == "" {
			return fmt.Errorf("reportSpec.semanticSummary.modelRef and entity are required")
		}
		if r.SemanticSummary.SelectedDimensions == nil {
			return fmt.Errorf("reportSpec.semanticSummary.selectedDimensions is required")
		}
		if r.SemanticSummary.SelectedMeasures == nil {
			return fmt.Errorf("reportSpec.semanticSummary.selectedMeasures is required")
		}
	}
	if r.Scope != nil {
		if r.Scope.Params == nil {
			return fmt.Errorf("reportSpec.scope.params is required")
		}
		if strings.TrimSpace(r.Scope.DataSourceRef) == "" {
			return fmt.Errorf("reportSpec.scope.dataSourceRef is required")
		}
	}
	return nil
}

func decodeBlock(payload json.RawMessage, index int) (Block, error) {
	header := rawBlockHeader{}
	if err := json.Unmarshal(payload, &header); err != nil {
		return Block{}, err
	}
	switch strings.TrimSpace(header.Kind) {
	case "tableBlock":
		block := rawTableBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] tableBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:         block.ID,
			Kind:       block.Kind,
			Title:      block.Title,
			DatasetRef: block.DatasetRef,
			Columns:    block.Columns,
		}, nil
	case "chartBlock":
		block := rawChartBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] chartBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:         block.ID,
			Kind:       block.Kind,
			Title:      block.Title,
			DatasetRef: block.DatasetRef,
			ChartSpec:  block.ChartSpec,
			ChartModel: block.ChartModel,
		}, nil
	case "kpiBlock":
		block := rawKPIBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] kpiBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:                       block.ID,
			Kind:                     block.Kind,
			Title:                    block.Title,
			DatasetRef:               block.DatasetRef,
			ValueField:               block.ValueField,
			ValueLabel:               block.ValueLabel,
			ValueFormat:              block.ValueFormat,
			SecondaryField:           block.SecondaryField,
			SecondaryLabel:           block.SecondaryLabel,
			SecondaryFormat:          block.SecondaryFormat,
			SecondaryDisplayKey:      block.SecondaryDisplayKey,
			SecondaryDisplayValueMap: block.SecondaryDisplayValueMap,
			Description:              block.Description,
			EmptyLabel:               block.EmptyLabel,
			RowSelector:              block.RowSelector,
			PresentationMode:         block.PresentationMode,
			BodyFormat:               block.BodyFormat,
			BodyTemplate:             block.BodyTemplate,
		}, nil
	case "collectionBlock":
		block := rawCollectionBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] collectionBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:              block.ID,
			Kind:            block.Kind,
			Title:           block.Title,
			Description:     block.Description,
			DatasetRef:      block.DatasetRef,
			ItemTitleField:  block.ItemTitleField,
			ItemTitleLabel:  block.ItemTitleLabel,
			ValueField:      block.ValueField,
			ValueLabel:      block.ValueLabel,
			ValueFormat:     block.ValueFormat,
			SecondaryField:  block.SecondaryField,
			SecondaryLabel:  block.SecondaryLabel,
			SecondaryFormat: block.SecondaryFormat,
			Layout:          block.Layout,
			CollectionCols:  block.Columns,
			RowLimit:        &block.RowLimit,
			BodyFormat:      block.BodyFormat,
			BodyTemplate:    block.BodyTemplate,
			EmptyLabel:      block.EmptyLabel,
		}, nil
	case "sectionBlock":
		block := rawSectionBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] sectionBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:              block.ID,
			Kind:            block.Kind,
			Title:           block.Title,
			Subtitle:        block.Subtitle,
			Description:     block.Description,
			NavigationLabel: block.NavigationLabel,
		}, nil
	case "compositeBlock":
		block := rawCompositeBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] compositeBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:            block.ID,
			Kind:          block.Kind,
			Title:         block.Title,
			Description:   block.Description,
			ChildBlockIDs: block.ChildBlockIDs,
		}, nil
	case "tabGroupBlock":
		block := rawTabGroupBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] tabGroupBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:               block.ID,
			Kind:             block.Kind,
			Title:            block.Title,
			SectionIDs:       block.SectionIDs,
			DefaultSectionID: block.DefaultSectionID,
		}, nil
	case "stepperBlock":
		block := rawStepperBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] stepperBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:          block.ID,
			Kind:        block.Kind,
			Title:       block.Title,
			Description: block.Description,
			Steps:       block.Steps,
		}, nil
	case "infoPanelBlock":
		block := rawInfoPanelBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] infoPanelBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:          block.ID,
			Kind:        block.Kind,
			Title:       block.Title,
			Eyebrow:     block.Eyebrow,
			Description: block.Description,
			Tone:        block.Tone,
			BodyFormat:  block.BodyFormat,
			Body:        block.Body,
		}, nil
	case "calloutBlock":
		block := rawCalloutBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] calloutBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:          block.ID,
			Kind:        block.Kind,
			Title:       block.Title,
			Icon:        block.Icon,
			Description: block.Description,
			Tone:        block.Tone,
			Badges:      block.Badges,
			BodyFormat:  block.BodyFormat,
			Body:        block.Body,
		}, nil
	case "kanbanBlock":
		block := rawKanbanBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] kanbanBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:            block.ID,
			Kind:          block.Kind,
			Title:         block.Title,
			Description:   block.Description,
			ColumnsLayout: block.Columns,
		}, nil
	case "timelineBlock":
		block := rawTimelineBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] timelineBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:          block.ID,
			Kind:        block.Kind,
			Title:       block.Title,
			Description: block.Description,
			Events:      block.Events,
		}, nil
	case "filterBarBlock":
		block := rawFilterBarBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] filterBarBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			DatasetRef:      block.DatasetRef,
			ID:              block.ID,
			Kind:            block.Kind,
			Title:           block.Title,
			ParamIDs:        block.ParamIDs,
			Mode:            block.Mode,
			Placement:       block.Placement,
			GroupOrder:      block.GroupOrder,
			VisibleGroups:   block.VisibleGroups,
			CollapsedGroups: block.CollapsedGroups,
		}, nil
	case "refinementBarBlock":
		block := rawRefinementBarBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] refinementBarBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:          block.ID,
			Kind:        block.Kind,
			Title:       block.Title,
			ActionKinds: block.ActionKinds,
			EmptyLabel:  block.EmptyLabel,
		}, nil
	case "markdownBlock":
		block := rawMarkdownBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] markdownBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:       block.ID,
			Kind:     block.Kind,
			Title:    block.Title,
			Markdown: block.Markdown,
		}, nil
	case "geoMapBlock":
		block := rawGeoMapBlock{}
		if err := decodeStrictJSON(payload, &block, fmt.Sprintf("reportSpec.blocks[%d] geoMapBlock", index)); err != nil {
			return Block{}, err
		}
		return Block{
			ID:         block.ID,
			Kind:       block.Kind,
			Title:      block.Title,
			DatasetRef: block.DatasetRef,
			Geo:        block.Geo,
		}, nil
	default:
		return Block{
			ID:         header.ID,
			Kind:       header.Kind,
			Title:      header.Title,
			DatasetRef: header.DatasetRef,
		}, nil
	}
}

func decodeStrictJSON[T any](payload json.RawMessage, destination *T, label string) error {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("decode %s: %w", label, err)
	}
	if err := rejectTrailingJSON(decoder, label); err != nil {
		return err
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

func isAllowedReportValueFormat(value string) bool {
	switch strings.TrimSpace(value) {
	case "", "currency", "number", "percent", "percentFraction", "compact", "compactNumber":
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
