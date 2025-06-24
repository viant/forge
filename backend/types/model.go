package types

type Chart struct {
	Type          string        `json:"type" yaml:"type"`
	XAxis         ChartXAxis    `json:"xAxis" yaml:"xAxis"`
	YAxis         ChartYAxis    `json:"yAxis" yaml:"yAxis"`
	CartesianGrid CartesianGrid `json:"cartesianGrid,omitempty" yaml:"cartesianGrid,omitempty"`
	Width         string        `json:"width" yaml:"width"`
	Height        string        `json:"height" yaml:"height"`
	Series        ChartSeries   `json:"series" yaml:"series"`
	On            []*Execute    `json:"on,omitempty" yaml:"on,omitempty"`
}

type ChartXAxis struct {
	DataKey    string `json:"dataKey" yaml:"dataKey"`
	Label      string `json:"label,omitempty" yaml:"label,omitempty"`
	TickFormat string `json:"tickFormat,omitempty" yaml:"tickFormat,omitempty"`
}

type ChartYAxis struct {
	Label string `json:"label,omitempty" yaml:"label,omitempty"`
}

type CartesianGrid struct {
	StrokeDasharray string `json:"strokeDasharray,omitempty" yaml:"strokeDasharray,omitempty"`
}

type ChartSeries struct {
	NameKey  string              `json:"nameKey" yaml:"nameKey"`
	ValueKey string              `json:"valueKey" yaml:"valueKey"`
	Values   []*ChartSeriesValue `json:"values,omitempty" yaml:"values,omitempty"`
	Palette  []string            `json:"palette,omitempty" yaml:"palette,omitempty"`
}

type ChartSeriesValue struct {
	Label string `json:"label" yaml:"label"`
	Value string `json:"value" yaml:"value"`
}

type NavigationItem struct {
	ID          string           `json:"id" yaml:"id"`
	Label       string           `json:"label" yaml:"label"`
	Icon        string           `json:"icon" yaml:"icon"`
	WindowKey   string           `json:"windowKey" yaml:"windowKey"`
	WindowTitle string           `json:"windowTitle" yaml:"windowTitle"`
	ChildNodes  []NavigationItem `json:"childNodes,omitempty" yaml:"childNodes,omitempty"`
}

// Dialog represents a dialog with a title, content, actions, and on events.
type Dialog struct {
	Id            string           `json:"id" yaml:"id"`
	Title         string           `json:"title" yaml:"title"`
	DataSourceRef string           `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Content       *Container       `json:"content" yaml:"content"`
	Style         *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	Actions       []Item           `json:"actions" yaml:"actions"`
	On            []*Execute       `json:"on,omitempty" yaml:"on,omitempty"`
}

type Window struct {
	Ns         []string              `json:"ns,omitempty" yaml:"ns,omitempty"`
	Namespace  string                `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	DataSource map[string]DataSource `json:"dataSource" yaml:"dataSource"`
	View       View                  `json:"view" yaml:"view"`
	Dialogs    []Dialog              `json:"dialogs,omitempty" yaml:"dialogs,omitempty"`
	Actions    *Actions              `json:"actions,omitempty" yaml:"actions,omitempty"`
}

func (w *Window) SetCode(code []byte) {
	w.Actions = &Actions{
		Code: string(code),
	}
}

type Actions struct {
	Code string `json:"code,omitempty" yaml:"code,omitempty"`
}

type View struct {
	Layout  Layout     `json:"layout,omitempty" yaml:"layout,omitempty"`
	Content *Container `json:"content" yaml:"content"`
	On      []*Execute `json:"on,omitempty" yaml:"on,omitempty"`
}

type Layout struct {
	Orientation   string   `json:"orientation" yaml:"orientation"`
	Rows          int      `json:"rows" yaml:"rows"`
	Columns       int      `json:"columns,omitempty" yaml:"columns,omitempty"`
	LabelPosition string   `json:"labelPosition,omitempty" yaml:"labelPosition,omitempty"`
	Divider       *Divider `json:"divider,omitempty" yaml:"divider,omitempty"`
}

