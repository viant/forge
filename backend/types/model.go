package types

import (
	"encoding/json"
	"fmt"
)

// TargetSpec declares where a metadata node applies.
// It supports short forms during unmarshal:
//
//	target: web
//	target: [web, android]
//
// as well as the expanded object form.
type TargetSpec struct {
	Platforms        []string `json:"platforms,omitempty" yaml:"platforms,omitempty"`
	ExcludePlatforms []string `json:"excludePlatforms,omitempty" yaml:"excludePlatforms,omitempty"`
	FormFactors      []string `json:"formFactors,omitempty" yaml:"formFactors,omitempty"`
	Capabilities     []string `json:"capabilities,omitempty" yaml:"capabilities,omitempty"`
}

func (t *TargetSpec) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		return nil
	}
	var text string
	if err := json.Unmarshal(data, &text); err == nil {
		t.Platforms = []string{text}
		return nil
	}
	var list []string
	if err := json.Unmarshal(data, &list); err == nil {
		t.Platforms = append([]string(nil), list...)
		return nil
	}
	type alias TargetSpec
	var expanded alias
	if err := json.Unmarshal(data, &expanded); err != nil {
		return fmt.Errorf("invalid target spec: %w", err)
	}
	*t = TargetSpec(expanded)
	return nil
}

func (t *TargetSpec) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var text string
	if err := unmarshal(&text); err == nil {
		t.Platforms = []string{text}
		return nil
	}
	var list []string
	if err := unmarshal(&list); err == nil {
		t.Platforms = append([]string(nil), list...)
		return nil
	}
	type alias TargetSpec
	var expanded alias
	if err := unmarshal(&expanded); err != nil {
		return fmt.Errorf("invalid target spec: %w", err)
	}
	*t = TargetSpec(expanded)
	return nil
}

type Chart struct {
	Type                  string            `json:"type" yaml:"type"`
	DataSourceRef         string            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	DataSourceRefSelector string            `json:"dataSourceRefSelector,omitempty" yaml:"dataSourceRefSelector,omitempty"`
	DataSourceRefSource   string            `json:"dataSourceRefSource,omitempty" yaml:"dataSourceRefSource,omitempty"`
	DataSourceRefs        map[string]string `json:"dataSourceRefs,omitempty" yaml:"dataSourceRefs,omitempty"`
	XAxis                 ChartXAxis        `json:"xAxis" yaml:"xAxis"`
	YAxis                 ChartYAxis        `json:"yAxis" yaml:"yAxis"`
	Axes                  *ChartAxes        `json:"axes,omitempty" yaml:"axes,omitempty"`
	CartesianGrid         CartesianGrid     `json:"cartesianGrid,omitempty" yaml:"cartesianGrid,omitempty"`
	Width                 string            `json:"width" yaml:"width"`
	Height                string            `json:"height" yaml:"height"`
	CategoryKey           string            `json:"categoryKey,omitempty" yaml:"categoryKey,omitempty"`
	ValueKey              string            `json:"valueKey,omitempty" yaml:"valueKey,omitempty"`
	Format                string            `json:"format,omitempty" yaml:"format,omitempty"`
	Palette               []string          `json:"palette,omitempty" yaml:"palette,omitempty"`
	Series                ChartSeries       `json:"series" yaml:"series"`
	On                    []*Execute        `json:"on,omitempty" yaml:"on,omitempty"`
}

type ChartXAxis struct {
	DataKey    string `json:"dataKey" yaml:"dataKey"`
	Label      string `json:"label,omitempty" yaml:"label,omitempty"`
	TickFormat string `json:"tickFormat,omitempty" yaml:"tickFormat,omitempty"`
}

type ChartYAxis struct {
	Label  string        `json:"label,omitempty" yaml:"label,omitempty"`
	Format string        `json:"format,omitempty" yaml:"format,omitempty"`
	Domain []interface{} `json:"domain,omitempty" yaml:"domain,omitempty"`
}

type ChartAxes struct {
	Left  *ChartYAxis `json:"left,omitempty" yaml:"left,omitempty"`
	Right *ChartYAxis `json:"right,omitempty" yaml:"right,omitempty"`
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
	Label           string  `json:"label" yaml:"label"`
	Name            string  `json:"name,omitempty" yaml:"name,omitempty"`
	Value           string  `json:"value" yaml:"value"`
	Type            string  `json:"type,omitempty" yaml:"type,omitempty"`
	Axis            string  `json:"axis,omitempty" yaml:"axis,omitempty"`
	Format          string  `json:"format,omitempty" yaml:"format,omitempty"`
	Color           string  `json:"color,omitempty" yaml:"color,omitempty"`
	StrokeWidth     float64 `json:"strokeWidth,omitempty" yaml:"strokeWidth,omitempty"`
	StrokeDasharray string  `json:"strokeDasharray,omitempty" yaml:"strokeDasharray,omitempty"`
	FillOpacity     float64 `json:"fillOpacity,omitempty" yaml:"fillOpacity,omitempty"`
	Opacity         float64 `json:"opacity,omitempty" yaml:"opacity,omitempty"`
	StackID         string  `json:"stackId,omitempty" yaml:"stackId,omitempty"`
}

type NavigationItem struct {
	ID              string                            `json:"id" yaml:"id"`
	Label           string                            `json:"label" yaml:"label"`
	Icon            string                            `json:"icon" yaml:"icon"`
	WindowKey       string                            `json:"windowKey" yaml:"windowKey"`
	WindowTitle     string                            `json:"windowTitle" yaml:"windowTitle"`
	MultiInstance   bool                              `json:"multiInstance,omitempty" yaml:"multiInstance,omitempty"`
	ChildNodes      []NavigationItem                  `json:"childNodes,omitempty" yaml:"childNodes,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
}

// Dialog represents a dialog with a title, content, actions, and on events.
type Dialog struct {
	Id              string                            `json:"id" yaml:"id"`
	Title           string                            `json:"title" yaml:"title"`
	DataSourceRef   string                            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Content         *Container                        `json:"content" yaml:"content"`
	ClassName       string                            `json:"className,omitempty" yaml:"className,omitempty"`
	Style           *StyleProperties                  `json:"style,omitempty" yaml:"style,omitempty"`
	Properties      *DialogProperties                 `json:"properties,omitempty" yaml:"properties,omitempty"`
	Actions         []Item                            `json:"actions" yaml:"actions"`
	On              []*Execute                        `json:"on,omitempty" yaml:"on,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
}

// DialogProperties holds optional flags that tweak dialog UI behavior.
// Example: properties.searchable: false hides the quick-search input in the dialog header.
type DialogProperties struct {
	Searchable       *bool                    `json:"searchable,omitempty" yaml:"searchable,omitempty"`
	ClassName        string                   `json:"className,omitempty" yaml:"className,omitempty"`
	BodyClassName    string                   `json:"bodyClassName,omitempty" yaml:"bodyClassName,omitempty"`
	BodyStyle        map[string]interface{}   `json:"bodyStyle,omitempty" yaml:"bodyStyle,omitempty"`
	ContentClassName string                   `json:"contentClassName,omitempty" yaml:"contentClassName,omitempty"`
	ContentStyle     map[string]interface{}   `json:"contentStyle,omitempty" yaml:"contentStyle,omitempty"`
	QuickSearch      *DialogQuickSearchConfig `json:"quickSearch,omitempty" yaml:"quickSearch,omitempty"`
	QuickFilter      *QuickFilterSpec         `json:"quickFilter,omitempty" yaml:"quickFilter,omitempty"`
	QuickFilters     []QuickFilterSpec        `json:"quickFilters,omitempty" yaml:"quickFilters,omitempty"`
}

