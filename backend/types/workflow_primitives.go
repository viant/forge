package types

// MutationCommand describes the generic mutation lifecycle shared by workflow
// primitives. Business validation and persistence remain owned by the target
// datasource; Forge owns pending/success/error state and reconciliation.
type MutationCommand struct {
	CommandID           string                      `json:"commandId,omitempty" yaml:"commandId,omitempty"`
	Label               string                      `json:"label,omitempty" yaml:"label,omitempty"`
	Icon                string                      `json:"icon,omitempty" yaml:"icon,omitempty"`
	HideLabel           bool                        `json:"hideLabel,omitempty" yaml:"hideLabel,omitempty"`
	Intent              string                      `json:"intent,omitempty" yaml:"intent,omitempty"`
	Confirm             string                      `json:"confirm,omitempty" yaml:"confirm,omitempty"`
	InvalidMessage      string                      `json:"invalidMessage,omitempty" yaml:"invalidMessage,omitempty"`
	TimeoutMs           int                         `json:"timeoutMs,omitempty" yaml:"timeoutMs,omitempty"`
	InvocationParameter string                      `json:"invocationParameter,omitempty" yaml:"invocationParameter,omitempty"`
	DataSourceRef       string                      `json:"dataSourceRef" yaml:"dataSourceRef"`
	Parameters          []*Parameter                `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Payload             *ResourcePayloadPreparation `json:"payload,omitempty" yaml:"payload,omitempty"`
	ValidateWhen        map[string]interface{}      `json:"validateWhen,omitempty" yaml:"validateWhen,omitempty"`
	PendingState        map[string]interface{}      `json:"pendingState,omitempty" yaml:"pendingState,omitempty"`
	SuccessState        map[string]interface{}      `json:"successState,omitempty" yaml:"successState,omitempty"`
	ErrorState          map[string]interface{}      `json:"errorState,omitempty" yaml:"errorState,omitempty"`
	IndeterminateState  map[string]interface{}      `json:"indeterminateState,omitempty" yaml:"indeterminateState,omitempty"`
	Reconcile           *ReconcileSpec              `json:"reconcile,omitempty" yaml:"reconcile,omitempty"`
	Refresh             []RefreshSpec               `json:"refresh,omitempty" yaml:"refresh,omitempty"`
}

type ReconcileSpec struct {
	Mode           string   `json:"mode,omitempty" yaml:"mode,omitempty"` // replace|merge|remove|refetch
	DataSourceRef  string   `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	IdentityField  string   `json:"identityField,omitempty" yaml:"identityField,omitempty"`
	IdentityFields []string `json:"identityFields,omitempty" yaml:"identityFields,omitempty"`
	ResultPath     string   `json:"resultPath,omitempty" yaml:"resultPath,omitempty"`
	RowsPath       string   `json:"rowsPath,omitempty" yaml:"rowsPath,omitempty"`
}

type RefreshSpec struct {
	DataSourceRef  string `json:"dataSourceRef" yaml:"dataSourceRef"`
	BypassCache    bool   `json:"bypassCache,omitempty" yaml:"bypassCache,omitempty"`
	ClearSelection bool   `json:"clearSelection,omitempty" yaml:"clearSelection,omitempty"`
}