type Divider struct {
	Visible bool  `json:"visible,omitempty" yaml:"visible,omitempty"`
	Sizes   []int `json:"sizes,omitempty" yaml:"sizes,omitempty"`
}

type Progress struct {
	MaxValueField string `json:"maxValueField" yaml:"maxValueField"`
}

type StyleProperties struct {
	*SizingProperties      `json:",omitempty" yaml:",inline"`
	*SpacingProperties     `json:",omitempty" yaml:",inline"`
	*TypographyProperties  `json:",omitempty" yaml:",inline"`
	*LayoutProperties      `json:",omitempty" yaml:",inline"`
	*PositioningProperties `json:",omitempty" yaml:",inline"`
	*BorderProperties      `json:",omitempty" yaml:",inline"`
	*BackgroundProperties  `json:",omitempty" yaml:",inline"`
	*AnimationProperties   `json:",omitempty" yaml:",inline"`
}

// Grouped struct for sizing-related styles
type SizingProperties struct {
	Width     string `json:"width,omitempty" yaml:"width,omitempty"`
	Height    string `json:"height,omitempty" yaml:"height,omitempty"`
	MaxWidth  string `json:"maxWidth,omitempty" yaml:"maxWidth,omitempty"`
	MaxHeight string `json:"maxHeight,omitempty" yaml:"maxHeight,omitempty"`
	MinWidth  string `json:"minWidth,omitempty" yaml:"minWidth,omitempty"`
	MinHeight string `json:"minHeight,omitempty" yaml:"minHeight,omitempty"`
}

// Grouped struct for spacing-related styles
type SpacingProperties struct {
	Margin        string `json:"margin,omitempty" yaml:"margin,omitempty"`
	MarginTop     string `json:"marginTop,omitempty" yaml:"marginTop,omitempty"`
	MarginRight   string `json:"marginRight,omitempty" yaml:"marginRight,omitempty"`
	MarginBottom  string `json:"marginBottom,omitempty" yaml:"marginBottom,omitempty"`
	MarginLeft    string `json:"marginLeft,omitempty" yaml:"marginLeft,omitempty"`
	Padding       string `json:"padding,omitempty" yaml:"padding,omitempty"`
	PaddingTop    string `json:"paddingTop,omitempty" yaml:"paddingTop,omitempty"`
	PaddingRight  string `json:"paddingRight,omitempty" yaml:"paddingRight,omitempty"`
	PaddingBottom string `json:"paddingBottom,omitempty" yaml:"paddingBottom,omitempty"`
	PaddingLeft   string `json:"paddingLeft,omitempty" yaml:"paddingLeft,omitempty"`
}

// Grouped struct for typography-related styles
type TypographyProperties struct {
	FontFamily    string `json:"fontFamily,omitempty" yaml:"fontFamily,omitempty"`
	FontSize      string `json:"fontSize,omitempty" yaml:"fontSize,omitempty"`
	FontWeight    string `json:"fontWeight,omitempty" yaml:"fontWeight,omitempty"`
	LineHeight    string `json:"lineHeight,omitempty" yaml:"lineHeight,omitempty"`
	LetterSpacing string `json:"letterSpacing,omitempty" yaml:"letterSpacing,omitempty"`
	TextAlign     string `json:"textAlign,omitempty" yaml:"textAlign,omitempty"`
	Color         string `json:"color,omitempty" yaml:"color,omitempty"`
}