type DialogQuickSearchConfig struct {
	Align          string                 `json:"align,omitempty" yaml:"align,omitempty"`
	Gap            string                 `json:"gap,omitempty" yaml:"gap,omitempty"`
	Icon           string                 `json:"icon,omitempty" yaml:"icon,omitempty"`
	Trigger        string                 `json:"trigger,omitempty" yaml:"trigger,omitempty"`
	DebounceMs     int                    `json:"debounceMs,omitempty" yaml:"debounceMs,omitempty"`
	InputWidth     string                 `json:"inputWidth,omitempty" yaml:"inputWidth,omitempty"`
	ClassName      string                 `json:"className,omitempty" yaml:"className,omitempty"`
	InputClassName string                 `json:"inputClassName,omitempty" yaml:"inputClassName,omitempty"`
	Style          map[string]interface{} `json:"style,omitempty" yaml:"style,omitempty"`
	InputStyle     map[string]interface{} `json:"inputStyle,omitempty" yaml:"inputStyle,omitempty"`
}

type QuickFilterSpec struct {
	Field       string                 `json:"field,omitempty" yaml:"field,omitempty"`
	Placeholder string                 `json:"placeholder,omitempty" yaml:"placeholder,omitempty"`
	Width       string                 `json:"width,omitempty" yaml:"width,omitempty"`
	Icon        string                 `json:"icon,omitempty" yaml:"icon,omitempty"`
	Trigger     string                 `json:"trigger,omitempty" yaml:"trigger,omitempty"`
	DebounceMs  int                    `json:"debounceMs,omitempty" yaml:"debounceMs,omitempty"`
	ClassName   string                 `json:"className,omitempty" yaml:"className,omitempty"`
	Style       map[string]interface{} `json:"style,omitempty" yaml:"style,omitempty"`
}

type Window struct {
	Ns              []string                          `json:"ns,omitempty" yaml:"ns,omitempty"`
	Namespace       string                            `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	DataSource      map[string]DataSource             `json:"dataSource" yaml:"dataSource"`
	View            View                              `json:"view" yaml:"view"`
	Dialogs         []Dialog                          `json:"dialogs,omitempty" yaml:"dialogs,omitempty"`
	Actions         *Actions                          `json:"actions,omitempty" yaml:"actions,omitempty"`
	On              []*Execute                        `json:"on,omitempty" yaml:"on,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
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
	Layout          Layout                            `json:"layout,omitempty" yaml:"layout,omitempty"`
	Content         *Container                        `json:"content" yaml:"content"`
	On              []*Execute                        `json:"on,omitempty" yaml:"on,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
}

type Layout struct {
	Kind          string   `json:"kind,omitempty" yaml:"kind,omitempty"`
	Orientation   string   `json:"orientation" yaml:"orientation"`
	Rows          int      `json:"rows" yaml:"rows"`
	Columns       int      `json:"columns,omitempty" yaml:"columns,omitempty"`
	Gap           string   `json:"gap,omitempty" yaml:"gap,omitempty"`
	RowGap        string   `json:"rowGap,omitempty" yaml:"rowGap,omitempty"`
	ColumnGap     string   `json:"columnGap,omitempty" yaml:"columnGap,omitempty"`
	LabelPosition string   `json:"labelPosition,omitempty" yaml:"labelPosition,omitempty"`
	Labels        *Labels  `json:"labels,omitempty" yaml:"labels,omitempty"`
	Divider       *Divider `json:"divider,omitempty" yaml:"divider,omitempty"`
}

type Divider struct {
	Visible bool  `json:"visible,omitempty" yaml:"visible,omitempty"`
	Sizes   []int `json:"sizes,omitempty" yaml:"sizes,omitempty"`
}

// Labels config controls label rendering strategy for grid layouts.
// When omitted, front-end defaults apply (currently "left" in grid mode).
type Labels struct {
	Mode   string `json:"mode,omitempty" yaml:"mode,omitempty"`     // "left" | "top" | "none"
	Width  string `json:"width,omitempty" yaml:"width,omitempty"`   // only used for Mode "left"
	Height string `json:"height,omitempty" yaml:"height,omitempty"` // only used for Mode "top"
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
	ID                string `json:"id" yaml:"id"`
	Binding           `yaml:",inline"`
	Target            *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides   map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
	State             *Parameter                        `json:"state,omitempty" yaml:"state,omitempty"`
	Title             string                            `json:"title,omitempty" yaml:"title,omitempty"`
	Subtitle          string                            `json:"subtitle,omitempty" yaml:"subtitle,omitempty"`
	Kind              string                            `json:"kind,omitempty" yaml:"kind,omitempty"`
	Role              string                            `json:"role,omitempty" yaml:"role,omitempty"`
	FilterBindings    map[string]string                 `json:"filterBindings,omitempty" yaml:"filterBindings,omitempty"`
	SelectionBindings map[string]string                 `json:"selectionBindings,omitempty" yaml:"selectionBindings,omitempty"`
	ColumnSpan        int                               `json:"columnSpan,omitempty" yaml:"columnSpan,omitempty"`
	RowSpan           int                               `json:"rowSpan,omitempty" yaml:"rowSpan,omitempty"`
	DefaultMode       string                            `json:"defaultMode,omitempty" yaml:"defaultMode,omitempty"`
	Layout            *Layout                           `json:"layout,omitempty" yaml:"layout,omitempty"`
	Style             *StyleProperties                  `json:"style,omitempty" yaml:"style,omitempty"`
	VisibleWhen       map[string]interface{}            `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	Toolbar           *Toolbar                          `json:"toolbar,omitempty" yaml:"toolbar,omitempty"`
	Table             *Table                            `json:"table,omitempty" yaml:"table,omitempty"`
	FileBrowser       *FileBrowser                      `json:"fileBrowser,omitempty" yaml:"fileBrowser,omitempty"`
	TreeBrowser       *TreeBrowser                      `json:"treeBrowser,omitempty" yaml:"treeBrowser,omitempty"`
	Editor            *Editor                           `json:"editor,omitempty" yaml:"editor,omitempty"`
	Terminal          *Terminal                         `json:"terminal,omitempty" yaml:"terminal,omitempty"`
	Chart             *Chart                            `json:"chart,omitempty" yaml:"chart,omitempty"`
	Chat              *Chat                             `json:"chat,omitempty" yaml:"chat,omitempty"`
	Section           *Section                          `json:"section,omitempty" yaml:"section,omitempty"`
	Items             []Item                            `json:"items,omitempty" yaml:"items,omitempty"`
	Card              *Card                             `json:"card,omitempty" yaml:"card,omitempty"`
	Footer            *Container                        `json:"footer,omitempty" yaml:"footer,omitempty"`
	Containers        []Container                       `json:"containers,omitempty" yaml:"containers,omitempty"`
	SchemaBasedForm   *SchemaBasedForm                  `json:"schemaBasedForm,omitempty" yaml:"schemaBasedForm,omitempty"`
	On                []*Execute                        `json:"on,omitempty" yaml:"on,omitempty"`
	Tabs              *Tabs                             `json:"tabs,omitempty" yaml:"tabs,omitempty"`
	Dialogs           []string                          `json:"dialogs,omitempty" yaml:"dialogs,omitempty"`
	Repeat            *Repeat                           `json:"repeat,omitempty" yaml:"repeat,omitempty"`
	SelectFirst       bool                              `json:"selectFirst,omitempty"  yaml:"selectFirst,omitempty"`
	FetchData         bool                              `json:"fetchData,omitempty"  yaml:"fetchData,omitempty"`
	Dashboard         *Dashboard                        `json:"dashboard,omitempty" yaml:"dashboard,omitempty"`
}