type EditableCollection struct {
	DataSourceRef   string                        `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	IdentityFields  []string                      `json:"identityFields,omitempty" yaml:"identityFields,omitempty"`
	Selection       *PrimitiveSelection           `json:"selection,omitempty" yaml:"selection,omitempty"`
	SelectionStatus bool                          `json:"selectionStatus,omitempty" yaml:"selectionStatus,omitempty"`
	SelectionPrompt string                        `json:"selectionPrompt,omitempty" yaml:"selectionPrompt,omitempty"`
	Operations      []EditableCollectionOperation `json:"operations,omitempty" yaml:"operations,omitempty"`
	Mutation        *MutationCommand              `json:"mutation,omitempty" yaml:"mutation,omitempty"`
}

type PrimitiveSelection struct {
	Mode         string                 `json:"mode,omitempty" yaml:"mode,omitempty"`
	Min          int                    `json:"min,omitempty" yaml:"min,omitempty"`
	Max          int                    `json:"max,omitempty" yaml:"max,omitempty"`
	DisabledWhen map[string]interface{} `json:"disabledWhen,omitempty" yaml:"disabledWhen,omitempty"`
	Every        map[string]interface{} `json:"every,omitempty" yaml:"every,omitempty"`
	Any          map[string]interface{} `json:"any,omitempty" yaml:"any,omitempty"`
	None         map[string]interface{} `json:"none,omitempty" yaml:"none,omitempty"`
}

type EditableCollectionOperation struct {
	ID                string                 `json:"id" yaml:"id"`
	Label             string                 `json:"label" yaml:"label"`
	Intent            string                 `json:"intent,omitempty" yaml:"intent,omitempty"`
	DialogID          string                 `json:"dialogId,omitempty" yaml:"dialogId,omitempty"`
	Handler           string                 `json:"handler,omitempty" yaml:"handler,omitempty"`
	RequiresSelection bool                   `json:"requiresSelection,omitempty" yaml:"requiresSelection,omitempty"`
	Selection         *PrimitiveSelection    `json:"selection,omitempty" yaml:"selection,omitempty"`
	VisibleWhen       map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	DisabledWhen      map[string]interface{} `json:"disabledWhen,omitempty" yaml:"disabledWhen,omitempty"`
	Parameters        []*Parameter           `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Mutation          *MutationCommand       `json:"mutation,omitempty" yaml:"mutation,omitempty"`
}

type AssignmentPicker struct {
	AvailableDataSourceRef string           `json:"availableDataSourceRef" yaml:"availableDataSourceRef"`
	AssignedDataSourceRef  string           `json:"assignedDataSourceRef" yaml:"assignedDataSourceRef"`
	IdentityFields         []string         `json:"identityFields,omitempty" yaml:"identityFields,omitempty"`
	LabelField             string           `json:"labelField,omitempty" yaml:"labelField,omitempty"`
	Assign                 *MutationCommand `json:"assign,omitempty" yaml:"assign,omitempty"`
	Unassign               *MutationCommand `json:"unassign,omitempty" yaml:"unassign,omitempty"`
	AllowMultiple          *bool            `json:"allowMultiple,omitempty" yaml:"allowMultiple,omitempty"`
}

type StatusWorkflow struct {
	StateField  string                     `json:"stateField" yaml:"stateField"`
	Transitions []StatusWorkflowTransition `json:"transitions" yaml:"transitions"`
}

type StatusWorkflowTransition struct {
	ID            string                 `json:"id" yaml:"id"`
	From          []interface{}          `json:"from,omitempty" yaml:"from,omitempty"`
	To            interface{}            `json:"to" yaml:"to"`
	Label         string                 `json:"label" yaml:"label"`
	Confirm       string                 `json:"confirm,omitempty" yaml:"confirm,omitempty"`
	AvailableWhen map[string]interface{} `json:"availableWhen,omitempty" yaml:"availableWhen,omitempty"`
	Command       *MutationCommand       `json:"command" yaml:"command"`
}