// Grouped struct for layout-related styles
type LayoutProperties struct {
	Display        string `json:"display,omitempty" yaml:"display,omitempty"`
	FlexDirection  string `json:"flexDirection,omitempty" yaml:"flexDirection,omitempty"`
	AlignItems     string `json:"alignItems,omitempty" yaml:"alignItems,omitempty"`
	JustifyContent string `json:"justifyContent,omitempty" yaml:"justifyContent,omitempty"`
	JustifySelf    string `json:"justifySelf,omitempty" yaml:"justifySelf,omitempty"`
	AlignSelf      string `json:"alignSelf,omitempty" yaml:"alignSelf,omitempty"`
	PlaceSelf      string `json:"placeSelf,omitempty" yaml:"placeSelf,omitempty"` // Shorthand for align-self + justify-self
	FlexWrap       string `json:"flexWrap,omitempty" yaml:"flexWrap,omitempty"`
	Flex           string `json:"flex,omitempty" yaml:"flex,omitempty"`
	FlexGrow       string `json:"flexGrow,omitempty" yaml:"flexGrow,omitempty"`
	FlexShrink     string `json:"flexShrink,omitempty" yaml:"flexShrink,omitempty"`
	FlexBasis      string `json:"flexBasis,omitempty" yaml:"flexBasis,omitempty"`
	Gap            string `json:"gap,omitempty" yaml:"gap,omitempty"`
	RowGap         string `json:"rowGap,omitempty" yaml:"rowGap,omitempty"`
	ColumnGap      string `json:"columnGap,omitempty" yaml:"columnGap,omitempty"`
	// Grid-specific properties
	GridTemplateColumns string `json:"gridTemplateColumns,omitempty" yaml:"gridTemplateColumns,omitempty"`
	GridTemplateRows    string `json:"gridTemplateRows,omitempty" yaml:"gridTemplateRows,omitempty"`
	GridTemplateAreas   string `json:"gridTemplateAreas,omitempty" yaml:"gridTemplateAreas,omitempty"`
	GridColumn          string `json:"gridColumn,omitempty" yaml:"gridColumn,omitempty"`
	GridRow             string `json:"gridRow,omitempty" yaml:"gridRow,omitempty"`
	GridArea            string `json:"gridArea,omitempty" yaml:"gridArea,omitempty"`
	GridAutoFlow        string `json:"gridAutoFlow,omitempty" yaml:"gridAutoFlow,omitempty"`
	GridAutoColumns     string `json:"gridAutoColumns,omitempty" yaml:"gridAutoColumns,omitempty"`
	GridAutoRows        string `json:"gridAutoRows,omitempty" yaml:"gridAutoRows,omitempty"`
	PlaceItems          string `json:"placeItems,omitempty" yaml:"placeItems,omitempty"`     // Shorthand for align-items + justify-items
	PlaceContent        string `json:"placeContent,omitempty" yaml:"placeContent,omitempty"` // Shorthand for align-content + justify-content
}

// PositioningProperties grouped struct for positioning-related styles
type PositioningProperties struct {
	Position       string `json:"position,omitempty" yaml:"position,omitempty"`
	Top            string `json:"top,omitempty" yaml:"top,omitempty"`
	Right          string `json:"right,omitempty" yaml:"right,omitempty"`
	Bottom         string `json:"bottom,omitempty" yaml:"bottom,omitempty"`
	Left           string `json:"left,omitempty" yaml:"left,omitempty"`
	Inset          string `json:"inset,omitempty" yaml:"inset,omitempty"` // Shorthand for top/right/bottom/left
	ZIndex         string `json:"zIndex,omitempty" yaml:"zIndex,omitempty"`
	Overflow       string `json:"overflow,omitempty" yaml:"overflow,omitempty"`
	OverflowX      string `json:"overflowX,omitempty" yaml:"overflowX,omitempty"`
	OverflowY      string `json:"overflowY,omitempty" yaml:"overflowY,omitempty"`
	ObjectFit      string `json:"objectFit,omitempty" yaml:"objectFit,omitempty"`
	ObjectPosition string `json:"objectPosition,omitempty" yaml:"objectPosition,omitempty"`
	Visibility     string `json:"visibility,omitempty" yaml:"visibility,omitempty"`
}