func (c *Container) UnmarshalJSON(data []byte) error {
	type alias Container
	var decoded alias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	var compact dashboardCompactAliases
	if err := json.Unmarshal(data, &compact); err != nil {
		return err
	}
	*c = Container(decoded)
	c.applyDashboardCompactAliases(compact)
	if c.Kind == "dashboard.filters" && c.Dashboard != nil && c.Dashboard.Filters != nil && len(c.Dashboard.Filters.Items) > 0 {
		c.Items = nil
	}
	return nil
}

func (c *Container) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type alias Container
	var decoded alias
	if err := unmarshal(&decoded); err != nil {
		return err
	}
	var compact dashboardCompactAliases
	if err := unmarshal(&compact); err != nil {
		return err
	}
	*c = Container(decoded)
	c.applyDashboardCompactAliases(compact)
	if c.Kind == "dashboard.filters" && c.Dashboard != nil && c.Dashboard.Filters != nil && len(c.Dashboard.Filters.Items) > 0 {
		c.Items = nil
	}
	return nil
}

// Terminal declares a terminal-like, scrollable log/command view in a container.
// It binds to a DataSource that provides entries shaped like:
//
//	{ input: string, output?: string, stderr?: string, code?: number }
//
// Frontend also accepts `stderro` and `status` as aliases.
type Terminal struct {
	// DataSourceRef points to the data source that supplies terminal entries.
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	// Optional toolbar to host actions (e.g., run, clear).
	Toolbar *Toolbar `json:"toolbar,omitempty" yaml:"toolbar,omitempty"`
	// Visual options
	Height       string `json:"height,omitempty" yaml:"height,omitempty"`
	Prompt       string `json:"prompt,omitempty" yaml:"prompt,omitempty"`
	AutoScroll   *bool  `json:"autoScroll,omitempty" yaml:"autoScroll,omitempty"`
	ShowDividers *bool  `json:"showDividers,omitempty" yaml:"showDividers,omitempty"`
	// Truncation options for long outputs
	TruncateLongOutput *bool `json:"truncateLongOutput,omitempty" yaml:"truncateLongOutput,omitempty"`
	TruncateLength     int   `json:"truncateLength,omitempty" yaml:"truncateLength,omitempty"`
}

type Chat struct {
	// DataSourceRef points to the data source that supplies messages.
	DataSourceRef   string                            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
	Toolbar         *Toolbar                          `json:"toolbar,omitempty" yaml:"toolbar,omitempty"`
	Height          string                            `json:"height,omitempty" yaml:"height,omitempty"`
	// ShowUpload controls whether file upload input should be displayed (default true).
	ShowUpload bool `json:"showUpload,omitempty" yaml:"showUpload,omitempty"`
	// Upload optional configuration for file uploads (endpoint/path/uri).
	Upload *Upload `json:"upload,omitempty" yaml:"upload,omitempty"`
	// UploadField publishes uploaded files to this form field (default: "upload").
	UploadField  string `json:"uploadField,omitempty" yaml:"uploadField,omitempty"`
	ShowAbort    bool   `json:"showAbort,omitempty" yaml:"showAbort,omitempty"`
	ShowSettings bool   `json:"showSettings,omitempty" yaml:"showSettings,omitempty"`
	// ShowTools toggles the tools picker in the composer.
	ShowTools bool `json:"showTools,omitempty" yaml:"showTools,omitempty"`
	// ShowMic toggles the microphone icon in the composer (to the left of Send).
	ShowMic bool `json:"showMic,omitempty" yaml:"showMic,omitempty"`
	// CommandCenter enables the "composer-as-command-center" UI layout.
	CommandCenter bool `json:"commandCenter,omitempty" yaml:"commandCenter,omitempty"`
	// AbortVisible allows declarative, data-bound control of the abort button
	// visibility. When provided, the UI shows the abort button if the value
	// resolved at `selector` matches `when` (or is truthy if `when` is omitted).
	// Example:
	//   abortVisible: { selector: "job.status", when: ["queued", "running"] }
	AbortVisible          *SelectorCondition `json:"abortVisible,omitempty" yaml:"abortVisible,omitempty"`
	DisableInputOnLoading bool               `json:"disableInputOnLoading,omitempty" yaml:"disableInputOnLoading,omitempty"`

	// Tooltips optional per-icon tooltip labels for the composer controls.
	Tooltips *ChatTooltips `json:"tooltips,omitempty" yaml:"tooltips,omitempty"`

	// On defines event handlers such as submit, upload
	On []*Execute `json:"on,omitempty" yaml:"on,omitempty"`
}

// ChatTooltips configures tooltip texts for chat composer icons.
type ChatTooltips struct {
	Upload   string `json:"upload,omitempty" yaml:"upload,omitempty"`
	Settings string `json:"settings,omitempty" yaml:"settings,omitempty"`
	Mic      string `json:"mic,omitempty" yaml:"mic,omitempty"`
	Send     string `json:"send,omitempty" yaml:"send,omitempty"`
	Abort    string `json:"abort,omitempty" yaml:"abort,omitempty"`
}

// Upload configures the chat upload flow.
type Upload struct {
	// Endpoint key from frontend settings (SettingProvider.endpoints)
	Endpoint string `json:"endpoint,omitempty" yaml:"endpoint,omitempty"`
	// Path relative to endpoint base (defaults to 'upload')
	Path string `json:"path,omitempty" yaml:"path,omitempty"`
	// Uri destination (prefix) relative to backend file service root
	Uri string `json:"uri,omitempty" yaml:"uri,omitempty"`
	// Absolute URL override. If set, takes precedence over endpoint/path.
	URL string `json:"url,omitempty" yaml:"url,omitempty"`
}

