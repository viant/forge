package types

type PreviewWorkbenchSpec struct {
	Title                string                    `json:"title,omitempty" yaml:"title,omitempty"`
	Description          string                    `json:"description,omitempty" yaml:"description,omitempty"`
	Badge                string                    `json:"badge,omitempty" yaml:"badge,omitempty"`
	BaseURL              string                    `json:"baseURL" yaml:"baseURL"`
	IframeTitle          string                    `json:"iframeTitle,omitempty" yaml:"iframeTitle,omitempty"`
	Defaults             map[string]string         `json:"defaults,omitempty" yaml:"defaults,omitempty"`
	FixedParameters      map[string]string         `json:"fixedParameters,omitempty" yaml:"fixedParameters,omitempty"`
	QueryFields          []string                  `json:"queryFields,omitempty" yaml:"queryFields,omitempty"`
	ViewportField        string                    `json:"viewportField,omitempty" yaml:"viewportField,omitempty"`
	Widths               map[string]int            `json:"widths,omitempty" yaml:"widths,omitempty"`
	NarrowAt             int                       `json:"narrowAt,omitempty" yaml:"narrowAt,omitempty"`
	NarrowValue          string                    `json:"narrowValue,omitempty" yaml:"narrowValue,omitempty"`
	IterationField       string                    `json:"iterationField,omitempty" yaml:"iterationField,omitempty"`
	ResetLabel           string                    `json:"resetLabel,omitempty" yaml:"resetLabel,omitempty"`
	Controls             []PreviewWorkbenchControl `json:"controls,omitempty" yaml:"controls,omitempty"`
	ChecklistTitle       string                    `json:"checklistTitle,omitempty" yaml:"checklistTitle,omitempty"`
	ChecklistDescription string                    `json:"checklistDescription,omitempty" yaml:"checklistDescription,omitempty"`
	Checklist            []string                  `json:"checklist,omitempty" yaml:"checklist,omitempty"`
	Note                 string                    `json:"note,omitempty" yaml:"note,omitempty"`
}
type PreviewWorkbenchControl struct {
	ID      string                   `json:"id" yaml:"id"`
	Label   string                   `json:"label" yaml:"label"`
	Options []PreviewWorkbenchOption `json:"options" yaml:"options"`
}
type PreviewWorkbenchOption struct {
	Value string `json:"value" yaml:"value"`
	Label string `json:"label" yaml:"label"`
}