// BorderProperties Grouped struct for border-related styles
type BorderProperties struct {
	BorderWidth   string `json:"borderWidth,omitempty" yaml:"borderWidth,omitempty"`
	BorderStyle   string `json:"borderStyle,omitempty" yaml:"borderStyle,omitempty"`
	BorderColor   string `json:"borderColor,omitempty" yaml:"borderColor,omitempty"`
	BorderRadius  string `json:"borderRadius,omitempty" yaml:"borderRadius,omitempty"`
	BorderSpacing string `json:"borderSpacing,omitempty" yaml:"borderSpacing,omitempty"`
	Outline       string `json:"outline,omitempty" yaml:"outline,omitempty"`
	OutlineWidth  string `json:"outlineWidth,omitempty" yaml:"outlineWidth,omitempty"`
	OutlineStyle  string `json:"outlineStyle,omitempty" yaml:"outlineStyle,omitempty"`
	OutlineColor  string `json:"outlineColor,omitempty" yaml:"outlineColor,omitempty"`
}

// BackgroundProperties grouped struct for background-related styles
type BackgroundProperties struct {
	BackgroundColor      string `json:"backgroundColor,omitempty" yaml:"backgroundColor,omitempty"`
	BackgroundImage      string `json:"backgroundImage,omitempty" yaml:"backgroundImage,omitempty"`
	BackgroundSize       string `json:"backgroundSize,omitempty" yaml:"backgroundSize,omitempty"`
	BackgroundPosition   string `json:"backgroundPosition,omitempty" yaml:"backgroundPosition,omitempty"`
	BackgroundRepeat     string `json:"backgroundRepeat,omitempty" yaml:"backgroundRepeat,omitempty"`
	BackgroundClip       string `json:"backgroundClip,omitempty" yaml:"backgroundClip,omitempty"`
	BackgroundAttachment string `json:"backgroundAttachment,omitempty" yaml:"backgroundAttachment,omitempty"`
	BackgroundBlendMode  string `json:"backgroundBlendMode,omitempty" yaml:"backgroundBlendMode,omitempty"`
}

// Grouped struct for animation-related styles
type AnimationProperties struct {
	AnimationName           string `json:"animationName,omitempty" yaml:"animationName,omitempty"`
	AnimationDuration       string `json:"animationDuration,omitempty" yaml:"animationDuration,omitempty"`
	AnimationTimingFunction string `json:"animationTimingFunction,omitempty" yaml:"animationTimingFunction,omitempty"`
	AnimationDelay          string `json:"animationDelay,omitempty" yaml:"animationDelay,omitempty"`
	AnimationIterationCount string `json:"animationIterationCount,omitempty" yaml:"animationIterationCount,omitempty"`
	AnimationDirection      string `json:"animationDirection,omitempty" yaml:"animationDirection,omitempty"`
}

type UnitedSize struct {
	Size int    `json:"size,omitempty" yaml:"size,omitempty"`
	Unit string `json:"unit,omitempty" yaml:"unit,omitempty"`
}

type Container struct {
	ID          string `json:"id" yaml:"id"`
	Binding     `yaml:",inline"`
	State       *Parameter       `json:"state,omitempty" yaml:"state,omitempty"`
	Title       string           `json:"title,omitempty" yaml:"title,omitempty"`
	Layout      *Layout          `json:"layout,omitempty" yaml:"layout,omitempty"`
	Style       *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	Table       *Table           `json:"table,omitempty" yaml:"table,omitempty"`
	FileBrowser *FileBrowser     `json:"fileBrowser,omitempty" yaml:"fileBrowser,omitempty"`
	Editor      *Editor          `json:"editor,omitempty" yaml:"editor,omitempty"`
	Chart       *Chart           `json:"chart,omitempty" yaml:"chart,omitempty"`
	Chat        *Chat            `json:"chat,omitempty" yaml:"chat,omitempty"`
	Section     *Section         `json:"section,omitempty" yaml:"section,omitempty"`
	Items       []Item           `json:"items,omitempty" yaml:"items,omitempty"`
	Card        *Card            `json:"card,omitempty" yaml:"card,omitempty"`
	Footer      *Container       `json:"footer,omitempty" yaml:"footer,omitempty"`
	Containers  []Container      `json:"containers,omitempty" yaml:"containers,omitempty"`
	On          []*Execute       `json:"on,omitempty" yaml:"on,omitempty"`
	Tabs        *Tabs            `json:"tabs,omitempty" yaml:"tabs,omitempty"`
	Dialogs     []string         `json:"dialogs,omitempty" yaml:"dialogs,omitempty"`
	Repeat      *Repeat          `json:"repeat,omitempty" yaml:"repeat,omitempty"`
	SelectFirst bool             `json:"selectFirst,omitempty"  yaml:"selectFirst,omitempty"`
	FetchData   bool             `json:"fetchData,omitempty"  yaml:"fetchData,omitempty"`
}