type FileBrowser struct {
	Title         string           `json:"title" yaml:"title"`
	DataSourceRef string           `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	FolderOnly    bool             `json:"folderOnly" yaml:"folderOnly"`
	Style         *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	On            []*Execute       `json:"on,omitempty" yaml:"on,omitempty"`
}

type TreeBrowser struct {
	Title         string           `json:"title,omitempty" yaml:"title,omitempty"`
	DataSourceRef string           `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	PathField     string           `json:"pathField,omitempty" yaml:"pathField,omitempty"`
	LabelField    string           `json:"labelField,omitempty" yaml:"labelField,omitempty"`
	ValueField    string           `json:"valueField,omitempty" yaml:"valueField,omitempty"`
	SubtitleField string           `json:"subtitleField,omitempty" yaml:"subtitleField,omitempty"`
	ChildrenField string           `json:"childrenField,omitempty" yaml:"childrenField,omitempty"`
	Separator     string           `json:"separator,omitempty" yaml:"separator,omitempty"`
	LazyExpand    bool             `json:"lazyExpand,omitempty" yaml:"lazyExpand,omitempty"`
	ClassName     string           `json:"className,omitempty" yaml:"className,omitempty"`
	Style         *StyleProperties `json:"style,omitempty" yaml:"style,omitempty"`
	On            []*Execute       `json:"on,omitempty" yaml:"on,omitempty"`
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

// SelectorCondition describes a condition based on a selector and a value
// match. The `when` field can be a scalar (string/number/bool) or an array of
// values to match against.
type SelectorCondition struct {
	// Optional override to read the selector from another DataSource.
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Selector      string `json:"selector,omitempty" yaml:"selector,omitempty"`
	When          any    `json:"when,omitempty" yaml:"when,omitempty"`
}

// DashboardCondition extends SelectorCondition with threshold and emptiness
// operators used by dashboard blocks.
type DashboardCondition struct {
	DataSourceRef string   `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Selector      string   `json:"selector,omitempty" yaml:"selector,omitempty"`
	Field         string   `json:"field,omitempty" yaml:"field,omitempty"`
	Key           string   `json:"key,omitempty" yaml:"key,omitempty"`
	Source        string   `json:"source,omitempty" yaml:"source,omitempty"`
	When          any      `json:"when,omitempty" yaml:"when,omitempty"`
	Equals        any      `json:"equals,omitempty" yaml:"equals,omitempty"`
	NotEquals     any      `json:"notEquals,omitempty" yaml:"notEquals,omitempty"`
	In            []any    `json:"in,omitempty" yaml:"in,omitempty"`
	Gt            *float64 `json:"gt,omitempty" yaml:"gt,omitempty"`
	Gte           *float64 `json:"gte,omitempty" yaml:"gte,omitempty"`
	Lt            *float64 `json:"lt,omitempty" yaml:"lt,omitempty"`
	Lte           *float64 `json:"lte,omitempty" yaml:"lte,omitempty"`
	Empty         *bool    `json:"empty,omitempty" yaml:"empty,omitempty"`
	NotEmpty      *bool    `json:"notEmpty,omitempty" yaml:"notEmpty,omitempty"`
}

type Dashboard struct {
	VisibleWhen *DashboardCondition   `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	Summary     *DashboardSummary     `json:"summary,omitempty" yaml:"summary,omitempty"`
	Compare     *DashboardCompare     `json:"compare,omitempty" yaml:"compare,omitempty"`
	KPITable    *DashboardKPITable    `json:"kpiTable,omitempty" yaml:"kpiTable,omitempty"`
	Filters     *DashboardFilters     `json:"filters,omitempty" yaml:"filters,omitempty"`
	Geo         *DashboardGeoMap      `json:"geo,omitempty" yaml:"geo,omitempty"`
	Timeline    *DashboardTimeline    `json:"timeline,omitempty" yaml:"timeline,omitempty"`
	Composition *DashboardComposition `json:"composition,omitempty" yaml:"composition,omitempty"`
	Dimensions  *DashboardDimensions  `json:"dimensions,omitempty" yaml:"dimensions,omitempty"`
	Messages    *DashboardMessages    `json:"messages,omitempty" yaml:"messages,omitempty"`
	Status      *DashboardStatus      `json:"status,omitempty" yaml:"status,omitempty"`
	Feed        *DashboardFeed        `json:"feed,omitempty" yaml:"feed,omitempty"`
	Report      *DashboardReport      `json:"report,omitempty" yaml:"report,omitempty"`
	// ReportOptions controls the dashboard-level report mode. The older
	// compact alias is Container.report.
	ReportOptions *DashboardReportOptions `json:"reportOptions,omitempty" yaml:"reportOptions,omitempty"`
	Detail        *DashboardDetail        `json:"detail,omitempty" yaml:"detail,omitempty"`
	Badges        *DashboardBadges        `json:"badges,omitempty" yaml:"badges,omitempty"`
	Table         *DashboardTable         `json:"table,omitempty" yaml:"table,omitempty"`
}

func (c *Container) ensureDashboard() *Dashboard {
	if c.Dashboard == nil {
		c.Dashboard = &Dashboard{}
	}
	return c.Dashboard
}

func (c *Container) applyDashboardCompactAliases(compact dashboardCompactAliases) {
	if compact.VisibleWhen != nil {
		dashboard := c.ensureDashboard()
		if dashboard.VisibleWhen == nil {
			dashboard.VisibleWhen = compact.VisibleWhen
		}
	}
	if compact.Report != nil {
		c.ensureDashboard().ReportOptions = compact.Report
	}

	switch c.Kind {
	case "dashboard.summary":
		if len(compact.Metrics) > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Summary == nil {
				dashboard.Summary = &DashboardSummary{}
			}
			if len(dashboard.Summary.Metrics) == 0 {
				dashboard.Summary.Metrics = compact.Metrics
			}
		}
	case "dashboard.kpiTable":
		if len(compact.Rows) > 0 || len(compact.Columns) > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.KPITable == nil {
				dashboard.KPITable = &DashboardKPITable{}
			}
			if len(dashboard.KPITable.Rows) == 0 {
				dashboard.KPITable.Rows = compact.Rows
			}
			if len(dashboard.KPITable.Columns) == 0 {
				dashboard.KPITable.Columns = compact.Columns
			}
		}
	case "dashboard.filters":
		if len(compact.FilterItems) > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Filters == nil {
				dashboard.Filters = &DashboardFilters{}
			}
			if len(dashboard.Filters.Items) == 0 {
				dashboard.Filters.Items = compact.FilterItems
			}
		}
	case "dashboard.geoMap":
		if compact.Geo != nil || compact.Metric != nil || compact.Limit > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Geo == nil {
				dashboard.Geo = &DashboardGeoMap{}
			}
			if compact.Geo != nil {
				geo := *compact.Geo
				dashboard.Geo = &geo
			}
			if dashboard.Geo.Metric == nil {
				dashboard.Geo.Metric = compact.Metric
			}
			if dashboard.Geo.Limit == 0 {
				dashboard.Geo.Limit = compact.Limit
			}
		}
	case "dashboard.dimensions":
		if compact.Dimension != nil || compact.Metric != nil || len(compact.ViewModes) > 0 || compact.Limit > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Dimensions == nil {
				dashboard.Dimensions = &DashboardDimensions{}
			}
			if dashboard.Dimensions.Dimension == nil {
				dashboard.Dimensions.Dimension = compact.Dimension
			}
			if dashboard.Dimensions.Metric == nil {
				dashboard.Dimensions.Metric = compact.Metric
			}
			if len(dashboard.Dimensions.ViewModes) == 0 {
				dashboard.Dimensions.ViewModes = compact.ViewModes
			}
			if dashboard.Dimensions.Limit == 0 {
				dashboard.Dimensions.Limit = compact.Limit
			}
		}
	case "dashboard.status":
		if len(compact.Checks) > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Status == nil {
				dashboard.Status = &DashboardStatus{}
			}
			if len(dashboard.Status.Checks) == 0 {
				dashboard.Status.Checks = compact.Checks
			}
		}
	case "dashboard.feed":
		if compact.Fields != nil {
			dashboard := c.ensureDashboard()
			if dashboard.Feed == nil {
				dashboard.Feed = &DashboardFeed{}
			}
			if dashboard.Feed.Fields == nil {
				dashboard.Feed.Fields = compact.Fields
			}
		}
	case "dashboard.report":
		if len(compact.Sections) > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Report == nil {
				dashboard.Report = &DashboardReport{}
			}
			if len(dashboard.Report.Sections) == 0 {
				dashboard.Report.Sections = compact.Sections
			}
		}
	case "dashboard.table":
		if len(compact.Columns) > 0 || compact.Limit > 0 || compact.QuickFilter || compact.Density != "" || len(compact.FormattingRules) > 0 || len(compact.RowActions) > 0 {
			dashboard := c.ensureDashboard()
			if dashboard.Table == nil {
				dashboard.Table = &DashboardTable{}
			}
			if len(dashboard.Table.Columns) == 0 {
				dashboard.Table.Columns = compact.Columns
			}
			if dashboard.Table.Limit == 0 {
				dashboard.Table.Limit = compact.Limit
			}
			if !dashboard.Table.QuickFilter {
				dashboard.Table.QuickFilter = compact.QuickFilter
			}
			if dashboard.Table.Density == "" {
				dashboard.Table.Density = compact.Density
			}
			if len(dashboard.Table.FormattingRules) == 0 {
				dashboard.Table.FormattingRules = compact.FormattingRules
			}
			if len(dashboard.Table.RowActions) == 0 {
				dashboard.Table.RowActions = compact.RowActions
			}
		}
	}
}

