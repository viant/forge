package reportfill

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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
	ID                   string                `json:"id"`
	Kind                 string                `json:"kind"`
	Title                string                `json:"title,omitempty"`
	DatasetRef           string                `json:"datasetRef,omitempty"`
	Columns              []TableColumn         `json:"columns,omitempty"`
	Content              *TableContent         `json:"content,omitempty"`
	ChartSpec            map[string]any        `json:"chartSpec,omitempty"`
	ChartModel           map[string]any        `json:"chartModel,omitempty"`
	ValueField           string                `json:"valueField,omitempty"`
	ValueLabel           string                `json:"valueLabel,omitempty"`
	SecondaryField       string                `json:"secondaryField,omitempty"`
	SecondaryLabel       string                `json:"secondaryLabel,omitempty"`
	Description          string                `json:"description,omitempty"`
	EmptyLabel           string                `json:"emptyLabel,omitempty"`
	Markdown             string                `json:"markdown,omitempty"`
	Geo                  map[string]any        `json:"geo,omitempty"`
	ChartContent         *ChartContent         `json:"-"`
	GeoContent           *GeoContent           `json:"-"`
	KPIContent           *KPIContent           `json:"-"`
	FilterBarContent     *FilterBarContent     `json:"-"`
	RefinementBarContent *RefinementBarContent `json:"-"`
	MarkdownContent      *MarkdownContent      `json:"-"`
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
	Kind    string   `json:"kind"`
	Value   *float64 `json:"value,omitempty"`
	Percent *float64 `json:"percent,omitempty"`
	Palette []string `json:"palette,omitempty"`
	Tone    string   `json:"tone,omitempty"`
	Label   string   `json:"label,omitempty"`
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
	Title          string `json:"title"`
	Description    string `json:"description,omitempty"`
	ValueField     string `json:"valueField"`
	ValueLabel     string `json:"valueLabel"`
	Value          any    `json:"value"`
	RowCount       *int   `json:"rowCount"`
	SecondaryField string `json:"secondaryField,omitempty"`
	SecondaryLabel string `json:"secondaryLabel,omitempty"`
	SecondaryValue any    `json:"secondaryValue,omitempty"`
	EmptyLabel     string `json:"emptyLabel,omitempty"`
}

type FilterBarContent struct {
	Title  string                   `json:"title"`
	Params []FilterBarContentParams `json:"params"`
}

type FilterBarContentParams struct {
	ID          string `json:"id"`
	Label       string `json:"label,omitempty"`
	Description string `json:"description,omitempty"`
	Value       any    `json:"value"`
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
	ID             string     `json:"id"`
	Kind           string     `json:"kind"`
	Title          string     `json:"title"`
	DatasetRef     string     `json:"datasetRef"`
	ValueField     string     `json:"valueField"`
	ValueLabel     string     `json:"valueLabel"`
	SecondaryField string     `json:"secondaryField,omitempty"`
	SecondaryLabel string     `json:"secondaryLabel,omitempty"`
	Description    string     `json:"description,omitempty"`
	EmptyLabel     string     `json:"emptyLabel,omitempty"`
	Content        KPIContent `json:"content"`
}

type rawFilterBarBlock struct {
	ID       string           `json:"id"`
	Kind     string           `json:"kind"`
	Title    string           `json:"title,omitempty"`
	ParamIDs []string         `json:"paramIds,omitempty"`
	Content  FilterBarContent `json:"content"`
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
				ID:             kpiBlock.ID,
				Kind:           kpiBlock.Kind,
				Title:          kpiBlock.Title,
				DatasetRef:     kpiBlock.DatasetRef,
				ValueField:     kpiBlock.ValueField,
				ValueLabel:     kpiBlock.ValueLabel,
				SecondaryField: kpiBlock.SecondaryField,
				SecondaryLabel: kpiBlock.SecondaryLabel,
				Description:    kpiBlock.Description,
				EmptyLabel:     kpiBlock.EmptyLabel,
				KPIContent:     &kpiBlock.Content,
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
	}
	if err := fill.Validate(); err != nil {
		return nil, err
	}
	return fill, nil
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
		if dataset.Request.Limit == nil {
			return fmt.Errorf("reportFill.datasets[%d].request.limit is required", index)
		}
		if *dataset.Request.Limit < 1 {
			return fmt.Errorf("reportFill.datasets[%d].request.limit must be >= 1", index)
		}
		if dataset.Request.Offset == nil {
			return fmt.Errorf("reportFill.datasets[%d].request.offset is required", index)
		}
		if *dataset.Request.Offset < 0 {
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
					case "dataBar":
						if cell.VisualState.Value == nil {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.value is required for dataBar", index, rowIndex, cellIndex)
						}
						if cell.VisualState.Percent == nil {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.percent is required for dataBar", index, rowIndex, cellIndex)
						}
						if cell.VisualState.Palette == nil {
							return fmt.Errorf("reportFill.blocks[%d].content.resolvedRows[%d].cells[%d].visualState.palette is required for dataBar", index, rowIndex, cellIndex)
						}
					case "badge", "tone":
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
			if block.KPIContent.RowCount == nil {
				return fmt.Errorf("reportFill.blocks[%d].content.rowCount is required for kpiBlock", index)
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
	data, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("marshal json: %w", err)
	}
	var hash uint32 = 2166136261
	for _, codeUnit := range utf16.Encode([]rune(string(data))) {
		hash ^= uint32(codeUnit)
		hash *= 16777619
	}
	return fmt.Sprintf("fnv1a:%08x", hash), nil
}

func computeRequestHash(dataset Dataset) (string, error) {
	if len(dataset.requestPayload) > 0 {
		return computeJSONFNV1aRawHash(dataset.requestPayload)
	}
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