type Chat struct {
	// DataSourceRef points to the data source that supplies messages.
	DataSourceRef string   `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Toolbar       *Toolbar `json:"toolbar,omitempty" yaml:"toolbar,omitempty"`
	Height        string   `json:"height,omitempty" yaml:"height,omitempty"`
	// ShowUpload controls whether file upload input should be displayed (default true).
	ShowUpload bool `json:"showUpload,omitempty" yaml:"showUpload,omitempty"`
	// On defines event handlers such as submit, upload
	On []*Execute `json:"on,omitempty" yaml:"on,omitempty"`
}

type FileBrowser struct {
	Title      string           `json:"title" yaml:"title"`
	FolderOnly bool             `json:"folderOnly" yaml:"folderOnly"`
	Style      *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	On         []*Execute       `json:"on,omitempty" yaml:"on,omitempty"`
}

type Editor struct {
	Title          string           `json:"title" yaml:"title"`
	EditorSelector *EditorSelector  `json:"selector" yaml:"selector"`
	Style          *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	On             []*Execute       `json:"on,omitempty" yaml:"on,omitempty"`
}

type EditorSelector struct {
	Source    string `json:"source,omitempty" yaml:"source,omitempty"`
	Location  string `json:"location,omitempty" yaml:"location,omitempty"`
	Extension string `json:"extension,omitempty" yaml:"extension,omitempty"`
}

type Repeat struct {
	Iterator *Parameter `json:"iterator,omitempty" yaml:"iterator,omitempty"`
	Item     *Item      `json:"item,omitempty" yaml:"item,omitempty"`
}

type Tabs struct {
	Animate                  bool   `json:"animate" yaml:"animate"`
	ClassName                string `json:"className" yaml:"className"`
	DefaultSelectedTabId     string `json:"defaultSelectedTabId" yaml:"defaultSelectedTabId"`
	Fill                     bool   `json:"fill" yaml:"fill"`
	Large                    bool   `json:"large" yaml:"large"`
	RenderActiveTabPanelOnly bool   `json:"renderActiveTabPanelOnly" yaml:"renderActiveTabPanelOnly"`
	SelectedTabId            string `json:"selectedTabId" yaml:"selectedTabId"`
	Vertical                 bool   `json:"vertical" yaml:"vertical"`
}

type Card struct {
	Compact     bool `json:"compact,omitempty" yaml:"compact,omitempty"`
	Elevation   int  `json:"elevation,omitempty" yaml:"elevation,omitempty"`
	Interactive bool `json:"interactive,omitempty" yaml:"interactive,omitempty"`
}

type Table struct {
	Columns           []Column   `json:"columns" yaml:"columns"`
	Toolbar           *Toolbar   `json:"toolbar,omitempty" yaml:"toolbar,omitempty"`
	EnforceColumnSize *bool      `json:"enforceColumnSize,omitempty" yaml:"enforceColumnSize,omitempty"`
	On                []*Execute `json:"on,omitempty" yaml:"on,omitempty"`
}

type Toolbar struct {
	Items         []Item `json:"items" yaml:"items"`
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
}

type Column struct {
	ID             string                 `json:"id" yaml:"id"`
	Name           string                 `json:"name" yaml:"name"`
	Width          int                    `json:"width,omitempty" yaml:"width,omitempty"`
	Align          string                 `json:"align,omitempty" yaml:"align,omitempty"`
	NumericFormat  string                 `json:"numericFormat,omitempty" yaml:"numericFormat,omitempty"`
	Sortable       bool                   `json:"sortable,omitempty" yaml:"sortable,omitempty"`
	Icon           string                 `json:"icon,omitempty" yaml:"icon,omitempty"`
	Type           string                 `json:"type,omitempty" yaml:"type,omitempty"`
	MultiSelect    bool                   `json:"multiSelect,omitempty" yaml:"multiSelect,omitempty"`
	CellProperties map[string]interface{} `json:"cellProperties,omitempty" yaml:"cellProperties,omitempty"`
	HeadProperties map[string]interface{} `json:"headProperties,omitempty" yaml:"headProperties,omitempty"`
	Progress       *Progress              `json:"progress,omitempty" yaml:"progress,omitempty"`
	On             []*Execute             `json:"on,omitempty" yaml:"on,omitempty"`
	ToolTip        string                 `json:"tooltip" yaml:"tooltip"`
}

// TemplateItem represents a single template item with an ID and an operator.
type TemplateItem struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Operator string `json:"operator"`
}

// Filter represents a filter with a name, a default indicator, and a template.
type Filter struct {
	Name     string         `json:"name"`
	Default  bool           `json:"default"`
	Template []TemplateItem `json:"template"`
}

type SettingsConfig struct {
	Tabs []string `json:"tabs" yaml:"tabs"`
}

type Section struct {
	Collapsible bool                   `json:"collapsible" yaml:"collapsible"`
	Properties  map[string]interface{} `json:"properties,omitempty" yaml:"properties,omitempty"`
}

type Binding struct {
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	DataField     string `json:"dataField,omitempty" yaml:"dataField,omitempty"`
	Path          string `json:"bindingPath,omitempty" yaml:"bindingPath,omitempty"`
	Scope         string `json:"scope,omitempty" yaml:"scope,omitempty"`
	MutationMode  string `json:"mutationMode,omitempty" yaml:"mutationMode,omitempty"`
}
type Item struct {
	ID                   string `json:"id" yaml:"id"`
	Binding              `yaml:",inline"`
	OptionDataSourceRets []string         `json:"optionDataSourceRets,omitempty" yaml:"optionDataSourceRets,omitempty"`
	Value                interface{}      `json:"value,omitempty" yaml:"value,omitempty"`
	Style                *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	Label                string           `json:"label" yaml:"label"`
	LabelPosition        string           `json:"labelPosition,omitempty" yaml:"labelPosition,omitempty"`
	Align                string           `json:"align,omitempty" yaml:"align,omitempty"`
	Options              []Option         `json:"options,omitempty" yaml:"options,omitempty"`
	DateFnsFormat        string           `json:"dateFnsFormat,omitempty" yaml:"dateFnsFormat,omitempty"`
	NumericFormat        string           `json:"numericFormat,omitempty" yaml:"numericFormat,omitempty"`
	Icon                 string           `json:"icon,omitempty" yaml:"icon,omitempty"`
	Type                 string           `json:"type,omitempty" yaml:"type,omitempty"`
	// ColumnSpan defines how many columns this item occupies in a grid layout.
	// Alternative casings ColSpan/colspan are accepted for backward compatibility.
	ColumnSpan int                    `json:"columnSpan,omitempty" yaml:"columnSpan,omitempty"`
	RowSpan    int                    `json:"rowSpan,omitempty" yaml:"rowSpan,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty" yaml:"properties,omitempty"`
	Enabled    bool                   `json:"enabled,omitempty" yaml:"enabled,omitempty"`
	On         []*Execute             `json:"on,omitempty" yaml:"on,omitempty"` // For message-bus events
}

type Execute struct {
	Event      string       `json:"event" yaml:"event"`
	Async      bool         `json:"async,omitempty" yaml:"async,omitempty"`
	Arguments  []string     `json:"args,omitempty" yaml:"args,omitempty"`
	Parameters []*Parameter `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Init       string       `json:"init,omitempty" yaml:"init,omitempty"`
	Handler    string       `json:"handler,omitempty" yaml:"handler,omitempty"`
	OnError    string       `json:"onError,omitempty" yaml:"onError,omitempty"`
	OnDone     string       `json:"onDone,omitempty" yaml:"onDone,omitempty"`
	OnSuccess  string       `json:"onSuccess,omitempty" yaml:"onSuccess,omitempty"`
}