// dashboardCompactAliases preserves the original compact metadata shape:
//
//	kind: dashboard.geoMap
//	geo: ...
//	metric: ...
//
// New metadata should prefer the grouped form under Container.dashboard, but
// these aliases remain encoded at the container level for backward
// compatibility and concise hand-written YAML.
type dashboardCompactAliases struct {
	VisibleWhen     *DashboardCondition      `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	Report          *DashboardReportOptions  `json:"report,omitempty" yaml:"report,omitempty"`
	Metrics         []DashboardMetric        `json:"metrics,omitempty" yaml:"metrics,omitempty"`
	Rows            []DashboardKPIRow        `json:"rows,omitempty" yaml:"rows,omitempty"`
	Checks          []DashboardStatusCheck   `json:"checks,omitempty" yaml:"checks,omitempty"`
	Fields          *DashboardFeedFields     `json:"fields,omitempty" yaml:"fields,omitempty"`
	FilterItems     []DashboardFilterItem    `json:"items,omitempty" yaml:"items,omitempty"`
	Sections        []DashboardReportSection `json:"sections,omitempty" yaml:"sections,omitempty"`
	Metric          *DashboardField          `json:"metric,omitempty" yaml:"metric,omitempty"`
	Dimension       *DashboardField          `json:"dimension,omitempty" yaml:"dimension,omitempty"`
	Geo             *DashboardGeoMap         `json:"geo,omitempty" yaml:"geo,omitempty"`
	Limit           int                      `json:"limit,omitempty" yaml:"limit,omitempty"`
	ViewModes       []string                 `json:"viewModes,omitempty" yaml:"viewModes,omitempty"`
	Columns         []DashboardTableColumn   `json:"columns,omitempty" yaml:"columns,omitempty"`
	QuickFilter     bool                     `json:"quickFilter,omitempty" yaml:"quickFilter,omitempty"`
	Density         string                   `json:"density,omitempty" yaml:"density,omitempty"`
	FormattingRules []TableFormattingRule    `json:"formattingRules,omitempty" yaml:"formattingRules,omitempty"`
	RowActions      []DashboardTableAction   `json:"rowActions,omitempty" yaml:"rowActions,omitempty"`
}

type DashboardReportOptions struct {
	Enabled      bool            `json:"enabled,omitempty" yaml:"enabled,omitempty"`
	Mode         string          `json:"mode,omitempty" yaml:"mode,omitempty"`
	Title        string          `json:"title,omitempty" yaml:"title,omitempty"`
	Subtitle     string          `json:"subtitle,omitempty" yaml:"subtitle,omitempty"`
	DefaultMode  string          `json:"defaultMode,omitempty" yaml:"defaultMode,omitempty"`
	GeneratedAt  string          `json:"generatedAt,omitempty" yaml:"generatedAt,omitempty"`
	Include      []string        `json:"include,omitempty" yaml:"include,omitempty"`
	Export       []string        `json:"export,omitempty" yaml:"export,omitempty"`
	IncludeState map[string]bool `json:"includeState,omitempty" yaml:"includeState,omitempty"`
}

type DashboardSummary struct {
	Metrics []DashboardMetric `json:"metrics,omitempty" yaml:"metrics,omitempty"`
}

type DashboardCompare struct {
	Items []DashboardCompareItem `json:"items,omitempty" yaml:"items,omitempty"`
}

type DashboardCompareItem struct {
	ID           string `json:"id,omitempty" yaml:"id,omitempty"`
	Label        string `json:"label,omitempty" yaml:"label,omitempty"`
	Current      string `json:"current,omitempty" yaml:"current,omitempty"`
	Previous     string `json:"previous,omitempty" yaml:"previous,omitempty"`
	Format       string `json:"format,omitempty" yaml:"format,omitempty"`
	DeltaFormat  string `json:"deltaFormat,omitempty" yaml:"deltaFormat,omitempty"`
	PositiveIsUp *bool  `json:"positiveIsUp,omitempty" yaml:"positiveIsUp,omitempty"`
	DeltaLabel   string `json:"deltaLabel,omitempty" yaml:"deltaLabel,omitempty"`
}

type DashboardKPITable struct {
	Rows    []DashboardKPIRow      `json:"rows,omitempty" yaml:"rows,omitempty"`
	Columns []DashboardTableColumn `json:"columns,omitempty" yaml:"columns,omitempty"`
}

type DashboardKPIRow struct {
	ID               string `json:"id,omitempty" yaml:"id,omitempty"`
	Label            string `json:"label,omitempty" yaml:"label,omitempty"`
	Value            string `json:"value,omitempty" yaml:"value,omitempty"`
	Format           string `json:"format,omitempty" yaml:"format,omitempty"`
	TimeZone         string `json:"timeZone,omitempty" yaml:"timeZone,omitempty"`
	TimeZoneSelector string `json:"timeZoneSelector,omitempty" yaml:"timeZoneSelector,omitempty"`
	Context          string `json:"context,omitempty" yaml:"context,omitempty"`
	ContextTone      string `json:"contextTone,omitempty" yaml:"contextTone,omitempty"`
}

type DashboardFilters struct {
	Items []DashboardFilterItem `json:"items,omitempty" yaml:"items,omitempty"`
}

type DashboardFilterItem struct {
	ID       string                  `json:"id,omitempty" yaml:"id,omitempty"`
	Type     string                  `json:"type,omitempty" yaml:"type,omitempty"`
	Label    string                  `json:"label,omitempty" yaml:"label,omitempty"`
	Field    string                  `json:"field,omitempty" yaml:"field,omitempty"`
	Multiple bool                    `json:"multiple,omitempty" yaml:"multiple,omitempty"`
	Options  []DashboardFilterOption `json:"options,omitempty" yaml:"options,omitempty"`
}

type DashboardFilterOption struct {
	Label   string `json:"label,omitempty" yaml:"label,omitempty"`
	Value   string `json:"value,omitempty" yaml:"value,omitempty"`
	Default bool   `json:"default,omitempty" yaml:"default,omitempty"`
}

type DashboardMetric struct {
	ID       string `json:"id,omitempty" yaml:"id,omitempty"`
	Label    string `json:"label,omitempty" yaml:"label,omitempty"`
	Selector string `json:"selector,omitempty" yaml:"selector,omitempty"`
	Format   string `json:"format,omitempty" yaml:"format,omitempty"`
}

type DashboardTimeline struct {
	ViewModes []string `json:"viewModes,omitempty" yaml:"viewModes,omitempty"`
	// Annotations are reserved for future timeline overlays; the current JS
	// runtime ignores this field in v1.
	Annotations *DashboardAnnotation `json:"annotations,omitempty" yaml:"annotations,omitempty"`
}

type DashboardComposition struct {
	CategoryKey string   `json:"categoryKey,omitempty" yaml:"categoryKey,omitempty"`
	ValueKey    string   `json:"valueKey,omitempty" yaml:"valueKey,omitempty"`
	Type        string   `json:"type,omitempty" yaml:"type,omitempty"`
	Format      string   `json:"format,omitempty" yaml:"format,omitempty"`
	Palette     []string `json:"palette,omitempty" yaml:"palette,omitempty"`
	LegendLimit int      `json:"legendLimit,omitempty" yaml:"legendLimit,omitempty"`
}

type DashboardAnnotation struct {
	Selector string `json:"selector,omitempty" yaml:"selector,omitempty"`
}

type DashboardDimensions struct {
	Dimension *DashboardField `json:"dimension,omitempty" yaml:"dimension,omitempty"`
	Metric    *DashboardField `json:"metric,omitempty" yaml:"metric,omitempty"`
	ViewModes []string        `json:"viewModes,omitempty" yaml:"viewModes,omitempty"`
	Limit     int             `json:"limit,omitempty" yaml:"limit,omitempty"`
	OrderBy   string          `json:"orderBy,omitempty" yaml:"orderBy,omitempty"`
}

type DashboardField struct {
	Key    string `json:"key,omitempty" yaml:"key,omitempty"`
	Label  string `json:"label,omitempty" yaml:"label,omitempty"`
	Format string `json:"format,omitempty" yaml:"format,omitempty"`
}

type DashboardGeoMap struct {
	Shape      string             `json:"shape,omitempty" yaml:"shape,omitempty"`
	Key        string             `json:"key,omitempty" yaml:"key,omitempty"`
	CodeKey    string             `json:"codeKey,omitempty" yaml:"codeKey,omitempty"`
	RegionKey  string             `json:"regionKey,omitempty" yaml:"regionKey,omitempty"`
	LabelKey   string             `json:"labelKey,omitempty" yaml:"labelKey,omitempty"`
	NameKey    string             `json:"nameKey,omitempty" yaml:"nameKey,omitempty"`
	Dimension  string             `json:"dimension,omitempty" yaml:"dimension,omitempty"`
	Metric     *DashboardField    `json:"metric,omitempty" yaml:"metric,omitempty"`
	MetricKey  string             `json:"metricKey,omitempty" yaml:"metricKey,omitempty"`
	ValueKey   string             `json:"valueKey,omitempty" yaml:"valueKey,omitempty"`
	ValueLabel string             `json:"valueLabel,omitempty" yaml:"valueLabel,omitempty"`
	Format     string             `json:"format,omitempty" yaml:"format,omitempty"`
	Aggregate  string             `json:"aggregate,omitempty" yaml:"aggregate,omitempty"`
	Legend     *bool              `json:"legend,omitempty" yaml:"legend,omitempty"`
	Palette    []string           `json:"palette,omitempty" yaml:"palette,omitempty"`
	EmptyColor string             `json:"emptyColor,omitempty" yaml:"emptyColor,omitempty"`
	Color      *DashboardGeoColor `json:"color,omitempty" yaml:"color,omitempty"`
	Limit      int                `json:"limit,omitempty" yaml:"limit,omitempty"`
}

type DashboardGeoColor struct {
	Field   string                  `json:"field,omitempty" yaml:"field,omitempty"`
	Palette []string                `json:"palette,omitempty" yaml:"palette,omitempty"`
	Empty   string                  `json:"empty,omitempty" yaml:"empty,omitempty"`
	Rules   []DashboardGeoColorRule `json:"rules,omitempty" yaml:"rules,omitempty"`
}

type DashboardGeoColorRule struct {
	Value  interface{} `json:"value,omitempty" yaml:"value,omitempty"`
	Equals interface{} `json:"equals,omitempty" yaml:"equals,omitempty"`
	When   interface{} `json:"when,omitempty" yaml:"when,omitempty"`
	Label  string      `json:"label,omitempty" yaml:"label,omitempty"`
	Color  string      `json:"color,omitempty" yaml:"color,omitempty"`
}

type DashboardMessages struct {
	Items []DashboardMessage `json:"items,omitempty" yaml:"items,omitempty"`
}

type DashboardMessage struct {
	Severity    string              `json:"severity,omitempty" yaml:"severity,omitempty"`
	Title       string              `json:"title,omitempty" yaml:"title,omitempty"`
	Body        string              `json:"body,omitempty" yaml:"body,omitempty"`
	VisibleWhen *DashboardCondition `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
}