type TreeEditorSpec struct {
	DataSourceRef        string           `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	ChildrenField        string           `json:"childrenField,omitempty" yaml:"childrenField,omitempty"`
	IdentityField        string           `json:"identityField,omitempty" yaml:"identityField,omitempty"`
	LabelField           string           `json:"labelField,omitempty" yaml:"labelField,omitempty"`
	SelectionMode        string           `json:"selectionMode,omitempty" yaml:"selectionMode,omitempty"`
	SelectedField        string           `json:"selectedField,omitempty" yaml:"selectedField,omitempty"`
	ExcludedField        string           `json:"excludedField,omitempty" yaml:"excludedField,omitempty"`
	Searchable           *bool            `json:"searchable,omitempty" yaml:"searchable,omitempty"`
	Collapsible          *bool            `json:"collapsible,omitempty" yaml:"collapsible,omitempty"`
	DefaultExpandedDepth int              `json:"defaultExpandedDepth,omitempty" yaml:"defaultExpandedDepth,omitempty"`
	Cascade              string           `json:"cascade,omitempty" yaml:"cascade,omitempty"`
	EmptyMessage         string           `json:"emptyMessage,omitempty" yaml:"emptyMessage,omitempty"`
	Mutation             *MutationCommand `json:"mutation,omitempty" yaml:"mutation,omitempty"`
}

type WizardSpec struct {
	StateKey string           `json:"stateKey,omitempty" yaml:"stateKey,omitempty"`
	Steps    []WizardStep     `json:"steps" yaml:"steps"`
	Submit   *MutationCommand `json:"submit,omitempty" yaml:"submit,omitempty"`
}

type WizardStep struct {
	ID          string                 `json:"id" yaml:"id"`
	Label       string                 `json:"label" yaml:"label"`
	ContainerID string                 `json:"containerId,omitempty" yaml:"containerId,omitempty"`
	VisibleWhen map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	ValidWhen   map[string]interface{} `json:"validWhen,omitempty" yaml:"validWhen,omitempty"`
}

type UploadCollectionSpec struct {
	Accept        []string         `json:"accept,omitempty" yaml:"accept,omitempty"`
	Multiple      *bool            `json:"multiple,omitempty" yaml:"multiple,omitempty"`
	MaxFiles      int              `json:"maxFiles,omitempty" yaml:"maxFiles,omitempty"`
	MaxBytes      int64            `json:"maxBytes,omitempty" yaml:"maxBytes,omitempty"`
	Transport     string           `json:"transport,omitempty" yaml:"transport,omitempty"` // mcpBlob
	BlobField     string           `json:"blobField,omitempty" yaml:"blobField,omitempty"`
	MetadataField string           `json:"metadataField,omitempty" yaml:"metadataField,omitempty"`
	EmptyMessage  string           `json:"emptyMessage,omitempty" yaml:"emptyMessage,omitempty"`
	Upload        *MutationCommand `json:"upload" yaml:"upload"`
}

type DerivedDataSourceSpec struct {
	Version         string            `json:"version,omitempty" yaml:"version,omitempty"`
	MaxRows         int               `json:"maxRows,omitempty" yaml:"maxRows,omitempty"`
	Sources         []string          `json:"sources" yaml:"sources"`
	OptionalSources []string          `json:"optionalSources,omitempty" yaml:"optionalSources,omitempty"`
	Pipeline        []DerivedDataStep `json:"pipeline" yaml:"pipeline"`
}

type DerivedDataStep struct {
	Operation       string                 `json:"operation" yaml:"operation"` // select|map|filter|sort|group|union|join
	Source          string                 `json:"source,omitempty" yaml:"source,omitempty"`
	On              []string               `json:"on,omitempty" yaml:"on,omitempty"`
	Fields          map[string]interface{} `json:"fields,omitempty" yaml:"fields,omitempty"` // legacy shorthand
	Projections     []DerivedProjection    `json:"projections,omitempty" yaml:"projections,omitempty"`
	GroupBy         []string               `json:"groupBy,omitempty" yaml:"groupBy,omitempty"`
	Measures        []DerivedMeasure       `json:"measures,omitempty" yaml:"measures,omitempty"`
	JoinType        string                 `json:"joinType,omitempty" yaml:"joinType,omitempty"`
	JoinCardinality string                 `json:"joinCardinality,omitempty" yaml:"joinCardinality,omitempty"`
	When            map[string]interface{} `json:"when,omitempty" yaml:"when,omitempty"`
	OrderBy         []TableSort            `json:"orderBy,omitempty" yaml:"orderBy,omitempty"`
}

type DerivedProjection struct {
	Target string      `json:"target" yaml:"target"`
	Source string      `json:"source,omitempty" yaml:"source,omitempty"`
	Value  interface{} `json:"value,omitempty" yaml:"value,omitempty"`
}

type DerivedMeasure struct {
	Target    string `json:"target" yaml:"target"`
	Source    string `json:"source,omitempty" yaml:"source,omitempty"`
	Operation string `json:"operation" yaml:"operation"` // count|sum|min|max|first|list
}

type PermissionBoundarySpec struct {
	Mode          string                 `json:"mode,omitempty" yaml:"mode,omitempty"` // resource|row|selection
	DataSourceRef string                 `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	IdentityField string                 `json:"identityField,omitempty" yaml:"identityField,omitempty"`
	Capability    string                 `json:"capability,omitempty" yaml:"capability,omitempty"`
	VisibleWhen   map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
	DeniedMessage string                 `json:"deniedMessage,omitempty" yaml:"deniedMessage,omitempty"`
}