type Option struct {
	Value string `json:"value" yaml:"value"`
	Label string `json:"label" yaml:"label"`
}

type DataSource struct {
	Service       *Service       `json:"service,omitempty" yaml:"service,omitempty"`
	DataSourceRef string         `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	UniqueKey     []*UniqueKey   `json:"uniqueKey,omitempty" yaml:"uniqueKey,omitempty"`
	Parameters    []Parameter    `json:"parameters" yaml:"parameters"`
	On            []*Execute     `json:"on,omitempty" yaml:"on,omitempty"`
	Cardinality   string         `json:"cardinality" yaml:"cardinality"`
	Selectors     *Selectors     `json:"selectors,omitempty" yaml:"selectors,omitempty"`
	SelectionMode *SelectionMode `json:"selectionMode,omitempty" yaml:"selectionMode,omitempty"`
	Paging        *PagingConfig  `json:"paging,omitempty" yaml:"paging,omitempty"`
	FilterSet     []Filter       `json:"filterSet,omitempty" yaml:"filterSet,omitempty"`
	AutoSelect    *bool          `json:"autoSelect,omitempty" yaml:"autoSelect,omitempty"`
	SelfReference string         `json:"selfReference,omitempty" yaml:"selfReference,omitempty"`
}

type SelectionMode string

const (
	SingleSelection SelectionMode = "single"
	MultiSelection  SelectionMode = "multi"
)

// UniqueKey
type UniqueKey struct {
	Field     string `json:"field" yaml:"field"`
	Parameter string `json:"parameter" yaml:"parameter"`
}

type Selectors struct {
	Data     string `json:"data,omitempty" yaml:"data,omitempty"`
	Scope    string `json:"scope,omitempty" yaml:"scope,omitempty"`
	DataInfo string `json:"dataInfo,omitempty" yaml:"dataInfo,omitempty"`
	Metrics  string `json:"metrics,omitempty" yaml:"metrics,omitempty"`
}

type PagingConfig struct {
	Size              int                `json:"size" yaml:"size"`
	Enabled           bool               `json:"enabled" yaml:"enabled"`
	Parameters        *PagingParameters  `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	DataInfoSelectors *DataInfoSelectors `json:"dataInfoSelectors,omitempty" yaml:"dataInfoSelectors,omitempty"`
}