type DashboardStatus struct {
	Checks []DashboardStatusCheck `json:"checks,omitempty" yaml:"checks,omitempty"`
}

type DashboardStatusCheck struct {
	ID       string         `json:"id,omitempty" yaml:"id,omitempty"`
	Label    string         `json:"label,omitempty" yaml:"label,omitempty"`
	Selector string         `json:"selector,omitempty" yaml:"selector,omitempty"`
	Format   string         `json:"format,omitempty" yaml:"format,omitempty"`
	Tone     *DashboardTone `json:"tone,omitempty" yaml:"tone,omitempty"`
}

type DashboardTone struct {
	WarningAbove float64 `json:"warningAbove,omitempty" yaml:"warningAbove,omitempty"`
	DangerAbove  float64 `json:"dangerAbove,omitempty" yaml:"dangerAbove,omitempty"`
	WarningBelow float64 `json:"warningBelow,omitempty" yaml:"warningBelow,omitempty"`
	DangerBelow  float64 `json:"dangerBelow,omitempty" yaml:"dangerBelow,omitempty"`
	SuccessAbove float64 `json:"successAbove,omitempty" yaml:"successAbove,omitempty"`
	SuccessBelow float64 `json:"successBelow,omitempty" yaml:"successBelow,omitempty"`
}

type DashboardFeed struct {
	Fields *DashboardFeedFields `json:"fields,omitempty" yaml:"fields,omitempty"`
}

type DashboardFeedFields struct {
	Title     string `json:"title,omitempty" yaml:"title,omitempty"`
	Body      string `json:"body,omitempty" yaml:"body,omitempty"`
	Timestamp string `json:"timestamp,omitempty" yaml:"timestamp,omitempty"`
	Severity  string `json:"severity,omitempty" yaml:"severity,omitempty"`
}

type DashboardReport struct {
	Sections []DashboardReportSection `json:"sections,omitempty" yaml:"sections,omitempty"`
}