type ResponsiveDataGridSpec struct {
	IdentityColumns []string                           `json:"identityColumns,omitempty" yaml:"identityColumns,omitempty"`
	Breakpoints     map[string]ResponsiveDataGridState `json:"breakpoints,omitempty" yaml:"breakpoints,omitempty"`
}

type ResponsiveDataGridState struct {
	Columns       []string `json:"columns,omitempty" yaml:"columns,omitempty"`
	StickyColumns []string `json:"stickyColumns,omitempty" yaml:"stickyColumns,omitempty"`
	Density       string   `json:"density,omitempty" yaml:"density,omitempty"`
	RowLayout     string   `json:"rowLayout,omitempty" yaml:"rowLayout,omitempty"`
	ReadOnlyCards bool     `json:"readOnlyCards,omitempty" yaml:"readOnlyCards,omitempty"`
}

type HistoryDiffSpec struct {
	DataSourceRef    string            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	IdentityField    string            `json:"identityField,omitempty" yaml:"identityField,omitempty"`
	BeforeField      string            `json:"beforeField,omitempty" yaml:"beforeField,omitempty"`
	AfterField       string            `json:"afterField,omitempty" yaml:"afterField,omitempty"`
	IgnoreFields     []string          `json:"ignoreFields,omitempty" yaml:"ignoreFields,omitempty"`
	FieldLabels      map[string]string `json:"fieldLabels,omitempty" yaml:"fieldLabels,omitempty"`
	RedactFields     []string          `json:"redactFields,omitempty" yaml:"redactFields,omitempty"`
	ArrayStrategy    string            `json:"arrayStrategy,omitempty" yaml:"arrayStrategy,omitempty"` // ordered|set
	RecordLabelField string            `json:"recordLabelField,omitempty" yaml:"recordLabelField,omitempty"`
}

type ScheduleEditorSpec struct {
	DataSourceRef       string           `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	StartField          string           `json:"startField,omitempty" yaml:"startField,omitempty"`
	EndField            string           `json:"endField,omitempty" yaml:"endField,omitempty"`
	TimeZoneField       string           `json:"timeZoneField,omitempty" yaml:"timeZoneField,omitempty"`
	AllowOverlap        *bool            `json:"allowOverlap,omitempty" yaml:"allowOverlap,omitempty"`
	MinDuration         string           `json:"minDuration,omitempty" yaml:"minDuration,omitempty"`
	AllowAdd            *bool            `json:"allowAdd,omitempty" yaml:"allowAdd,omitempty"`
	AllowRemove         *bool            `json:"allowRemove,omitempty" yaml:"allowRemove,omitempty"`
	AmbiguousTimePolicy string           `json:"ambiguousTimePolicy,omitempty" yaml:"ambiguousTimePolicy,omitempty"`
	Mutation            *MutationCommand `json:"mutation,omitempty" yaml:"mutation,omitempty"`
}