type PagingParameters struct {
	Page string `json:"page,omitempty" yaml:"page,omitempty"`
	Size string `json:"size,omitempty" yaml:"size,omitempty"`
}

type DataInfoSelectors struct {
	PageCount  string `json:"pageCount,omitempty" yaml:"pageCount,omitempty"`
	TotalCount string `json:"totalCount,omitempty" yaml:"totalCount,omitempty"`
}

type DataDependency struct {
	Column        string `json:"column" yaml:"column"`
	RefDataSource string `json:"refDataSource" yaml:"refDataSource"`
	RefColumn     string `json:"refColumn" yaml:"refColumn"`
}

type Service struct {
	Endpoint string   `json:"endpoint" yaml:"endpoint"`
	URI      string   `json:"uri" yaml:"uri"`
	Method   string   `json:"method" yaml:"method"`
	Post     *Service `json:"post,omitempty" yaml:"post,omitempty"`
	Patch    *Service `json:"patch,omitempty" yaml:"patch,omitempty"`
	Put      *Service `json:"put,omitempty" yaml:"put,omitempty"`
	Delete   *Service `json:"delete,omitempty" yaml:"delete,omitempty"`
}

type Codec struct {
	Name string   `json:"name" yaml:"name"`
	Args []string `json:"args" yaml:"args"`
}

type Parameter struct {
	Name     string `json:"name" yaml:"name"`
	In       string `json:"in" yaml:"in"`
	To       string `json:"to,omitempty" yaml:"to,omitempty"`
	Kind     string `json:"kind,omitempty" yaml:"kind,omitempty"`
	Location string `json:"location,omitempty" yaml:"location,omitempty"`
	Scope    string `json:"scope,omitempty" yaml:"scope,omitempty"`
	Codec    *Codec `json:"codec,omitempty" yaml:"codec,omitempty"`
}