type DashboardReportSection struct {
	ID          string              `json:"id,omitempty" yaml:"id,omitempty"`
	Title       string              `json:"title,omitempty" yaml:"title,omitempty"`
	Body        []string            `json:"body,omitempty" yaml:"body,omitempty"`
	Tone        string              `json:"tone,omitempty" yaml:"tone,omitempty"`
	VisibleWhen *DashboardCondition `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
}

type DashboardBadges struct {
	Items []DashboardBadgeItem `json:"items,omitempty" yaml:"items,omitempty"`
}

type DashboardBadgeItem struct {
	ID    string `json:"id,omitempty" yaml:"id,omitempty"`
	Label string `json:"label,omitempty" yaml:"label,omitempty"`
	Value string `json:"value,omitempty" yaml:"value,omitempty"`
	Tone  string `json:"tone,omitempty" yaml:"tone,omitempty"`
}

type DashboardTable struct {
	Columns         []DashboardTableColumn `json:"columns,omitempty" yaml:"columns,omitempty"`
	Limit           int                    `json:"limit,omitempty" yaml:"limit,omitempty"`
	QuickFilter     bool                   `json:"quickFilter,omitempty" yaml:"quickFilter,omitempty"`
	Density         string                 `json:"density,omitempty" yaml:"density,omitempty"`
	FormattingRules []TableFormattingRule  `json:"formattingRules,omitempty" yaml:"formattingRules,omitempty"`
	RowActions      []DashboardTableAction `json:"rowActions,omitempty" yaml:"rowActions,omitempty"`
}

type DashboardTableAction struct {
	ID        string `json:"id,omitempty" yaml:"id,omitempty"`
	Label     string `json:"label,omitempty" yaml:"label,omitempty"`
	Icon      string `json:"icon,omitempty" yaml:"icon,omitempty"`
	Field     string `json:"field,omitempty" yaml:"field,omitempty"`
	Dimension string `json:"dimension,omitempty" yaml:"dimension,omitempty"`
	Handler   string `json:"handler,omitempty" yaml:"handler,omitempty"`
}

type DashboardTableColumn struct {
	Key              string     `json:"key,omitempty" yaml:"key,omitempty"`
	Label            string     `json:"label,omitempty" yaml:"label,omitempty"`
	Format           string     `json:"format,omitempty" yaml:"format,omitempty"`
	TimeZone         string     `json:"timeZone,omitempty" yaml:"timeZone,omitempty"`
	TimeZoneSelector string     `json:"timeZoneSelector,omitempty" yaml:"timeZoneSelector,omitempty"`
	Align            string     `json:"align,omitempty" yaml:"align,omitempty"`
	Type             string     `json:"type,omitempty" yaml:"type,omitempty"`
	Link             *TableLink `json:"link,omitempty" yaml:"link,omitempty"`
}

// DashboardDetail is a marker block. Nested detail content is described by the
// parent Container.Containers slice rather than fields on this struct.
type DashboardDetail struct{}

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
	Columns           []Column              `json:"columns" yaml:"columns"`
	Toolbar           *Toolbar              `json:"toolbar,omitempty" yaml:"toolbar,omitempty"`
	EnforceColumnSize *bool                 `json:"enforceColumnSize,omitempty" yaml:"enforceColumnSize,omitempty"`
	Width             string                `json:"width,omitempty" yaml:"width,omitempty"`
	FullWidth         *bool                 `json:"fullWidth,omitempty" yaml:"fullWidth,omitempty"`
	Pagination        interface{}           `json:"pagination,omitempty" yaml:"pagination,omitempty"`
	FormattingRules   []TableFormattingRule `json:"formattingRules,omitempty" yaml:"formattingRules,omitempty"`
	On                []*Execute            `json:"on,omitempty" yaml:"on,omitempty"`
}

type TableFormattingRule struct {
	Field     string                 `json:"field,omitempty" yaml:"field,omitempty"`
	ColumnID  string                 `json:"columnId,omitempty" yaml:"columnId,omitempty"`
	Column    string                 `json:"column,omitempty" yaml:"column,omitempty"`
	Target    string                 `json:"target,omitempty" yaml:"target,omitempty"` // row|cell
	Operator  string                 `json:"operator,omitempty" yaml:"operator,omitempty"`
	Value     interface{}            `json:"value,omitempty" yaml:"value,omitempty"`
	Values    []interface{}          `json:"values,omitempty" yaml:"values,omitempty"`
	Style     map[string]interface{} `json:"style,omitempty" yaml:"style,omitempty"`
	ClassName string                 `json:"className,omitempty" yaml:"className,omitempty"`
}

type TableLink struct {
	Href   string `json:"href,omitempty" yaml:"href,omitempty"`
	Label  string `json:"label,omitempty" yaml:"label,omitempty"`
	Target string `json:"target,omitempty" yaml:"target,omitempty"`
	Rel    string `json:"rel,omitempty" yaml:"rel,omitempty"`
}

type Toolbar struct {
	Items           []Item                            `json:"items" yaml:"items"`
	Modes           []string                          `json:"modes,omitempty" yaml:"modes,omitempty"`
	DataSourceRef   string                            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Style           *StyleProperties                  `json:"style,omitempty" yaml:"style,omitempty"`
	ClassName       string                            `json:"className,omitempty" yaml:"className,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
}

type Column struct {
	ID                string                 `json:"id" yaml:"id"`
	Name              string                 `json:"name" yaml:"name"`
	Width             int                    `json:"width,omitempty" yaml:"width,omitempty"`
	Align             string                 `json:"align,omitempty" yaml:"align,omitempty"`
	NumericFormat     string                 `json:"numericFormat,omitempty" yaml:"numericFormat,omitempty"`
	Sortable          bool                   `json:"sortable,omitempty" yaml:"sortable,omitempty"`
	Icon              string                 `json:"icon,omitempty" yaml:"icon,omitempty"`
	Type              string                 `json:"type,omitempty" yaml:"type,omitempty"`
	MultiSelect       bool                   `json:"multiSelect,omitempty" yaml:"multiSelect,omitempty"`
	EnforceColumnSize bool                   `json:"enforceColumnSize,omitempty" yaml:"enforceColumnSize,omitempty"`
	Link              *TableLink             `json:"link,omitempty" yaml:"link,omitempty"`
	CellProperties    map[string]interface{} `json:"cellProperties,omitempty" yaml:"cellProperties,omitempty"`
	HeadProperties    map[string]interface{} `json:"headProperties,omitempty" yaml:"headProperties,omitempty"`
	Progress          *Progress              `json:"progress,omitempty" yaml:"progress,omitempty"`
	On                []*Execute             `json:"on,omitempty" yaml:"on,omitempty"`
	ToolTip           string                 `json:"tooltip" yaml:"tooltip"`
}

