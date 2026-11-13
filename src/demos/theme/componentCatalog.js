// Catalog entries describe the visible shared contract, not package internals.
// A "live" entry must point to an interactive example on the library page.
export const componentFamilies = Object.freeze([
    {id: 'actions', name: 'Actions'},
    {id: 'forms', name: 'Forms'},
    {id: 'status', name: 'Status and feedback'},
    {id: 'navigation', name: 'Navigation'},
    {id: 'overlays', name: 'Overlays'},
    {id: 'data', name: 'Data and charts'},
    {id: 'chat', name: 'Chat and AI'},
    {id: 'patterns', name: 'Page patterns'},
]);

const entry = (name, family, stage, variants, behaviors, href = '') =>
    Object.freeze({name, family, stage, variants: Object.freeze(variants), behaviors: Object.freeze(behaviors), href});

export const componentCatalog = Object.freeze([
    entry('Button', 'actions', 'live', ['Primary', 'Secondary', 'Ghost', 'Link', 'Danger', 'Disabled', 'Loading'], ['Click', 'Keyboard focus', 'Busy feedback'], '#foundation-actions'),
    entry('Icon button', 'actions', 'live', ['Default', 'Compact icon', 'Ghost', 'Legacy minimal'], ['Square target', 'Hover', 'Keyboard focus', 'Touch target'], '#foundation-actions'),
    entry('Segmented choice', 'actions', 'live', ['Selected', 'Unselected', 'Disabled'], ['Single selection', 'Keyboard focus'], '#foundation-form'),
    entry('Dropdown menu', 'actions', 'live', ['Enabled item', 'Disabled item'], ['Open', 'Choose', 'Escape', 'Keyboard focus'], '#ds2-menu'),
    entry('Toolbar', 'actions', 'review', ['Table controls', 'Composer controls'], ['Grouping', 'Responsive overflow'], '#foundation-data'),

    entry('Text field', 'forms', 'live', ['Default', 'Disabled', 'Invalid'], ['Type', 'Focus', 'Validation'], '#foundation-form'),
    entry('Number field', 'forms', 'live', ['Value', 'Stepper'], ['Type', 'Increment', 'Decrement'], '#foundation-form'),
    entry('Select field', 'forms', 'live', ['Selected', 'Disabled'], ['Open', 'Choose', 'Keyboard selection'], '#foundation-form'),
    entry('Date picker', 'forms', 'live', ['Empty', 'Selected date'], ['Open calendar', 'Change month', 'Choose day', 'Keyboard navigation'], '#foundation-form'),
    entry('Text area', 'forms', 'live', ['Default', 'Multiline'], ['Type', 'Resize'], '#foundation-form'),
    entry('Checkbox', 'forms', 'live', ['Checked', 'Unchecked'], ['Toggle', 'Keyboard focus'], '#foundation-form'),
    entry('Switch', 'forms', 'live', ['On', 'Off'], ['Toggle', 'Space key'], '#foundation-form'),
    entry('Radio choice', 'forms', 'live', ['Daily', 'Weekly'], ['Single selection', 'Keyboard focus'], '#foundation-form'),
    entry('Search field', 'forms', 'live', ['Empty', 'Query'], ['Filter rows', 'Clear'], '#foundation-data'),
    entry('Date range', 'forms', 'review', ['Start', 'End', 'Preset'], ['Choose range', 'Validate order']),
    entry('Lookup', 'forms', 'review', ['Single', 'Multiple'], ['Search', 'Select', 'Clear']),
    entry('File input', 'forms', 'review', ['Idle', 'Uploading', 'Failed', 'Ready'], ['Choose', 'Drop', 'Retry', 'Remove'], '#foundation-overlays'),

    entry('Status chip', 'status', 'live', ['Neutral', 'Info', 'Success', 'Warning', 'Danger'], ['Written status', 'Mode contrast'], '#foundation-feedback'),
    entry('Filter chip', 'status', 'live', ['Active', 'Inactive', 'Disabled', 'Count'], ['Toggle', 'Keyboard focus'], '#ds2-filter-chips'),
    entry('Callout', 'status', 'live', ['Info', 'Success', 'Warning', 'Danger'], ['Read guidance'], '#foundation-feedback'),
    entry('Progress', 'status', 'review', ['Inline meter', 'Legacy full bar', 'Full-width proposal'], ['Announce value', 'Update'], '#ds2-loading'),
    entry('Skeleton', 'status', 'review', ['Loading placeholder', 'Visibility proposal'], ['Loading announcement', 'Reduced motion'], '#ds2-loading'),
    entry('Empty state', 'status', 'live', ['Empty table', 'Error', 'Loading'], ['Recovery action', 'State announcement'], '#foundation-data'),
    entry('Count badge', 'status', 'planned', ['Single digit', 'Overflow'], ['Read count'], '#ds2-filter-chips'),

    entry('Section tabs', 'navigation', 'live', ['Selected', 'Hover', 'Overflow'], ['Choose tab', 'Arrow keys', 'Scroll'], '#foundation-actions'),
    entry('Pagination', 'navigation', 'review', ['Previous', 'Next', 'Page size'], ['Navigate pages', 'Announce page'], '#foundation-data'),
    entry('Breadcrumbs', 'navigation', 'planned', ['Current page', 'Ancestor'], ['Navigate up']),
    entry('Side navigation', 'navigation', 'planned', ['Expanded', 'Collapsed', 'Mobile'], ['Navigate', 'Keyboard focus']),

    entry('Popover', 'overlays', 'live', ['Raised surface', 'Anchored'], ['Open', 'Dismiss', 'Return focus'], '#foundation-overlays'),
    entry('Dialog', 'overlays', 'live', ['Modal', 'Attachment'], ['Open', 'Escape', 'Focus return'], '#foundation-overlays'),
    entry('Tooltip', 'overlays', 'review', ['Text hint'], ['Hover', 'Keyboard focus']),
    entry('Drawer', 'overlays', 'planned', ['Desktop', 'Mobile'], ['Open', 'Dismiss', 'Focus return']),

    entry('Data table', 'data', 'live', ['Populated', 'Empty', 'Loading', 'Error'], ['Sort', 'Filter', 'Select row'], '#foundation-data'),
    entry('Editable table', 'data', 'live', ['Read', 'Edit', 'Validation'], ['Edit cell', 'Save', 'Keyboard focus'], '#foundation-data'),
    entry('Table status chip', 'data', 'review', ['Success', 'Warning', 'Danger'], ['Read status', 'Sort row'], '#foundation-data'),
    entry('Charts', 'data', 'live', ['Bar', 'Line', 'Pie', 'Donut', 'Stacked', 'Comparison'], ['Select mark', 'Change state', 'Read data table'], '#foundation-charts'),
    entry('Metrics', 'data', 'review', ['Value', 'Trend', 'Comparison'], ['Inspect detail'], '#foundation-data'),

    entry('Chat message', 'chat', 'live', ['User', 'Assistant'], ['Read thread', 'Copy content'], '#ds2-chat'),
    entry('Chat composer', 'chat', 'live', ['Draft', 'Sending', 'Attachment'], ['Type', 'Send', 'Attach'], '#ds2-chat'),
    entry('Upload feedback', 'chat', 'live', ['Preparing', 'Uploading', 'Failed', 'Ready'], ['Drop file', 'Retry', 'Remove'], '#foundation-overlays'),
    entry('Tool activity', 'chat', 'review', ['Running', 'Completed', 'Failed'], ['Expand detail', 'Read status']),
    entry('Citation', 'chat', 'review', ['Inline source', 'Source list'], ['Open source', 'Keyboard focus']),

    entry('Section pattern', 'patterns', 'live', ['Primary', 'Quiet', 'Collapsible'], ['Expand', 'Collapse'], '#foundation-spacing'),
    entry('Document form', 'patterns', 'live', ['Header', 'Field group', 'Actions'], ['Edit', 'Validate', 'Save'], '#ds2-patterns'),
    entry('Analytical report', 'patterns', 'live', ['Data', 'Chart', 'Narrative'], ['Filter', 'Select', 'Compare'], '#ds2-patterns'),
    entry('Comparison layout', 'patterns', 'live', ['Side by side', 'Narrow'], ['Resize', 'Read both sides'], '#ds2-patterns'),
    entry('Workspace shell', 'patterns', 'planned', ['Wide', 'Narrow', 'Phone'], ['Navigate', 'Open panel', 'Restore focus']),
]);