// JSONSchema mirrors the very small subset we need for
// runtime form generation: object-schemas with simple
// top-level properties, required list, enums, default.
type JSONSchema struct {
	Type       string                    `json:"type" yaml:"type"` // “object”
	Properties map[string]SchemaProperty `json:"properties" yaml:"properties"`
	Required   []string                  `json:"required,omitempty" yaml:"required,omitempty"`
}

type SchemaProperty struct {
	Type        string      `json:"type,omitempty" yaml:"type,omitempty"` // string, integer, …
	Description string      `json:"description,omitempty" yaml:"description,omitempty"`
	Enum        []string    `json:"enum,omitempty" yaml:"enum,omitempty"`
	Default     interface{} `json:"default,omitempty" yaml:"default,omitempty"`

	// ---------- UI vendor extensions (forge) -----------------
	UIOrder  int    `json:"x-ui-order,omitempty" yaml:"x-ui-order,omitempty"`
	UIWidget string `json:"x-ui-widget,omitempty" yaml:"x-ui-widget,omitempty"`
	UIGroup  string `json:"x-ui-group,omitempty"  yaml:"x-ui-group,omitempty"`
}

// Interaction is delivered by the event/data-source so that binding expressions can reference .Schema, .Message, .ID …
type Interaction struct {
	Id          string     `json:"id"`
	Message     string     `json:"message"`
	Schema      JSONSchema `json:"schema"` // draft-07
	StepId      string     `json:"stepId"`
	CreatedAt   string     `json:"createdAt"`
	CallbackURL string     `json:"callbackURL"`
}

// SchemaBasedForm renders a list of explicit FormField items
// instead of blindly consuming an entire JSON-Schema document.
type SchemaBasedForm struct {
	// Optional name so other widgets can reference the answers via
	// {{window.state.<Id>}}
	Id string `json:"id,omitempty"   yaml:"id,omitempty"`
	// Where to persist the collected answers (same semantics as Chat/Editor)
	DataBinding string `json:"dataBinding"    yaml:"dataBinding"`
	// Fields are rendered in slice order; you can still override per-field
	// order later via Field.Order.
	Fields []FormField      `json:"fields"         yaml:"fields"`
	Layout *Layout          `json:"layout,omitempty" yaml:"layout,omitempty"`
	Style  *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	On     []*Execute       `json:"on,omitempty"   yaml:"on,omitempty"`
}

// FormField describes a single control in the form.
type FormField struct {
	// Core
	Name     string      `json:"name"        yaml:"name"` // JSON key in the outgoing payload
	Label    string      `json:"label"       yaml:"label"`
	Type     string      `json:"type"        yaml:"type"` // string, integer, boolean …
	Required bool        `json:"required,omitempty" yaml:"required,omitempty"`
	Enum     []string    `json:"enum,omitempty"     yaml:"enum,omitempty"`
	Default  interface{} `json:"default,omitempty"  yaml:"default,omitempty"`

	// Ordering & grouping
	Order int    `json:"order,omitempty"    yaml:"order,omitempty"` // larger = later
	Group string `json:"group,omitempty"    yaml:"group,omitempty"` // accordion/fieldset key

	// Visuals / behaviour
	Widget      string           `json:"widget,omitempty"      yaml:"widget,omitempty"` // e.g. “textarea”, “datePicker”
	Placeholder string           `json:"placeholder,omitempty" yaml:"placeholder,omitempty"`
	Style       *StyleProperties `json:"style,omitempty"       yaml:"style,omitempty"`

	// Validation / dynamic UI
	Pattern   string   `json:"pattern,omitempty"     yaml:"pattern,omitempty"` // regex
	Min       *float64 `json:"min,omitempty"         yaml:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"         yaml:"max,omitempty"`
	VisibleIf string   `json:"visibleIf,omitempty"   yaml:"visibleIf,omitempty"` // expression evaluated in UI
}

const (
	EventInteractionCreated  = "interaction.created"
	EventInteractionResolved = "interaction.resolved"
)