// TemplateItem represents a single template item with an ID and an operator.
type TemplateItem struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Operator string `json:"operator"`
	Type     string `json:"type,omitempty" yaml:"type,omitempty"`
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
	DataSourceRef         string            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	DataSourceRefSelector string            `json:"dataSourceRefSelector,omitempty" yaml:"dataSourceRefSelector,omitempty"`
	DataSourceRefSource   string            `json:"dataSourceRefSource,omitempty" yaml:"dataSourceRefSource,omitempty"`
	DataSourceRefs        map[string]string `json:"dataSourceRefs,omitempty" yaml:"dataSourceRefs,omitempty"`
	DataField             string            `json:"dataField,omitempty" yaml:"dataField,omitempty"`
	OptionsField          string            `json:"optionsField,omitempty" yaml:"optionsField,omitempty"`
	Path                  string            `json:"bindingPath,omitempty" yaml:"bindingPath,omitempty"`
	Scope                 string            `json:"scope,omitempty" yaml:"scope,omitempty"`
	MutationMode          string            `json:"mutationMode,omitempty" yaml:"mutationMode,omitempty"`
}
type Item struct {
	ID                   string `json:"id" yaml:"id"`
	Binding              `yaml:",inline"`
	Target               *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides      map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
	OptionDataSourceRets []string                          `json:"optionDataSourceRets,omitempty" yaml:"optionDataSourceRets,omitempty"`
	Value                interface{}                       `json:"value,omitempty" yaml:"value,omitempty"`
	Style                *StyleProperties                  `json:"style,omitempty" yaml:"style,omitempty"`
	Label                string                            `json:"label" yaml:"label"`
	LabelPosition        string                            `json:"labelPosition,omitempty" yaml:"labelPosition,omitempty"`
	Align                string                            `json:"align,omitempty" yaml:"align,omitempty"`
	Placement            string                            `json:"placement,omitempty" yaml:"placement,omitempty"`
	Options              []Option                          `json:"options,omitempty" yaml:"options,omitempty"`
	DateFnsFormat        string                            `json:"dateFnsFormat,omitempty" yaml:"dateFnsFormat,omitempty"`
	NumericFormat        string                            `json:"numericFormat,omitempty" yaml:"numericFormat,omitempty"`
	Icon                 string                            `json:"icon,omitempty" yaml:"icon,omitempty"`
	Type                 string                            `json:"type,omitempty" yaml:"type,omitempty"`
	Widget               string                            `json:"widget,omitempty" yaml:"widget,omitempty"`
	HideLabel            bool                              `json:"hideLabel,omitempty" yaml:"hideLabel,omitempty"`
	VisibleWhen          map[string]interface{}            `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	// ColumnSpan defines how many columns this item occupies in a grid layout.
	// Alternative casings ColSpan/colspan are accepted for backward compatibility.
	ColumnSpan int                    `json:"columnSpan,omitempty" yaml:"columnSpan,omitempty"`
	RowSpan    int                    `json:"rowSpan,omitempty" yaml:"rowSpan,omitempty"`
	Aggregate  interface{}            `json:"aggregate,omitempty" yaml:"aggregate,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty" yaml:"properties,omitempty"`
	Enabled    bool                   `json:"enabled,omitempty" yaml:"enabled,omitempty"`
	On         []*Execute             `json:"on,omitempty" yaml:"on,omitempty"` // For message-bus events
	Lookup     *Lookup                `json:"lookup,omitempty" yaml:"lookup,omitempty"`
}

// Lookup metadata enables text-input widgets to open a search window and map
// selected record fields back to the caller form.

type Lookup struct {
	// Either DialogId (preferred) or WindowId can be provided. When DialogId
	// is set, the UI opens a Forge dialog which renders a built-in
	// Cancel/OK footer. WindowId uses a floating window instead.
	DialogId     string `json:"dialogId,omitempty" yaml:"dialogId,omitempty"`
	WindowId     string `json:"windowId,omitempty" yaml:"windowId,omitempty"`
	DataSource   string `json:"dataSource,omitempty" yaml:"dataSource,omitempty"`
	Display      string `json:"display,omitempty" yaml:"display,omitempty"`
	QueryInput   string `json:"queryInput,omitempty" yaml:"queryInput,omitempty"`
	ResolveInput string `json:"resolveInput,omitempty" yaml:"resolveInput,omitempty"`

	Title string `json:"title,omitempty" yaml:"title,omitempty"`

	// Optional size for dialog/window.
	Size *LookupSize `json:"size,omitempty" yaml:"size,omitempty"`

	// Optional footer customisation for modal flows: labels/handlers.
	Footer *LookupFooter `json:"footer,omitempty" yaml:"footer,omitempty"`

	Inputs  []Parameter `json:"inputs,omitempty" yaml:"inputs,omitempty"`
	Outputs []Parameter `json:"outputs" yaml:"outputs"`
}

// LookupSize specifies optional width/height hints for the picker surface.
type LookupSize struct {
	Width  string `json:"width,omitempty" yaml:"width,omitempty"`
	Height string `json:"height,omitempty" yaml:"height,omitempty"`
}

// LookupFooter allows callers to override default Cancel/OK behaviour.
type LookupFooter struct {
	Ok     *LookupFooterAction `json:"ok,omitempty" yaml:"ok,omitempty"`
	Cancel *LookupFooterAction `json:"cancel,omitempty" yaml:"cancel,omitempty"`
}

type LookupFooterAction struct {
	// Handler refers to a namespaced action exposed to the UI, e.g. "schedule.onPickOk".
	Handler string `json:"handler,omitempty" yaml:"handler,omitempty"`
	Label   string `json:"label,omitempty" yaml:"label,omitempty"`
	// When false, OK remains enabled even with no current selection (default true).
	RequireSelection *bool `json:"requireSelection,omitempty" yaml:"requireSelection,omitempty"`
}

type Execute struct {
	Event           string                            `json:"event" yaml:"event"`
	Async           bool                              `json:"async,omitempty" yaml:"async,omitempty"`
	Arguments       []string                          `json:"args,omitempty" yaml:"args,omitempty"`
	Parameters      []*Parameter                      `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Init            string                            `json:"init,omitempty" yaml:"init,omitempty"`
	Handler         string                            `json:"handler,omitempty" yaml:"handler,omitempty"`
	OnError         string                            `json:"onError,omitempty" yaml:"onError,omitempty"`
	OnDone          string                            `json:"onDone,omitempty" yaml:"onDone,omitempty"`
	OnSuccess       string                            `json:"onSuccess,omitempty" yaml:"onSuccess,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
}

type Option struct {
	Value   string `json:"value" yaml:"value"`
	Label   string `json:"label" yaml:"label"`
	Tooltip string `json:"tooltip,omitempty" yaml:"tooltip,omitempty"`
}

type DataSource struct {
	Service         *Service                          `json:"service,omitempty" yaml:"service,omitempty"`
	DataSourceRef   string                            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Target          *TargetSpec                       `json:"target,omitempty" yaml:"target,omitempty"`
	TargetOverrides map[string]map[string]interface{} `json:"targetOverrides,omitempty" yaml:"targetOverrides,omitempty"`
	UniqueKey       []*UniqueKey                      `json:"uniqueKey,omitempty" yaml:"uniqueKey,omitempty"`
	Parameters      []Parameter                       `json:"parameters" yaml:"parameters"`
	On              []*Execute                        `json:"on,omitempty" yaml:"on,omitempty"`
	Cardinality     string                            `json:"cardinality" yaml:"cardinality"`
	Selectors       *Selectors                        `json:"selectors,omitempty" yaml:"selectors,omitempty"`
	SelectionMode   *SelectionMode                    `json:"selectionMode,omitempty" yaml:"selectionMode,omitempty"`
	Paging          *PagingConfig                     `json:"paging,omitempty" yaml:"paging,omitempty"`
	FilterSet       []Filter                          `json:"filterSet,omitempty" yaml:"filterSet,omitempty"`
	AutoSelect      *bool                             `json:"autoSelect,omitempty" yaml:"autoSelect,omitempty"`
	SelfReference   string                            `json:"selfReference,omitempty" yaml:"selfReference,omitempty"`
	// QuickFilterSet selects which filterSet should be rendered in the toolbar as quick filters.
	// Accepts either a string (filterSet.name) or an integer index (0-based).
	QuickFilterSet interface{} `json:"quickFilterSet,omitempty" yaml:"quickFilterSet,omitempty"`
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
	From      string `json:"from" yaml:"from"`                             //source [dataSource]:store
	Location  string `json:"location,omitempty" yaml:"location,omitempty"` //source selector
	To        string `json:"to" yaml:"to"`                                 //dest [dataSource]:store
	Name      string `json:"name" yaml:"name"`                             //dest selector
	Direction string `json:"direction,omitempty" yaml:"direction,omitempty"`
	Codec     *Codec `json:"codec,omitempty" yaml:"codec,omitempty"`
	Default   string `json:"default,omitempty" yaml:"default,omitempty"`

	//Deprecated
	In string `json:"in,omitempty" yaml:"in,omitempty"`
	//Deprecated
	Kind string `json:"kind,omitempty" yaml:"kind,omitempty"`
	//Deprecated
	Scope string `json:"scope,omitempty" yaml:"scope,omitempty"`
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
	Type        string      `json:"type,omitempty" yaml:"type,omitempty"`   // string, integer, …
	Title       string      `json:"title,omitempty" yaml:"title,omitempty"` // optional label override
	Description string      `json:"description,omitempty" yaml:"description,omitempty"`
	Format      string      `json:"format,omitempty" yaml:"format,omitempty"`
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

	DatasourceRef string `json:"datasourceRef,omitempty" yaml:"datasourceRef,omitempty"`
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
	Name  string `json:"name"        yaml:"name"` // JSON key in the outgoing payload
	Label string `json:"label"       yaml:"label"`
	// string, integer, boolean, object, array, schema …
	Type     string      `json:"type"        yaml:"type"`
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
