import {resolvePieSliceLabel} from './pieSliceLabel.js';
import {resolveDonutCenter} from './donutCenter.js';
import {DonutCenterLabel,DonutCenterDetails,EmptyDonutCenter} from './DonutCenter.jsx';
import {buildChartTooltipEntries,chartTooltipEntryId,chartTooltipPieFields} from './chartTooltip.js';
import {ChartHoverTooltip,ChartTooltipInspector} from './ChartTooltip.jsx';
import CategoryRange from './CategoryRange.jsx';
import CategoricalHeatmap from './CategoricalHeatmap.jsx';
import {applyChartMetricSelection} from "./chartMetricSelection.js";
import {resolveCategoryColor,resolveChartCategoryColor} from './chartTheme.js';
import {normalizeChartExtent, resolveChartMargins} from './chartExtent.js';
import React, {useState, useEffect, useMemo} from "react";
import {useSignals} from '@preact/signals-react/runtime';
import {
    Dialog,
    HTMLSelect,
    RadioGroup,
    Radio,
    Tooltip as BpTooltip,
} from "@blueprintjs/core";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    ComposedChart,
    Curve,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
    Label,
    ReferenceArea,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
} from "recharts";
import { useDataSourceState } from "../hooks/useDataSourceState.js";
import {
    aggregateDirectSeriesData,
    orderHorizontalChartRows,
    resolveChartBarCornerRadii,
    applyChartRowLimit,
    buildPieSliceCellKey,
    buildPieChartData,
    chartCategoryRowOptions,
    fillMissingTemporalBuckets,
    formatChartNumber,
    formatChartDisplayValue,
    isChartNumericValue,
    formatChartXAxisValue,
    hasNonZeroChartSeriesValue,
    materializeChartDisplayRows,
    normalizeChartKey,
    readChartDataValue,
    resolveChartBodyState,
    resolveChartAnimationActive,
    resolveChartLoadingState,
    resolveHorizontalBarDataLabelLayout,
    resolveHorizontalBarLayout,
    resolveResponsiveCivilDateAxis,
    resolveResponsiveChartType,
    resolveChartValueAxisDomain,
    resolveVisibleChartState,
    transformData,
    resolveChartTableMinWidth,
} from "./chartData.js";
import {
    normalizeSelectorLookupKey,
    resolveChartDataSourceRef,
} from "./chartContextRef.js";
import {
    createKeyListSignature,
    normalizeKeys,
    reconcileSelectedDataKeys,
    reconcileVisibleColumns,
    resolveSelectedValueKey,
    toggleSelectedDataKey,
} from "./chartSeriesSelection.js";
import {
    collectChartLegendSelectionRows,
    normalizeChartDatumSelection,
    normalizeChartLegendSelection,
    normalizeChartSeriesDatumSelection,
} from "./chartSelectionModel.js";
import { SoftBlock } from "./SoftSkeleton.jsx";
import { resolveSelector } from "../utils/selector.js";
import { getLogger } from "../utils/logger.js";
import { normalizeServiceErrorText } from "../utils/errorText.js";
import { isDatasetScopedDenial } from "./dataSourceAuthorization.js";
import { normalizeChartAnnotations, resolveChartAnnotationStrokeDasharray } from "../reporting/reportChartAnnotations.js";
import { buildChartCategoryTickLabel, buildMeasuredChartCategoryTickLabel, normalizeChartCategoryLabelConfig } from "./chartCategoryLabel.js";
import {
    chartSeriesColor,
    resolveChartTypography,
    resolveThemeAwareChartColor,
    resolveThemeAwareChartPalette,
} from "./chartTheme.js";
import "./Chart.css";
import ComparisonBars from './ComparisonBars.jsx';
import ChartPoint from './ChartPoint.jsx';
import Typography, {typographyProps} from './Typography.jsx';
import SelectControl from './SelectControl.jsx';
import SharedButton from './Button.jsx';
import {validateChartAppearance, resolveDocumentChartStyle, sharedChartDomain} from './chartAppearance.js';

let categoryTickMeasureCanvas = null;

function visiblePiePercentage({value, percent}) {
    return Number(value) > 0 && Number.isFinite(percent) && Math.round(percent * 100) > 0;
}

function PiePercentageLeader(props) {
    return visiblePiePercentage(props)
        ? <Curve {...props} type="linear" className="recharts-pie-label-line" />
        : null;
}

function measureCategoryTickText(value, style = {}) {
    if (typeof document === "undefined") return String(value || "").length * 6.5;
    categoryTickMeasureCanvas ||= document.createElement("canvas");
    const context = categoryTickMeasureCanvas.getContext("2d");
    if (!context) return String(value || "").length * 6.5;
    const fontSize = Math.max(8, Number(style?.fontSize || 12));
    const fontWeight = style?.fontWeight || 400;
    context.font = `${style.fontStyle?style.fontStyle+" ":""}${fontWeight} ${fontSize}px ${style?.fontFamily || "system-ui, sans-serif"}`;
    const text = String(value || "");
    const spacing = Number.parseFloat(style.letterSpacing) || 0;
    const pixels = String(style.letterSpacing).endsWith('em') ? spacing * fontSize : spacing;
    return context.measureText(text).width + Math.max(0, [...text].length - 1) * pixels;
}

function ClampedCategoryTick({ x = 0, y = 0, payload = {}, config = null, valueFormatter = null, orientation = "x", style = {}, availableWidth = 0 }) {
    const rawValue = payload?.value;
    const formattedValue = typeof valueFormatter === "function" ? valueFormatter(rawValue) : rawValue;
    const isYAxis = orientation === "y";
    const label = isYAxis
        ? buildMeasuredChartCategoryTickLabel(formattedValue, config, availableWidth, (text) => measureCategoryTickText(text, style))
        : buildChartCategoryTickLabel(formattedValue, config);
    if (!label) return null;
    const lineHeight = Number.parseFloat(style?.lineHeight) || Math.max(11, Number(style?.fontSize || 12) + 2);
    return (
        <g transform={`translate(${x},${y})`}>
            <title>{label.fullText}</title>
            <text
                x={isYAxis ? -6 : 0}
                y={isYAxis ? -((label.lines.length - 1) * lineHeight) / 2 : 8}
                textAnchor={isYAxis ? "end" : "middle"}
                dominantBaseline={isYAxis ? "middle" : "hanging"}
                {...style}
            >
                {label.lines.map((line, index) => (
                    <tspan key={`${line}-${index}`} x={isYAxis ? -6 : 0} dy={index === 0 ? 0 : lineHeight}>
                        {line}
                    </tspan>
                ))}
            </text>
        </g>
    );
}

export function HorizontalBarValueLabel({ x = 0, y = 0, width = 0, height = 0, value, formatter = null }) {
    if (!isChartNumericValue(value)) return null;
    const layout = resolveHorizontalBarDataLabelLayout({ x, width, value });
    const label = typeof formatter === "function" ? formatter(value) : value;
    return (
        <text
            x={layout.x}
            y={(Number(y) || 0) + (Number(height) || 0) / 2}
            textAnchor={layout.textAnchor}
            dominantBaseline="middle"
            fill={layout.fill}
            fontSize={11}
            fontWeight={600}
        >
            {label}
        </text>
    );
}

function ChartActionButton({
    children,
    onClick,
    active,
    disabled = false,
    title = '',
    style = {},
    documentAppearance = false,
}) {
    if (documentAppearance) return <SharedButton variant={active ? 'secondary' : 'ghost'} aria-pressed={typeof active==='boolean'?active:undefined} disabled={disabled} title={title || undefined} onClick={onClick} style={style}>{children}</SharedButton>;
    return (
        <button
            type="button"
            className="forge-chart-action"
            disabled={disabled}
            title={title || undefined}
            onClick={onClick}
            style={{
                minHeight: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: `1px solid ${active ? 'var(--forge-chart-action, #2f6de1)' : 'var(--forge-chart-border, #d0daea)'}`,
                background: active ? 'var(--forge-chart-action, #2f6de1)' : 'var(--forge-chart-surface-subtle, #f5f8fd)',
                color: active ? 'var(--forge-text-inverse, #fff)' : 'var(--forge-chart-action, #2d5a9e)',
                cursor: disabled ? 'default' : 'pointer',
                font: 'inherit',
                fontSize: 'var(--forge-type-small-size, 12px)',
                fontWeight: 600,
                lineHeight: 1.2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                ...style,
            }}
        >
            {children}
        </button>
    );
}

function useMeasuredContainer() {
    const ref = React.useRef(null);
    const [size, setSize] = useState({width: 0, height: 0, availableWidth: 0});

    useEffect(() => {
        const node = ref.current;
        if (!node || typeof ResizeObserver === "undefined") return undefined;
        // The viewport's parent is the percentage-sized chart root. Its
        // containing block provides a stable basis for responsive breakpoints.
        const containingBlock = node.parentElement?.parentElement;
        const update = () => {
            const nextWidth = Number(node.clientWidth || 0);
            const nextHeight = Number(node.clientHeight || 0);
            const style = containingBlock ? window.getComputedStyle(containingBlock) : null;
            const horizontalPadding = (Number.parseFloat(style?.paddingLeft) || 0) + (Number.parseFloat(style?.paddingRight) || 0);
            const availableWidth = Math.max(0, Number(containingBlock?.clientWidth || 0) - horizontalPadding) || nextWidth;
            setSize((prev) => (
                prev.width === nextWidth && prev.height === nextHeight && prev.availableWidth === availableWidth
                    ? prev
                    : {width: nextWidth, height: nextHeight, availableWidth}
            ));
        };
        update();
        const observer = new ResizeObserver(() => update());
        observer.observe(node);
        if (containingBlock) observer.observe(containingBlock);
        return () => observer.disconnect();
    }, []);

    return [ref, size];
}

function isDirectSeriesChart(chart = {}) {
    return !chart?.series?.nameKey && Array.isArray(chart?.series?.values) && chart.series.values.length > 0;
}

function isHorizontalBarType(type = "") {
    return type === "horizontal_bar" || type === "funnel_bar";
}

function defaultCategoricalPalette() {
    return resolveThemeAwareChartPalette([
        '#2f6de1', '#7a46d8', '#db2f7d', '#f55d1f', '#d79619',
        '#2aa84a', '#24a0c7', '#5a5ce6', '#d13b5c', '#8a6b0f',
        '#0f8f6b', '#4d7cff', '#9b51e0', '#ff5c8a', '#ff7a1a',
        '#c89b14', '#27ae60', '#1f9ac0', '#6c63ff', '#e74c3c',
        '#b9770e', '#16a085', '#3498db', '#8e44ad', '#e91e63',
        '#ff7043', '#f4b400', '#43a047', '#00acc1', '#3f51b5',
        '#ef5350', '#ffa726', '#9ccc65', '#26c6da', '#7e57c2',
        '#ec407a', '#ffca28', '#66bb6a', '#29b6f6', '#5c6bc0',
        '#ab47bc', '#ff704d', '#d4e157', '#26a69a', '#42a5f5',
        '#7e57c2', '#f06292', '#ffb300', '#4db6ac', '#7986cb'
    ], {forceRole: true});
}

function getSeriesDefinitions(chart = {}) {
    const palette = resolveThemeAwareChartPalette(chart?.series?.palette || [], {forceRole:chart.appearance === 'document',declared:chart.paletteMode==='declared'});
    return (chart?.series?.values || []).map((entry, index) => ({
        ...entry,
        value: entry?.value,
        label: entry?.label || entry?.name || entry?.value || `Series ${index + 1}`,
        name: entry?.name || entry?.label || entry?.value || `Series ${index + 1}`,
        type: entry?.type || chart?.type || "line",
        axis: entry?.axis || "left",
        color: resolveThemeAwareChartColor(entry?.color, index, {forceRole:chart.appearance === 'document',declared:chart.paletteMode==='declared'})
            || palette[index % Math.max(palette.length, 1)]
            || chartSeriesColor(index + 1, "#137cbd"),
        dataLabels: entry?.dataLabels,
    })).filter((entry) => !!entry.value);
}

const formatValueByFormat = formatChartDisplayValue;

export function chartTableColumnMeta(columnKey, xAxis = {}, seriesDefinitions = []) {
    if (columnKey === xAxis?.dataKey) {
        return {key: columnKey, label: xAxis?.label || 'Date', format: 'xAxis'};
    }
    const series = seriesDefinitions.find((entry) => entry?.value === columnKey) || {};
    return {key: columnKey, label: series.label || series.name || columnKey, format: series.format || ''};
}

export function formatChartTableCell(value, meta = {}, resolvedTickFormat = '', resolvedTickValueMode = '') {
    if (meta.format === 'xAxis') return formatChartXAxisValue(value, resolvedTickFormat, resolvedTickValueMode);
    return formatValueByFormat(value, meta.format);
}

function shouldRenderSeriesDataLabels(series = {}, chartType = "", rowCount = 0, embedded = false) {
    if (embedded) {
        return false;
    }
    const mode = String(series?.dataLabels || "").trim().toLowerCase();
    if (mode === "none") {
        return false;
    }
    if (mode === "always") {
        return true;
    }
    if (mode && mode !== "auto") {
        return false;
    }
    if (chartType === "horizontal_bar" || chartType === "funnel_bar") {
        return rowCount <= 12;
    }
    if (chartType === "bar") {
        return rowCount <= 10;
    }
    if (!mode) {
        return false;
    }
    if (chartType === "line" || chartType === "area") {
        return rowCount <= 8;
    }
    return false;
}

function buildDataLabelFormatter(formatType = "") {
    return (value) => formatValueByFormat(value, formatType);
}

export function resolveConditionalSeriesColor(series = {}, value, fallbackColor = "") {
    const mode = String(series?.pointColorMode || "").trim();
    if (mode !== "bySign") {
        return fallbackColor || series?.color || chartSeriesColor(1, "#137cbd");
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallbackColor || series?.color || chartSeriesColor(1, "#137cbd");
    }
    if (numericValue > 0) {
        return "var(--forge-chart-positive, #0f9960)";
    }
    if (numericValue < 0) {
        return "var(--forge-chart-negative, #db3737)";
    }
    return "var(--forge-chart-neutral, #98a2b3)";
}

function createAxisTickFormatter(formatType, compact = false) {
    return (value) => compact && ['currency','currency2'].includes(formatType)
        ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value)
        : formatValueByFormat(value, formatType);
}

function tooltipFormatterForFormat(formatType) {
    return (value) => formatValueByFormat(value, formatType);
}

function formatChartErrorMessage(error) {
    if (!error || isDatasetScopedDenial(error)) return "";
    return normalizeServiceErrorText(error, { serviceLabel: "chart data service" }) || "Chart data failed to load.";
}

function resolveMappedConfigValue(baseContext, entry = {}, valueKey = "", defaultSource = "windowForm") {
    const selector = String(entry?.[`${valueKey}Selector`] || "").trim();
    const mapping = entry?.[`${valueKey}s`];
    if (!selector || !mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
        return entry?.[valueKey];
    }
    let scope = {};
    const source = String(entry?.[`${valueKey}Source`] || defaultSource).toLowerCase();
    switch (source) {
        case "form":
            scope = baseContext?.signals?.form?.peek?.() || {};
            break;
        case "filter":
        case "filters":
            scope = baseContext?.handlers?.dataSource?.peekFilter?.() || {};
            break;
        case "input":
            scope = baseContext?.signals?.input?.peek?.() || {};
            break;
        case "windowform":
        default:
            scope = baseContext?.signals?.windowForm?.peek?.() || {};
            break;
    }
    const key = normalizeSelectorLookupKey(resolveSelector(scope, selector));
    if (key == null) {
        return entry?.[valueKey];
    }
    return mapping[key] ?? entry?.[valueKey];
}

function buildAnnotationLabel(label = "", color = "", embedded = false, position = "end") {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
        return undefined;
    }
    return {
        value: normalizedLabel,
        position,
        fill: color || "var(--forge-chart-text, #41566d)",
        fontSize: embedded ? "var(--forge-type-caption-size, 10px)" : "var(--forge-type-caption-size, 11px)",
        fontWeight: 600,
    };
}

function buildRuntimeChartAnnotationElements(annotations = [], { embedded = false } = {}) {
    const background = [];
    const foreground = [];

    annotations.forEach((annotation, index) => {
        const color = resolveThemeAwareChartColor(annotation?.color, index)
            || "var(--forge-chart-text-muted, #5f6b7c)";
        const dash = resolveChartAnnotationStrokeDasharray(annotation?.lineStyle);
        const key = annotation?.id || `${annotation?.kind || "annotation"}-${index}`;

        if (annotation?.kind === "band") {
            const commonProps = {
                key,
                ifOverflow: "extendDomain",
                fill: color,
                fillOpacity: annotation?.opacity ?? 0.12,
                stroke: color,
                strokeOpacity: 0.25,
                label: buildAnnotationLabel(annotation?.label, color, embedded, "insideTop"),
            };
            background.push(
                annotation?.axis === "y"
                    ? <ReferenceArea {...commonProps} y1={annotation.from} y2={annotation.to} />
                    : <ReferenceArea {...commonProps} x1={annotation.from} x2={annotation.to} />,
            );
            return;
        }

        if (annotation?.kind === "note") {
            foreground.push(
                <ReferenceDot
                    key={key}
                    ifOverflow="extendDomain"
                    x={annotation.x}
                    y={annotation.y}
                    r={embedded ? 4 : 5}
                    fill={color}
                    stroke={color}
                    strokeWidth={2}
                    label={buildAnnotationLabel(annotation?.label, color, embedded, "top")}
                />,
            );
            return;
        }

        const label = buildAnnotationLabel(annotation?.label, color, embedded, annotation?.position || "end");
        const commonLineProps = {
            key,
            ifOverflow: "extendDomain",
            stroke: color,
            strokeWidth: embedded ? 1.5 : 2,
            strokeDasharray: dash || undefined,
            position: annotation?.position || "end",
            label,
        };
        if (annotation?.kind === "verticalMarker" || (annotation?.kind === "referenceLine" && annotation?.axis === "x")) {
            foreground.push(<ReferenceLine {...commonLineProps} x={annotation?.value} />);
            return;
        }
        if (annotation?.kind === "referenceLine" && annotation?.axis === "y") {
            foreground.push(<ReferenceLine {...commonLineProps} y={annotation?.value} />);
        }
    });

    return {
        background,
        foreground,
    };
}

// Function to format large numbers with commas
function formatLargeNumber(value) {
    return formatChartNumber(value);
}

function escapeCsvCell(value) {
    const v = String(value ?? "");
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

function areKeyListsEqual(left = [], right = []) {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return false;
    }
    return true;
}


export function hasNonEmptySummary(metrics = {}) {
    if (!metrics || typeof metrics !== 'object') {
        return false;
    }
    return Object.entries(metrics).some(([key, value]) => {
        if (!/summary/i.test(String(key || ''))) {
            return false;
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        return Object.values(value).some((item) => {
            if (item == null) return false;
            if (typeof item === 'string') return item.trim().length > 0;
            return true;
        });
    });
}

export function resolveEmptyChartMessage(metrics = {}) {
    if (hasNonEmptySummary(metrics)) {
        return 'No detailed chart rows were returned for the selected period. Summary totals may still be available below.';
    }
    return 'No data for the selected period.';
}

const Chart = ({container, context, isActive = true, embedded = false, onDatumSelect = null, onLegendItemSelect = null, showControls = true, allowTableSwitch = undefined, onMetricSelectionChange = null, tooltipEntriesOverride = null, showTooltipInspector = true, onTooltipInspect = null}) => {
    const viewSwitchEnabled = typeof allowTableSwitch === "boolean" ? allowTableSwitch : (typeof container?.chart?.allowTableSwitch === "boolean" ? container.chart.allowTableSwitch : showControls !== false);
    const controlsVisible = container?.chart?.showControls !== false && showControls !== false;
    useSignals();
    const log = getLogger('chart');
    const authoredChart = container.chart;
    const [metricChoice, setMetricChoice] = useState(null);
    const chart = useMemo(() => applyChartMetricSelection(authoredChart, metricChoice), [authoredChart, metricChoice]);
    validateChartAppearance(chart);
    const documentAppearance = chart.appearance === 'document';
    const smallMultiples = chart.layout === 'small-multiples';
    const [chartRef, chartSize] = useMeasuredContainer();

    // Extract chart configuration
    const {
        type = "line",
        xAxis = {},
        yAxis = {},
        axes = {},
        cartesianGrid = {strokeDasharray: "3 3"},
        width,
        height,
        series = {},
    } = chart;
    const palette = useMemo(() => resolveThemeAwareChartPalette(series?.palette || [], {forceRole:documentAppearance,declared:chart.paletteMode==='declared'}), [series?.palette,documentAppearance,chart.paletteMode]);
    const [chartTypography, setChartTypography] = useState(() => ({...resolveChartTypography(null), documentStyle: resolveDocumentChartStyle(null)}));
    useEffect(() => {
        let frame;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const next = {...resolveChartTypography(chartRef.current), documentStyle: resolveDocumentChartStyle(chartRef.current)};
                setChartTypography(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
            });
        };
        const observer = new MutationObserver(update);
        const stylesheetLoaded = event => { if(event.target?.tagName === 'LINK' && event.target.rel === 'stylesheet') update(); };
        observer.observe(document.documentElement, {attributes: true});
        observer.observe(document.head, {childList: true, subtree: true, characterData: true});
        for (let node = chartRef.current; node && node !== document.documentElement; node = node.parentElement) {
            observer.observe(node, {attributes: true, attributeFilter: ['style', 'class', 'data-forge-theme', 'data-forge-color-mode']});
        }
        document.fonts?.addEventListener('loadingdone', update);
        document.addEventListener('load',stylesheetLoaded,true);
        update();
        return () => { cancelAnimationFrame(frame); observer.disconnect(); document.fonts?.removeEventListener('loadingdone', update); document.removeEventListener('load',stylesheetLoaded,true); };
    }, [documentAppearance]);
    const documentStyle = chartTypography.documentStyle;
    const directSeriesChart = isDirectSeriesChart(chart);
    const seriesDefinitions = useMemo(() => getSeriesDefinitions(chart), [chart]);
    const leftAxis = useMemo(() => ({...yAxis, ...(axes.left || {})}), [yAxis, axes]);
    const rightAxis = useMemo(() => axes.right || null, [axes]);
    const hasRightAxis = !!rightAxis || seriesDefinitions.some((entry) => entry.axis === "right");
    const [selectedDataKeys, setSelectedDataKeys] = useState([]);
    const selectionStateRef = React.useRef({initialized: false, touched: false});
    const lastRenderableStateRef = React.useRef(null);
    const [viewMode, setViewMode] = useState("chart");
    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const [columnWidths, setColumnWidths] = useState({});
    const [expandedCell, setExpandedCell] = useState(null);

    const [selectedValueKey, setSelectedValueKey] = useState(series.valueKey || seriesDefinitions[0]?.value || "");

    const resolvedChartDataSourceRef = resolveChartDataSourceRef(context, chart);
    const chartContext = (typeof context?.useDsContext === "function")
        ? context.useDsContext(resolvedChartDataSourceRef || context?.identity?.dataSourceRef)
        : (
            resolvedChartDataSourceRef
            && resolvedChartDataSourceRef !== context?.identity?.dataSourceRef
            && typeof context?.Context === "function"
                ? context.Context(resolvedChartDataSourceRef)
                : context
        );
    useEffect(() => {
        try {
            log.debug('[chart] resolved datasource', {
                containerId: container?.id,
                baseDs: context?.identity?.dataSourceRef,
                resolvedDs: chartContext?.identity?.dataSourceRef,
                selector: chart?.dataSourceRefSelector || chart?.dataSourceSelector || null,
            });
        } catch (_) {}
    }, [chart?.dataSourceRefSelector, chart?.dataSourceSelector, chartContext, container?.id, context?.identity?.dataSourceRef]);
    const resolvedTickFormat = resolveMappedConfigValue(context, xAxis, "tickFormat", "windowForm");
    const resolvedTickValueMode = resolveMappedConfigValue(context, xAxis, "valueMode", "windowForm");
    const { collection, loading, error } = useDataSourceState(chartContext);
    const chartErrorMessage = formatChartErrorMessage(error);
    const chartMetrics = chartContext?.signals?.metrics?.value || {};
    const collectionOverride = Array.isArray(container?.collection) ? container.collection : null;
    const effectiveCollection = collectionOverride || collection;
    const centerState=useMemo(()=>{try{return {resolved:resolveDonutCenter(chart.center,effectiveCollection||[],type,container.centerRows,container.centerInputs)};}catch(error){return {error:error.message};}},[chart.center,effectiveCollection,type,container.centerRows,container.centerInputs]);
    const [centerNeedsDetails,setCenterNeedsDetails]=useState(false);
    const effectiveLoading = resolveChartLoadingState({
        loading,
        collectionOverride,
    });
    const chartSourceKey = useMemo(() => {
        const dataSourceId = String(chartContext?.identity?.dataSourceId || chartContext?.identity?.dataSourceRef || "");
        const inputSnapshot = chartContext?.signals?.input?.peek?.() || {};
        const params = inputSnapshot.parameters || {};
        const filter = inputSnapshot.filter || {};
        return JSON.stringify({ dataSourceId, params, filter });
    }, [chartContext, chartContext?.signals?.input?.value]);

    const responsiveChartType = resolveResponsiveChartType(type, chartSize.width, {
        xAxis,
        rows: effectiveCollection,
    });
    const responsiveCivilDateAxis = resolveResponsiveCivilDateAxis(
        effectiveCollection,
        xAxis?.dataKey,
        chartSize.width,
    );
    const isPieChart = responsiveChartType === "pie" || responsiveChartType === "donut";
    const isHorizontalBar = isHorizontalBarType(responsiveChartType);
    const prepared = useMemo(() => {
        if(type === "category-range" || type === "heatmap") return {chartData:effectiveCollection || [],availableDataKeys:[],yAxisLabel:""};
        const chartRows = materializeChartDisplayRows(chart, effectiveCollection || []);
        if (isPieChart) {
            const nameKey = chart.tooltip ? chartTooltipPieFields(chart).nameKey : series.nameKey || "name";
            const valueKey = chart.tooltip ? chartTooltipPieFields(chart).valueKey : series.valueKey || selectedValueKey || "value";
            const rows = applyChartRowLimit(buildPieChartData(chartRows, nameKey, valueKey, chartCategoryRowOptions(chart)), chart?.rowLimit);
            return {
                chartData: rows,
                availableDataKeys: rows.map((row) => row.name),
                yAxisLabel: "",
            };
        }

        if (directSeriesChart) {
            const sorted = applyChartRowLimit(aggregateDirectSeriesData(chartRows, xAxis?.dataKey, seriesDefinitions, chart), chart?.rowLimit);
            return {
                chartData: sorted,
                availableDataKeys: seriesDefinitions.map((entry) => entry.value),
                yAxisLabel: leftAxis.label || "",
            };
        }

        const {data, keys} = transformData(chartRows, chart, selectedValueKey);
        const selectedValue = (series.values || []).find((val) => val.value === selectedValueKey);
        return {
            chartData: applyChartRowLimit(data, chart?.rowLimit),
            availableDataKeys: keys,
                yAxisLabel: selectedValue?.name || selectedValue?.label || leftAxis.label || "",
        };
    }, [chart, documentAppearance, directSeriesChart, effectiveCollection, isPieChart, leftAxis.label, selectedValueKey, series, seriesDefinitions, xAxis?.dataKey]);

    const visibleState = resolveVisibleChartState({
        chartData: prepared.chartData,
        availableDataKeys: prepared.availableDataKeys,
        yAxisLabel: prepared.yAxisLabel,
        loading: effectiveLoading,
        error,
        sourceKey: chartSourceKey,
        previousState: lastRenderableStateRef.current,
    });

    const chartData = visibleState.chartData;
    const tooltipResult = useMemo(() => {
        try {return {entries:tooltipEntriesOverride || buildChartTooltipEntries(chart,effectiveCollection || [],container.requestFilters),error:null};}
        catch(error){return {entries:[],error:error.message || 'Chart details could not be built.'};}
    }, [chart,effectiveCollection,tooltipEntriesOverride,container.requestFilters]);
    const tooltipEntries=tooltipResult.entries;
    const [tooltipActiveId,setTooltipActiveId] = useState(null);
    const availableDataKeys = visibleState.availableDataKeys;
    const yAxisLabel = visibleState.yAxisLabel;
    const staleWhileLoading = visibleState.staleWhileLoading;
    const availableDataKeysSignature = useMemo(
        () => createKeyListSignature(availableDataKeys),
        [availableDataKeys],
    );
    const seriesValueKeysSignature = useMemo(
        () => createKeyListSignature(
            Array.isArray(series?.values)
                ? series.values.map((entry) => entry?.value)
                : [],
        ),
        [series?.values],
    );
    const seriesDefinitionKeysSignature = useMemo(
        () => createKeyListSignature(seriesDefinitions.map((entry) => entry?.value)),
        [seriesDefinitions],
    );
    const stableAvailableDataKeys = useMemo(
        () => normalizeKeys(availableDataKeys),
        [availableDataKeysSignature],
    );

    useEffect(() => {
        if (!effectiveLoading && !error && Array.isArray(prepared.chartData) && prepared.chartData.length > 0) {
            lastRenderableStateRef.current = {
                chartData: prepared.chartData,
                availableDataKeys: prepared.availableDataKeys,
                yAxisLabel: prepared.yAxisLabel,
                sourceKey: chartSourceKey,
            };
        }
    }, [prepared.chartData, prepared.availableDataKeys, prepared.yAxisLabel, effectiveLoading, error, chartSourceKey]);

    useEffect(() => {
        setSelectedDataKeys((previousKeys) => {
            const nextSelection = reconcileSelectedDataKeys(previousKeys, stableAvailableDataKeys, selectionStateRef.current);
            selectionStateRef.current = {
                ...selectionStateRef.current,
                initialized: nextSelection.initialized,
            };
            return areKeyListsEqual(previousKeys, nextSelection.selectedDataKeys)
                ? previousKeys
                : nextSelection.selectedDataKeys;
        });
    }, [availableDataKeysSignature, stableAvailableDataKeys]);

    useEffect(() => {
        setSelectedValueKey((previousValueKey) => {
            const nextValueKey = resolveSelectedValueKey(previousValueKey, series, seriesDefinitions);
            return nextValueKey === previousValueKey ? previousValueKey : nextValueKey;
        });
    }, [series?.valueKey, seriesDefinitionKeysSignature, seriesDefinitions, seriesValueKeysSignature, series]);

    useEffect(() => {
        if (((embedded && !documentAppearance) || !viewSwitchEnabled) && viewMode !== "chart") {
            setViewMode("chart");
        }
    }, [embedded, documentAppearance, viewSwitchEnabled, viewMode]);

    // Category charts expose aggregated name/value rows, not one column per legend key.
    const tableXAxis = useMemo(() => isPieChart ? {dataKey: 'name', label: 'Category'} : xAxis, [isPieChart, xAxis]);
    const tableSeriesDefinitions = useMemo(() => {
        if (!isPieChart) return seriesDefinitions;
        const metric = seriesDefinitions.find(entry => entry.value === (series.valueKey || selectedValueKey)) || {};
        return [{...metric, value: 'value', label: metric.label || metric.name || 'Value'}];
    }, [isPieChart, seriesDefinitions, series.valueKey, selectedValueKey]);

    const allTableColumns = useMemo(
        () => type === 'category-range' ? Array.from(new Set([chart.categoryRange?.categoryField,...chartData.flatMap(row=>Object.keys(row))].filter(Boolean))) : type === 'heatmap' ? Array.from(new Set([chart.heatmap?.rowField,chart.heatmap?.columnField,chart.heatmap?.valueField,...chartData.flatMap(row=>Object.keys(row))].filter(Boolean))) : isPieChart ? ['name', 'value'] : [xAxis?.dataKey, ...stableAvailableDataKeys].filter(Boolean),
        [type, chart.categoryRange, chart.heatmap, chartData, isPieChart, xAxis?.dataKey, stableAvailableDataKeys],
    );
    const [visibleColumns, setVisibleColumns] = useState(allTableColumns);

    useEffect(() => {
        setVisibleColumns((prev) => reconcileVisibleColumns(prev, allTableColumns));
    }, [allTableColumns]);




    // Function to handle selection changes for dataKeys
    const handleDataKeySelect = (dataKey) => {
        selectionStateRef.current = {initialized: true, touched: true};
        setSelectedDataKeys((previousKeys) => toggleSelectedDataKey(previousKeys, dataKey));
    };

    const handleClearSelection = () => {
        selectionStateRef.current = {initialized: true, touched: true};
        setSelectedDataKeys([]);
    };

    // Handle valueKey change
    const handleValueKeyChange = (e) => {
        const newValueKey = e.target.value;
        setSelectedValueKey(newValueKey); // Just update the state
    };

    const authoredCategoryLabelConfig = normalizeChartCategoryLabelConfig(xAxis?.categoryLabel);
    const horizontalBarLayout = resolveHorizontalBarLayout({
        containerWidth: chartSize.width,
        availableWidth: chartSize.availableWidth,
        embedded,
        categoryLabel: authoredCategoryLabelConfig,
    });
    const categoryLabelConfig = isHorizontalBar
        ? horizontalBarLayout.categoryLabel
        : authoredCategoryLabelConfig;
    const categoryLabelBottomOffset = categoryLabelConfig?.lines === 2 ? 14 : 0;
    const cartesianAxisTitleBottomMargin = !embedded && String(xAxis?.label || "").trim() ? 64 : 0;
    const defaultChartMargin = isHorizontalBar
        ? horizontalBarLayout.margin
        : (embedded
            ? {top: 24, right: 12, left: 6, bottom: 34 + categoryLabelBottomOffset}
            : {top: 24, right: 60, left: 14, bottom: Math.max(42 + categoryLabelBottomOffset, cartesianAxisTitleBottomMargin, responsiveCivilDateAxis.bottomMargin)});
    const chartMargin = documentAppearance ? {top:documentStyle.insetTop,right:documentStyle.insetRight,bottom:documentStyle.insetBottom,left:0} : resolveChartMargins(chart?.margin, defaultChartMargin);
    const horizontalLegendSeriesCount = directSeriesChart
        ? seriesDefinitions.length
        : availableDataKeys.length;
    const legendProps = embedded
        ? {verticalAlign: "top", align: "center", wrapperStyle: {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, paddingBottom: "6px", color: "var(--forge-chart-text-muted, #5f6b7c)", fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing}}
        : (isHorizontalBar && horizontalLegendSeriesCount > 1
            ? {verticalAlign: "top", align: "center", wrapperStyle: {fontSize: chartTypography.smallSize, lineHeight: `${chartTypography.smallLineHeight}px`, paddingBottom: "8px", color: "var(--forge-chart-text-muted, #5f6b7c)", fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing}}
            : {});
    const axisTickStyle = documentAppearance
        ? {fontSize:chartTypography.smallSize,lineHeight:`${documentStyle.axisLineHeight}px`,fill:'var(--forge-chart-text-muted, #667085)',fontFamily:chartTypography.smallFamily,fontWeight:chartTypography.smallWeight,letterSpacing:chartTypography.smallLetterSpacing}
        : embedded
        ? {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, fill: "var(--forge-chart-text-muted, #5f6b7c)", fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing}
        : {fontSize: chartTypography.smallSize, lineHeight: `${chartTypography.smallLineHeight}px`, fill: "var(--forge-chart-text-muted, #667085)", fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing};
    const axisLabelStyle = embedded
        ? undefined
        : {fontSize: chartTypography.smallSize, lineHeight: `${chartTypography.smallLineHeight}px`, fill: "var(--forge-chart-text-muted, #667085)", fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing};
    const renderXAxisCategoryTick = categoryLabelConfig
        ? ((props) => <ClampedCategoryTick {...props} config={categoryLabelConfig} valueFormatter={(value) => formatChartXAxisValue(value, resolvedTickFormat, resolvedTickValueMode)} style={axisTickStyle} />)
        : axisTickStyle;
    const renderYAxisCategoryTick = categoryLabelConfig
        ? ((props) => <ClampedCategoryTick {...props} config={categoryLabelConfig} orientation="y" style={axisTickStyle} availableWidth={Math.max(0, horizontalBarLayout.categoryWidth - 10)} />)
        : (embedded || documentAppearance ? axisTickStyle : undefined);
    const gridStroke = "var(--forge-chart-grid, rgba(152,162,179,0.22))";
    const showEmbeddedSeriesSelector = !documentAppearance && embedded && !isPieChart && availableDataKeys.length > 1;
    const showChartLegend = !documentAppearance && chart?.showLegend !== false && !showEmbeddedSeriesSelector && (embedded || !controlsVisible);

    const seriesToggleOptions = useMemo(() => availableDataKeys.map((dataKey, index) => {
        const seriesDef = seriesDefinitions.find((entry) => entry.value === dataKey);
        return {
            value: dataKey,
            label: seriesDef?.label || seriesDef?.name || dataKey,
            color: resolveChartCategoryColor(chart, dataKey, seriesDef?.color || palette[index % Math.max(palette.length, 1)] || chartSeriesColor(index + 1, "#137cbd")),
        };
    }), [availableDataKeys, palette, seriesDefinitions, chart]);

    const interactiveDatumSelection = typeof onDatumSelect === "function";
    const interactiveLegendSelection = typeof onLegendItemSelect === "function";

    const selectedSeriesDefinitions = directSeriesChart
        ? seriesDefinitions.filter((entry) => selectedDataKeys.includes(entry.value))
        : selectedDataKeys.map((dataKey, index) => ({
            value: dataKey,
            label: dataKey,
            name: dataKey,
            type,
            stackId: chart.stacked ? "total" : undefined,
            axis: "left",
            color: resolveChartCategoryColor(chart, dataKey, palette[index % Math.max(palette.length, 1)] || chartSeriesColor(index + 1, "#137cbd")),
        }));
    const renderableSeriesDefinitions = selectedSeriesDefinitions.filter((entry) => (
        chartData.some((row) => {
            const value = readChartDataValue(row, entry.value);
            return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
        })
    ));

    const documentValueAxisWidth = (axis, axisId = 'left') => {
        let minimum = 0, maximum = 0;
        for (const row of normalizedChartData) {
            let positiveTotal = 0, negativeTotal = 0;
            for (const series of renderableSeriesDefinitions.filter(entry => (entry.axis || 'left') === axisId)) {
                const value = Number(readChartDataValue(row, series.value));
                if (!Number.isFinite(value)) continue;
                minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
                if (value >= 0) positiveTotal += value; else negativeTotal += value;
            }
            if (chart.stacked) { minimum = Math.min(minimum, negativeTotal); maximum = Math.max(maximum, positiveTotal); }
        }
        for (const value of Array.isArray(axis?.domain) ? axis.domain : []) if (Number.isFinite(value)) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
        const format = createAxisTickFormatter(axis?.format, true);
        const width = Math.max(...[minimum, maximum, minimum * 1.25, maximum * 1.25, 0].map(value => measureCategoryTickText(format(value), axisTickStyle)));
        return Math.max(documentStyle.axisWidth, Math.ceil(width) + documentStyle.axisTickMargin * 2);
    };

    const emitDatumSelection = React.useCallback((event) => {
        if (!interactiveDatumSelection) {
            return;
        }
        const selection = normalizeChartDatumSelection({
            event,
            chart,
            xAxisDataKey: normalizeChartKey(xAxis?.dataKey || "name"),
        });
        if (!selection) {
            return;
        }
        onDatumSelect(selection);
    }, [interactiveDatumSelection, onDatumSelect, chart, xAxis?.dataKey]);

    const emitLegendSelection = React.useCallback((entry) => {
        if (!interactiveLegendSelection) {
            return;
        }
        const legendSeriesKey = String(entry?.value || entry?.dataKey || entry?.payload?.value || entry?.payload?.dataKey || "").trim();
        const selection = normalizeChartLegendSelection({
            entry,
            selectionRows: collectChartLegendSelectionRows(chartData, legendSeriesKey),
        });
        if (!selection) {
            return;
        }
        onLegendItemSelect(selection);
    }, [chartData, interactiveLegendSelection, onLegendItemSelect]);

    const emitSeriesDatumSelection = React.useCallback((seriesKey, event) => {
        if (!interactiveDatumSelection) {
            return;
        }
        const selection = normalizeChartSeriesDatumSelection({
            event,
            seriesKey,
            xAxisDataKey: normalizeChartKey(xAxis?.dataKey || "name"),
            chartRows: chartData,
        });
        if (!selection) {
            return;
        }
        onDatumSelect(selection);
    }, [chartData, interactiveDatumSelection, onDatumSelect, xAxis?.dataKey]);

    const interactiveLegendContent = interactiveLegendSelection ? ((legendPropsInput = {}) => {
        const payload = Array.isArray(legendPropsInput?.payload) ? legendPropsInput.payload : [];
        return (
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "center",
                    paddingTop: embedded ? 0 : 6,
                }}
            >
                {payload.map((entry, index) => {
                    const label = String(entry?.value || entry?.dataKey || `Series ${index + 1}`);
                    const color = entry?.color || entry?.payload?.color || palette[index % Math.max(palette.length, 1)] || chartSeriesColor(index + 1, "#137cbd");
                    return (
                        <button
                            key={`${label}-${index}`}
                            type="button"
                            className="forge-chart-legend-action"
                            onClick={() => emitLegendSelection(entry)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: "1px solid var(--forge-chart-border, #d8e1e8)",
                                background: "var(--forge-chart-surface, #ffffff)",
                                color: "var(--forge-chart-text, #30404d)",
                                borderRadius: 999,
                                padding: "4px 10px",
                                cursor: "pointer",
                                fontSize: chartTypography.captionSize,
                                lineHeight: `${chartTypography.captionLineHeight}px`,
                                fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing,
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "999px",
                                    background: color,
                                }}
                            />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>
        );
    }) : null;

    const denseChartData = fillMissingTemporalBuckets(
        chartData,
        xAxis?.dataKey || "name",
        renderableSeriesDefinitions,
        chart?.fillMissingTemporalBuckets,
    );

    const normalizedAllChartData = (isHorizontalBar
        ? orderHorizontalChartRows(denseChartData, renderableSeriesDefinitions[0]?.value, chart?.preserveCategoryOrder === true)
        : denseChartData
    ).map((row) => ({
        ...row,
        __seriesFormats: Object.fromEntries(renderableSeriesDefinitions.map((entry) => [entry.value, entry.format || leftAxis.format])),
        __seriesAxes: Object.fromEntries(renderableSeriesDefinitions.map((entry) => [entry.value, entry.axis === "right" ? rightAxis?.format : leftAxis.format])),
    }));
    const normalizedChartData = normalizedAllChartData;
    const smallMultiplesDomain = smallMultiples ? sharedChartDomain(normalizedChartData,renderableSeriesDefinitions,leftAxis.domain) : null;
    const inspectTooltip = (category,seriesKey) => {const entry=tooltipEntries.find(entry=>entry.id===chartTooltipEntryId(category,seriesKey));if(entry){setTooltipActiveId(entry.id);onTooltipInspect?.(entry.id);}};
    const documentPoint = (props,entry) => {
        const value=readChartDataValue(props.payload,entry.value);
        if(!isChartNumericValue(value)) return null;
        const label=`${entry.name || entry.label || entry.value}, ${formatChartXAxisValue(readChartDataValue(props.payload,xAxis.dataKey),resolvedTickFormat,resolvedTickValueMode)}: ${formatValueByFormat(value,entry.format || leftAxis.format)}`;
        const color=resolveChartCategoryColor(chart,readChartDataValue(props.payload,xAxis.dataKey),resolveConditionalSeriesColor(entry,value,entry.color));
        return <ChartPoint {...props} seriesKey={String(entry.value)} category={String(readChartDataValue(props.payload,xAxis.dataKey) ?? "")} firstIndex={normalizedChartData.findIndex(row=>isChartNumericValue(readChartDataValue(row,entry.value)))} label={label} color={color} style={documentStyle} onInspect={chart.tooltip?()=>inspectTooltip(readChartDataValue(props.payload,xAxis.dataKey),entry.value):undefined} onSelect={interactiveDatumSelection ? ()=>emitSeriesDatumSelection(entry.value,props.payload) : undefined}/>;
    };

    const resolvedChartAnnotations = React.useMemo(() => (
        buildRuntimeChartAnnotationElements(normalizeChartAnnotations(chart), { embedded })
    ), [chart, embedded]);

    const configuredBarSize = documentAppearance ? (isHorizontalBar ? documentStyle.barSize : documentStyle.columnSize) : typeof chart?.barSize === "number" && Number.isFinite(chart.barSize) && chart.barSize > 0 ? chart.barSize : undefined;
    const chartPointIdentity = (seriesKey, row) => ({
        "data-series-id": String(seriesKey),
        "data-category": String(row?.[xAxis?.dataKey] ?? ""),
    });
    const renderSeriesPoint = (entry, visible) => (props = {}) => {
        const row = props.payload ?? normalizedChartData[props.index];
        const value = row?.[entry.value] ?? (Array.isArray(props.value) ? props.value.at(-1) : props.value);
        if (!Number.isFinite(Number(value)) || value === null || value === "") return null;
        const category = readChartDataValue(row,xAxis?.dataKey);
        return <circle
            key={props.index}
            cx={props.cx}
            cy={props.cy}
            r={visible ? (embedded || interactiveDatumSelection ? 4 : 3) : 6}
            {...chartPointIdentity(entry.value, row)}
            onMouseEnter={chart.tooltip?()=>inspectTooltip(category,entry.value):undefined}
            onFocus={chart.tooltip?()=>inspectTooltip(category,entry.value):undefined}
            role="img"
            aria-label={`${entry.label || entry.value} at ${category}: ${value}`}
            strokeWidth={visible ? 1 : 0}
            stroke={visible ? "var(--forge-chart-surface, #ffffff)" : "none"}
            fill={visible
                ? resolveChartCategoryColor(chart, row?.[xAxis?.dataKey], resolveConditionalSeriesColor(entry, row?.[entry.value], entry.color))
                : "transparent"}
            {...(!visible ? {pointerEvents: "all"} : {})}
        />;
    };

    const cartesianSeriesElements = renderableSeriesDefinitions.map((entry, seriesIndex) => {
        const singlePointSeries = normalizedChartData.filter(row => isChartNumericValue(readChartDataValue(row, entry.value))).length === 1;
        const defaultLineDash = renderableSeriesDefinitions.length > 1 && (entry.type === "line" || entry.type === "area")
            ? [undefined, "8 4", "3 3", "10 3 2 3"][seriesIndex % 4]
            : undefined;
        const commonProps = {
            dataKey: entry.value,
            name: entry.name || entry.label,
            yAxisId: entry.axis || "left",
            stroke: entry.color,
            fill: entry.color,
            strokeWidth: documentAppearance ? documentStyle.lineWidth : entry.strokeWidth || (embedded ? 3 : 2),
            strokeDasharray: documentAppearance ? undefined : entry.strokeDasharray || defaultLineDash,
            fillOpacity: entry.fillOpacity ?? (entry.type === "area" ? 0.22 : 1),
            opacity: entry.opacity,
            isAnimationActive: resolveChartAnimationActive(chart),
        };
        const showSeriesDataLabels = shouldRenderSeriesDataLabels(entry, type, normalizedChartData.length, embedded)
            && (!documentAppearance || !chart.stacked || entry.dataLabels === "always");
        const dataLabelFormatter = buildDataLabelFormatter(entry.format || leftAxis.format);

        // Recharts mirrors these logical corners with signed width/height.
        // The same tip corners therefore handle positive and negative bars.
        if (entry.type === "bar") {
            return (
                <Bar key={entry.value} {...commonProps} radius={entry.stackId || chart.stacked ? 0 : resolveChartBarCornerRadii(1, 'vertical')} barSize={documentAppearance ? undefined : configuredBarSize} maxBarSize={documentAppearance ? configuredBarSize : undefined} stackId={entry.stackId || (chart.stacked ? 'total' : undefined)} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}>
                    {normalizedChartData.map((row, index) => (
                        <Cell key={`${entry.value}-cell-${index}`}
                              {...chartPointIdentity(entry.value, row)}
                              {...(entry.pointColorMode === "bySign" ? {fill: resolveChartCategoryColor(chart, row?.[xAxis?.dataKey], resolveConditionalSeriesColor(entry, row?.[entry.value], entry.color))} : {})} />
                    ))}
                    {showSeriesDataLabels ? (
                        <LabelList dataKey={entry.value} position="top" formatter={dataLabelFormatter} fill="var(--forge-chart-text-muted, #5f6b7c)" fontSize={chartTypography.captionSize} fontFamily={chartTypography.captionFamily} fontWeight={chartTypography.captionWeight} letterSpacing={chartTypography.captionLetterSpacing} />
                    ) : null}
                </Bar>
            );
        }
        if (entry.type === "area") {
            const dotRenderer = documentAppearance ? props=>documentPoint(props,entry) : renderSeriesPoint(entry, singlePointSeries || embedded || interactiveDatumSelection || entry.pointColorMode === "bySign");
            return (
                <Area key={entry.value} {...commonProps} type={documentAppearance ? 'linear' : 'monotone'} connectNulls={!documentAppearance} dot={dotRenderer} activeDot={documentAppearance ? {r:documentStyle.pointRadius + 1,strokeWidth:documentStyle.pointStrokeWidth} : embedded || interactiveDatumSelection ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}>
                    {showSeriesDataLabels ? (
                        <LabelList dataKey={entry.value} position="top" formatter={dataLabelFormatter} fill="var(--forge-chart-text-muted, #5f6b7c)" fontSize={chartTypography.captionSize} fontFamily={chartTypography.captionFamily} fontWeight={chartTypography.captionWeight} letterSpacing={chartTypography.captionLetterSpacing} />
                    ) : null}
                </Area>
            );
        }
        const lineDotRenderer = documentAppearance ? props=>documentPoint(props,entry) : renderSeriesPoint(entry, singlePointSeries || embedded || interactiveDatumSelection || entry.pointColorMode === "bySign");
        return (
            <Line key={entry.value} {...commonProps} type={documentAppearance ? 'linear' : 'monotone'} connectNulls={!documentAppearance} strokeLinecap="round" strokeLinejoin="round" dot={lineDotRenderer} activeDot={documentAppearance ? {r:documentStyle.pointRadius + 1,strokeWidth:documentStyle.pointStrokeWidth} : embedded || interactiveDatumSelection ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}>
                {showSeriesDataLabels ? (
                    <LabelList dataKey={entry.value} position="top" formatter={dataLabelFormatter} fill="var(--forge-chart-text-muted, #5f6b7c)" fontSize={chartTypography.captionSize} fontFamily={chartTypography.captionFamily} fontWeight={chartTypography.captionWeight} letterSpacing={chartTypography.captionLetterSpacing} />
                ) : null}
            </Line>
        );
    });

    const sharedChartChildren = (
        <>
            <CartesianGrid strokeDasharray={documentAppearance ? undefined : cartesianGrid.strokeDasharray} vertical={!documentAppearance} stroke={gridStroke}/>
            {resolvedChartAnnotations.background}
            <XAxis
                dataKey={xAxis?.dataKey || "name"}
                ticks={responsiveCivilDateAxis.ticks}
                tickFormatter={(val) => formatChartXAxisValue(
                    val,
                    documentAppearance ? resolvedTickFormat : responsiveCivilDateAxis.tickFormat || resolvedTickFormat,
                    responsiveCivilDateAxis.compact ? "civil" : resolvedTickValueMode,
                )}
                tick={renderXAxisCategoryTick}
                axisLine={false}
                tickLine={false}
                minTickGap={responsiveCivilDateAxis.compact ? 18 : (embedded ? 24 : 5)}
                label={{
                    value: embedded ? "" : (xAxis.label || ""),
                    position: String(xAxis?.label || "").trim() ? "bottom" : responsiveCivilDateAxis.labelPosition,
                    offset: String(xAxis?.label || "").trim() ? 18 : responsiveCivilDateAxis.labelOffset,
                    ...axisLabelStyle,
                }}
            />
            <YAxis
                yAxisId="left"
                width={documentAppearance ? documentValueAxisWidth(leftAxis) : embedded ? 56 : 76}
                tickMargin={documentAppearance ? documentStyle.axisTickMargin : undefined}
                tickFormatter={createAxisTickFormatter(leftAxis.format,documentAppearance)}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                label={{
                    value: embedded ? "" : (leftAxis.label || yAxisLabel),
                    angle: -90,
                    position: "insideLeft",
                    ...axisLabelStyle,
                }}
                domain={resolveChartValueAxisDomain(type, leftAxis.domain)}
            />
            {hasRightAxis ? (
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={documentAppearance ? documentValueAxisWidth(rightAxis, 'right') : embedded ? 56 : 68}
                    tickMargin={documentAppearance ? documentStyle.axisTickMargin : undefined}
                    tickFormatter={createAxisTickFormatter(rightAxis?.format,documentAppearance)}
                    tick={axisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    label={!embedded && rightAxis?.label ? {
                        value: rightAxis.label,
                        angle: 90,
                        position: "insideRight",
                        ...axisLabelStyle,
                    } : undefined}
                    domain={rightAxis?.domain}
                />
            ) : null}
            <Tooltip
                {...(chart.tooltip ? {content: props => <ChartHoverTooltip {...props} entries={tooltipEntries} chart={chart}/>, allowEscapeViewBox: {x:false,y:false}, wrapperStyle:{maxWidth:"100%",pointerEvents:"none"}} : {})}
                labelFormatter={(val) => formatChartXAxisValue(val, resolvedTickFormat, resolvedTickValueMode)}
                formatter={(value, name, item) => {
                    const formatType = item?.payload?.__seriesFormats?.[item?.dataKey] || item?.payload?.__seriesAxes?.[item?.dataKey];
                    return [tooltipFormatterForFormat(formatType)(value), name];
                }}
                contentStyle={embedded || documentAppearance ? {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing, color: "var(--forge-chart-text, #30404d)", background: "var(--forge-chart-surface, #ffffff)", borderRadius: documentAppearance ? "var(--forge-radius-surface, 8px)" : "8px", border: documentAppearance ? "var(--forge-border-width, 1px) solid var(--forge-chart-border, #d8e1e8)" : "1px solid var(--forge-chart-border, #d8e1e8)"} : undefined}
            />
            {showChartLegend ? <Legend {...legendProps} {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})}/> : null}
            {cartesianSeriesElements}
            {resolvedChartAnnotations.foreground}
        </>
    );

    const composedChart = (
        <ComposedChart accessibilityLayer={documentAppearance || !!chart.tooltip || undefined} data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </ComposedChart>
    );

    const lineChart = (
        <LineChart accessibilityLayer={documentAppearance || !!chart.tooltip || undefined} data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </LineChart>
    );

    const barChart = (
        <BarChart accessibilityLayer={documentAppearance || !!chart.tooltip || undefined} data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </BarChart>
    );

    const horizontalBarChart = (() => {
        const categoryKey = xAxis?.dataKey;
        const primarySeries = selectedSeriesDefinitions[0];
        if (!categoryKey || !primarySeries) return null;

        const activePalette = (palette && palette.length > 0) ? palette : defaultCategoricalPalette();
        const categoryWidth = horizontalBarLayout.categoryWidth;
        const barSize = configuredBarSize ?? (documentAppearance ? documentStyle.barSize : embedded ? 10 : 12);
        const showHorizontalDataLabels = shouldRenderSeriesDataLabels(primarySeries, responsiveChartType, normalizedChartData.length, embedded);
        const primaryDataLabelFormatter = buildDataLabelFormatter(primarySeries.format || leftAxis.format);

        return (
            <BarChart accessibilityLayer={documentAppearance || !!chart.tooltip || undefined} data={normalizedChartData} margin={chartMargin} layout="vertical">
                <CartesianGrid strokeDasharray={documentAppearance ? undefined : cartesianGrid.strokeDasharray} vertical={!documentAppearance} stroke={gridStroke}/>
                {resolvedChartAnnotations.background}
                <XAxis
                    type="number"
                    tickFormatter={createAxisTickFormatter(primarySeries.format || leftAxis.format,documentAppearance)}
                    tick={axisTickStyle}
                    label={{
                        value: embedded ? "" : (leftAxis.label || yAxisLabel || (directSeriesChart ? primarySeries.label : "") || ""),
                        position: "insideBottomRight",
                        offset: 0,
                    }}
                    domain={resolveChartValueAxisDomain(responsiveChartType, leftAxis.domain)}
                    tickCount={horizontalBarLayout.numericTickCount}
                    minTickGap={horizontalBarLayout.numericMinTickGap}
                    interval="preserveStartEnd"
                />
                <YAxis
                    type="category"
                    dataKey={categoryKey}
                    width={categoryWidth}
                    tick={renderYAxisCategoryTick}
                />
                <Tooltip
                {...(chart.tooltip ? {content: props => <ChartHoverTooltip {...props} entries={tooltipEntries} chart={chart}/>, allowEscapeViewBox: {x:false,y:false}, wrapperStyle:{maxWidth:"100%",pointerEvents:"none"}} : {})}
                    formatter={(value) => tooltipFormatterForFormat(primarySeries.format || leftAxis.format)(value)}
                    contentStyle={embedded || documentAppearance ? {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing, color: "var(--forge-chart-text, #30404d)", background: "var(--forge-chart-surface, #ffffff)", borderRadius: documentAppearance ? "var(--forge-radius-surface, 8px)" : "8px", border: documentAppearance ? "var(--forge-border-width, 1px) solid var(--forge-chart-border, #d8e1e8)" : "1px solid var(--forge-chart-border, #d8e1e8)"} : undefined}
                />
                {chart?.showLegend !== false && selectedSeriesDefinitions.length > 1 ? <Legend {...legendProps} {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})} /> : null}
                {selectedSeriesDefinitions.length === 1 ? (
                    <Bar
                        dataKey={primarySeries.value}
                        radius={resolveChartBarCornerRadii(1, 'horizontal')}
                        name={primarySeries.name || primarySeries.label}
                        fill={primarySeries.color}
                        barSize={barSize}
                        isAnimationActive={resolveChartAnimationActive(chart)}
                        {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(primarySeries.value, payload) } : {})}
                    >
                        {showHorizontalDataLabels ? (
                            <LabelList dataKey={primarySeries.value} content={(props) => <HorizontalBarValueLabel {...props} formatter={primaryDataLabelFormatter} />} />
                        ) : null}
                        {normalizedChartData.map((row, index) => (
                            <Cell
                                key={`cell-${index}`}
                                {...chartPointIdentity(primarySeries.value, row)}
                                fill={resolveChartCategoryColor(chart, row?.[xAxis?.dataKey], primarySeries.pointColorMode === "bySign"
                                    ? resolveConditionalSeriesColor(primarySeries, row?.[primarySeries.value], activePalette[index % activePalette.length])
                                    : activePalette[index % activePalette.length])}
                            />
                        ))}
                    </Bar>
                ) : (
                    selectedSeriesDefinitions.map((entry) => (
                        <Bar
                            key={entry.value}
                            radius={entry.stackId ? 0 : resolveChartBarCornerRadii(1, 'horizontal')}
                            dataKey={entry.value}
                            name={entry.name || entry.label}
                            fill={entry.color}
                            barSize={barSize}
                            isAnimationActive={resolveChartAnimationActive(chart)}
                            stackId={responsiveChartType === "funnel_bar" ? undefined : entry.stackId}
                            {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}
                        >
                            {normalizedChartData.map((row, index) => (
                                <Cell key={`${entry.value}-cell-${index}`}
                                      {...chartPointIdentity(entry.value, row)}
                                      {...(entry.pointColorMode === "bySign" ? {fill: resolveChartCategoryColor(chart, row?.[xAxis?.dataKey], resolveConditionalSeriesColor(entry, row?.[entry.value], entry.color))} : {})} />
                            ))}
                            {shouldRenderSeriesDataLabels(entry, responsiveChartType, normalizedChartData.length, embedded) ? (
                                <LabelList dataKey={entry.value} content={(props) => <HorizontalBarValueLabel {...props} formatter={buildDataLabelFormatter(entry.format || leftAxis.format)} />} />
                            ) : null}
                        </Bar>
                    ))
                )}
                {resolvedChartAnnotations.foreground}
            </BarChart>
        );
    })();

    const areaChart = (
        <AreaChart accessibilityLayer={documentAppearance || !!chart.tooltip || undefined} data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </AreaChart>
    );

    if(isPieChart&&chart.paletteMode==='declared'&&chartData.some(row=>!Object.hasOwn(chart.series?.categoryColors||{},String(row.name))))throw new Error('Declared category palettes require a color for every category.');
    const pieFilteredData = isPieChart
        ? chartData.filter((row) => selectedDataKeys.includes(row.name)).map(row=>chart.sliceLabel?{...row,sliceLabel:resolvePieSliceLabel(chart.sliceLabel,row.__chartSelectionRows||[])}:row)
        : [];
    const piePalette = palette.length > 0
        ? palette
        : resolveThemeAwareChartPalette(['#137cbd', '#0f9960', '#d9822b', '#8f398f', '#c23030', '#5c7080', '#2965cc', '#29a634'], {forceRole: true});
    const compactPie = isPieChart && Number(chartSize.width || 0) > 0 && Number(chartSize.width || 0) <= 520;
    const pieInnerRadius = type === "donut" ? (chart.center?(compactPie?"40%":"55%"):(compactPie ? "34%" : "45%")) : 0;
    const pieChart = (
        <PieChart margin={embedded ? {top: 8, right: 8, bottom: 8, left: 8} : {top: 10, right: 10, bottom: 10, left: 10}}>
            <Pie
                data={pieFilteredData}
                dataKey="value"
                nameKey="name"
                isAnimationActive={resolveChartAnimationActive(chart)}
                {...(interactiveDatumSelection ? { onClick: emitDatumSelection } : {})}
                cx="50%"
                cy={compactPie ? "38%" : "50%"}
                innerRadius={pieInnerRadius}
                outerRadius={compactPie ? "52%" : "78%"}
                paddingAngle={pieFilteredData.length > 1 ? 2 : 0}
                label={chart.sliceLabel ? props => props.payload?.sliceLabel==null?null:<text x={props.x} y={props.y} textAnchor={props.textAnchor} fill="var(--forge-chart-text, #30404d)" fontSize={chartTypography.smallSize} fontFamily={chartTypography.smallFamily} fontWeight={chartTypography.smallWeight} letterSpacing={chartTypography.smallLetterSpacing}>{props.payload.sliceLabel}</text> : embedded || compactPie || documentAppearance ? false : props => visiblePiePercentage(props) ? `${props.name} ${(props.percent * 100).toFixed(0)}%` : null}
                labelLine={!embedded && !compactPie && !documentAppearance ? PiePercentageLeader : false}
            >
                {centerState.resolved && <Label position="center" content={<DonutCenterLabel center={centerState.resolved} typography={chartTypography} measure={(text,size,role,emphasis)=>measureCategoryTickText(text,{fontSize:size,fontFamily:role==='value'?chartTypography[(centerState.resolved.valueRole==='body'?'body':'small')+'Family']:chartTypography.captionFamily,fontWeight:emphasis?.includes('bold')?'bold':role==='value'?chartTypography[(centerState.resolved.valueRole==='body'?'body':'small')+'Weight']:chartTypography.captionWeight,fontStyle:emphasis?.includes('italic')?'italic':undefined,letterSpacing:role==='value'?chartTypography[(centerState.resolved.valueRole==='body'?'body':'small')+'LetterSpacing']:chartTypography.captionLetterSpacing})} onLayout={setCenterNeedsDetails}/>}/>}
                {pieFilteredData.map((entry, index) => (
                    <Cell key={buildPieSliceCellKey(entry, index)} fill={resolveChartCategoryColor(chart, entry.name, piePalette[index % piePalette.length])} />
                ))}
            </Pie>
            <Tooltip
                {...(chart.tooltip ? {content: props => <ChartHoverTooltip {...props} entries={tooltipEntries} chart={chart}/>, allowEscapeViewBox: {x:false,y:false}, wrapperStyle:{maxWidth:"100%",pointerEvents:"none"}} : {})}
                formatter={(value) => formatLargeNumber(value)}
                contentStyle={embedded || documentAppearance ? {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing, color: "var(--forge-chart-text, #30404d)", background: "var(--forge-chart-surface, #ffffff)", borderRadius: documentAppearance ? "var(--forge-radius-surface, 8px)" : "8px", border: documentAppearance ? "var(--forge-border-width, 1px) solid var(--forge-chart-border, #d8e1e8)" : "1px solid var(--forge-chart-border, #d8e1e8)"} : undefined}
            />
            {showChartLegend ? (
                <Legend
                    {...(embedded ? {wrapperStyle: {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing}, iconSize: 10} : {})}
                    {...(compactPie ? {verticalAlign: "bottom", align: "center", wrapperStyle: {fontSize: chartTypography.captionSize, lineHeight: `${chartTypography.captionLineHeight}px`, paddingTop: "8px", fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing}, iconSize: 9} : {})}
                    {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})}
                />
            ) : null}
        </PieChart>
    );

    const computedWidthByCol = React.useMemo(() => {
        const out = {};
        allTableColumns.forEach((key) => {
            const meta = chartTableColumnMeta(key, tableXAxis, tableSeriesDefinitions);
            const headerLen = String(meta.label || key || "").length;
            let maxLen = headerLen;
            chartData.forEach((row) => {
                const raw = readChartDataValue(row, key) ?? "";
                const len = String(formatChartTableCell(raw, meta, resolvedTickFormat, resolvedTickValueMode) ?? "").length;
                if (len > maxLen) maxLen = len;
            });
            const w = Math.max(110, Math.min(420, maxLen * 8 + 28));
            out[key] = w;
        });
        return out;
    }, [allTableColumns, chartData, resolvedTickFormat, resolvedTickValueMode, tableSeriesDefinitions, tableXAxis]);

    const tableColumnWidths = visibleColumns.map((key) => {
        const persisted = Number(columnWidths[key]);
        if (Number.isFinite(persisted) && persisted > 60) return persisted;
        return computedWidthByCol[key] || 140;
    });

    const toggleColumnVisibility = (key) => {
        setVisibleColumns((prev) => {
            if (prev.includes(key)) return prev.filter((k) => k !== key);
            return [...prev, key];
        });
    };

    const downloadCsv = () => {
        const cols = visibleColumns.length ? visibleColumns : allTableColumns;
        const lines = [cols.map((key) => escapeCsvCell(chartTableColumnMeta(key, tableXAxis, tableSeriesDefinitions).label)).join(",")];
        chartData.forEach((row) => {
            lines.push(cols.map((c) => escapeCsvCell(readChartDataValue(row, c))).join(","));
        });
        const blob = new Blob(["\ufeff" + lines.join("\n")], {type: "text/csv;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `chart-table-${ts}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const tableColumnMeta = visibleColumns.map((columnKey) => chartTableColumnMeta(columnKey, tableXAxis, tableSeriesDefinitions));

    const chartExportId = container?.id && String(container?.kind || '').startsWith('dashboard.')
        ? container.id
        : undefined;

    const hasUnderlyingChartRows = isPieChart ? chartData.length > 0 : normalizedChartData.length > 0;
    const canRenderChartSelection = isPieChart ? pieFilteredData.length > 0 : selectedSeriesDefinitions.length > 0;
    const hasChartRows = isPieChart ? pieFilteredData.length > 0 : normalizedChartData.length > 0;
    const hasRenderableSeriesValues = isPieChart
        ? pieFilteredData.some((entry) => isChartNumericValue(entry?.value))
        : normalizedChartData.some((row) => selectedSeriesDefinitions.some((entry) => isChartNumericValue(row?.[entry.value])));
    const hasNonZeroRenderableSeriesValues = isPieChart
        ? pieFilteredData.some((entry) => isChartNumericValue(entry?.value) && Number(entry.value) !== 0)
        : hasNonZeroChartSeriesValue(normalizedChartData, selectedSeriesDefinitions.map((entry) => entry.value));
    const showZeroDataMessage = !effectiveLoading
        && !error
        && hasChartRows
        && hasRenderableSeriesValues
        && !hasNonZeroRenderableSeriesValues;
    const hasResolvedMetricsPayload = chartMetrics && typeof chartMetrics === 'object' && Object.keys(chartMetrics).length > 0;
    const showResolvedEmptyStateWhileLoading =
        effectiveLoading
        && !staleWhileLoading
        && !error
        && !hasChartRows
        && hasResolvedMetricsPayload;
    const emptyChartMessage = resolveEmptyChartMessage(chartMetrics);
    const showSeriesSelectionControls = !showResolvedEmptyStateWhileLoading
        && !(chart?.hideControlsWhenEmpty === true && !hasUnderlyingChartRows);
    const { showSelectionMessage, showEmptyDataMessage } = resolveChartBodyState({
        loading: effectiveLoading,
        error,
        hasUnderlyingChartRows,
        canRenderChartSelection,
        hasChartRows,
        hasRenderableSeriesValues,
        showResolvedEmptyStateWhileLoading,
    });

    const renderSeriesSelectionControls = ({compact = false} = {}) => (
        <div
            aria-label="Chart series selector"
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                justifyContent: compact ? "flex-end" : "flex-start",
                marginTop: compact ? 0 : 8,
                marginBottom: compact ? 0 : 8,
            }}
        >
            {seriesToggleOptions.map((option) => {
                const checked = selectedDataKeys.includes(option.value);
                return (
                    <label
                        key={option.value}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: checked ? "1px solid var(--forge-chart-action, #2f6de1)" : "1px solid var(--forge-chart-border, rgba(138,155,168,0.18))",
                            background: checked ? "var(--forge-chart-selected, rgba(47,109,225,0.08))" : "var(--forge-chart-surface, #fff)",
                            color: checked ? "var(--forge-chart-action, #2f6de1)" : "var(--forge-chart-text-muted, #4b5563)",
                            cursor: "pointer",
                            userSelect: "none",
                            fontSize: chartTypography.smallSize,
                            lineHeight: `${chartTypography.smallLineHeight}px`,
                            fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing,
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleDataKeySelect(option.value)}
                            style={{margin: 0}}
                        />
                        <span
                            aria-hidden="true"
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "999px",
                                background: option.color,
                                opacity: checked ? 1 : 0.4,
                            }}
                        />
                        <span>{option.label}</span>
                    </label>
                );
            })}
            <ChartActionButton documentAppearance={documentAppearance}
                title="Clear series selection"
                onClick={handleClearSelection}
            >
                Clear
            </ChartActionButton>
        </div>
    );

    const resolvedWidth = isHorizontalBar
        ? normalizeChartExtent(width, horizontalBarLayout.width)
        : normalizeChartExtent(width, "100%");
    const estimatedHorizontalRowHeight = categoryLabelConfig?.lines === 2
        ? (embedded ? 34 : 40)
        : (embedded ? 28 : 32);
    const horizontalBarDefaultHeight = Math.max(
        embedded ? 150 : 160,
        Math.min(embedded ? 380 : 440, 96 + normalizedChartData.length * estimatedHorizontalRowHeight),
    );
    const resolvedHeight = isHorizontalBar
        ? normalizeChartExtent(height, horizontalBarDefaultHeight)
        : normalizeChartExtent(height, documentAppearance ? documentStyle.plotHeight : embedded ? 380 : 240);
    const effectiveViewportHeight = showEmptyDataMessage
        ? normalizeChartExtent(chart?.emptyHeight, resolvedHeight)
        : resolvedHeight;
    const resolvedMinHeight = (() => {
        if (typeof effectiveViewportHeight === 'number') {
            return effectiveViewportHeight;
        }
        const normalized = typeof effectiveViewportHeight === 'string' ? effectiveViewportHeight.trim().toLowerCase() : '';
        if (normalized === '100%') {
            return embedded ? 220 : 420;
        }
        return 0;
    })();
    const chartViewportStyle = {
        width: "100%",
        height: (centerState.resolved && (showZeroDataMessage||showEmptyDataMessage||showSelectionMessage)) || type === "category-range" || type === "heatmap" || smallMultiples || (documentAppearance && isHorizontalBar && renderableSeriesDefinitions.length === 1) ? 'auto' : effectiveViewportHeight,
        minHeight: (centerState.resolved && (showZeroDataMessage||showEmptyDataMessage||showSelectionMessage)) || type === "category-range" || type === "heatmap" || smallMultiples || (documentAppearance && isHorizontalBar && renderableSeriesDefinitions.length === 1) ? undefined : resolvedMinHeight || undefined,
        minWidth: 0,
        flex: "0 0 auto",
        margin: isHorizontalBar ? "0 auto" : undefined,
        position: "relative",
    };
    const chartCanRenderViewport = chartSize.width > 0 && chartSize.height > 0;
    return (
        <div
            style={{width: resolvedWidth, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, position: "relative"}}
            data-dashboard-chart-id={chartExportId}
            data-chart-loading={effectiveLoading ? "true" : "false"}
            data-chart-stale={staleWhileLoading ? "true" : "false"}
            className={documentAppearance ? 'forge-chart-document' : undefined}
            data-forge-chart-appearance={chart.appearance}
            data-forge-chart-layout={chart.layout}
            data-forge-chart-type={type}
            aria-busy={effectiveLoading || undefined}
        >
            {documentAppearance && !smallMultiples && chart.showLegend !== false && availableDataKeys.length > 1 && <div className="forge-chart-document-legend" aria-label="Chart series">
                {seriesToggleOptions.map(option => <button key={option.value} type="button" aria-pressed={selectedDataKeys.includes(option.value)} onClick={() => interactiveLegendSelection ? emitLegendSelection({dataKey:option.value,value:option.label}) : handleDataKeySelect(option.value)}>
                    <span aria-hidden="true" style={{background:option.color}}/>{option.label}
                </button>)}
            </div>}
            {(!embedded || documentAppearance) && chart.metricSelection ? (
                <div className="forge-chart-metric-selectors" role="group" aria-label="Trend metrics">
                    {(chart.type === "horizontal_bar" ? [["primaryField", "Primary metric"]] : [["primaryField", "Primary metric"], ["secondaryField", "Secondary metric"]]).map(([field, label]) => {
                        const selectProps={
                            'aria-label':label,value:chart.metricSelection[field],onChange:event=>{
                                const choice = {primaryField: chart.metricSelection.primaryField, secondaryField: chart.metricSelection.secondaryField, [field]: event.target.value};
                                selectionStateRef.current = {initialized: false, touched: false};
                                setMetricChoice(choice);
                                onMetricSelectionChange?.(choice);
                            },
                        };
                        const options=[
                                ...(field === "secondaryField" ? [{value: "", label: "None"}] : []),
                                ...chart.metricSelection.options.filter(option => option.value !== chart.metricSelection[field === "primaryField" ? "secondaryField" : "primaryField"]).map(option => ({value: option.value, label: option.label || option.value})),
                        ];
                        return <label key={field} {...(documentAppearance ? typographyProps('label') : {})}>
                            <span>{label}</span>
                            {documentAppearance ? <SelectControl {...typographyProps('body')} {...selectProps}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</SelectControl> : <HTMLSelect {...selectProps} options={options}/>}
                        </label>;
                    })}
                </div>
            ) : null}
            {controlsVisible && showEmbeddedSeriesSelector && showSeriesSelectionControls ? (
                <div
                    aria-label="Chart series selector"
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: "6px 12px",
                        padding: "0 4px 10px",
                    }}
                >
                    {seriesToggleOptions.map((option) => {
                        const checked = selectedDataKeys.includes(option.value);
                        return (
                            <label
                                key={option.value}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: chartTypography.captionSize,
                                    lineHeight: `${chartTypography.captionLineHeight}px`,
                                    fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing,
                                    color: checked ? "var(--forge-chart-text, #41566d)" : "var(--forge-chart-text-muted, #7d8da1)",
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleDataKeySelect(option.value)}
                                    style={{margin: 0}}
                                />
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "999px",
                                        background: option.color,
                                        opacity: checked ? 1 : 0.35,
                                    }}
                                />
                                <span>{option.label}</span>
                            </label>
                        );
                    })}
                </div>
            ) : null}
            {(controlsVisible || viewSwitchEnabled) && (!embedded || documentAppearance) && showSeriesSelectionControls ? (
                <>
                    {controlsVisible && !directSeriesChart && !isPieChart ? (
                        <RadioGroup
                            inline={true}
                            name={container.id}
                            onChange={handleValueKeyChange}
                            selectedValue={selectedValueKey}
                        >
                            {(series.values || []).map((option, index) => (
                                <Radio key={option.value + index} label={option.label} value={option.value}/>
                            ))}
                        </RadioGroup>
                    ) : null}
                    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap"}}>
                        {viewSwitchEnabled && <div style={{display: "flex", gap: 6}}>
                            <ChartActionButton documentAppearance={documentAppearance} active={viewMode === "chart"} onClick={() => setViewMode("chart")}>
                                Chart
                            </ChartActionButton>
                            <ChartActionButton documentAppearance={documentAppearance} active={viewMode === "table"} onClick={() => setViewMode("table")}>
                                Table
                            </ChartActionButton>
                        </div>}
                        {controlsVisible && (viewMode === "chart"
                            ? renderSeriesSelectionControls({compact: true})
                            : (
                                <div style={{display: "flex", gap: 6}}>
                                    <ChartActionButton documentAppearance={documentAppearance} onClick={() => setShowColumnDialog(true)}>Columns</ChartActionButton>
                                    <ChartActionButton documentAppearance={documentAppearance} onClick={downloadCsv}>CSV</ChartActionButton>
                                </div>
                            ))}
                    </div>
                </>
            ) : null}
            {chartErrorMessage && (
                <div role={documentAppearance ? 'alert' : undefined} style={{color: 'var(--forge-status-danger-foreground, #a82a2a)', padding: 4}}>{chartErrorMessage}</div>
            )}

            {viewMode === "chart" ? (
                <div ref={chartRef} data-forge-part="chart-viewport" style={chartViewportStyle}>
                    {effectiveLoading && !staleWhileLoading && !showResolvedEmptyStateWhileLoading && !error ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                position: "relative",
                                overflow: "hidden",
                                borderRadius: 12,
                            }}
                        >
                            <SoftBlock
                                height="100%"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: 12,
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--forge-chart-text-muted, #7d8da1)",
                                    fontSize: chartTypography.smallSize,
                                    lineHeight: `${chartTypography.smallLineHeight}px`,
                                    fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing,
                                    pointerEvents: "none",
                                }}
                            >
                                Loading chart…
                            </div>
                        </div>
                    ) : centerState.error ? (<Typography as="p" typeRole="body" role="alert">{centerState.error}</Typography>
                    ) : centerState.resolved && (showZeroDataMessage||showEmptyDataMessage||showSelectionMessage) ? (
                        <EmptyDonutCenter center={centerState.resolved} typography={chartTypography} message={showSelectionMessage?"No slices selected.":showZeroDataMessage?"All slice values are zero.":"No slice data."}/>
                    ) : type === "category-range" ? (
                        <CategoryRange onInspect={chart.tooltip?(rowIndex,seriesIndex)=>inspectTooltip(readChartDataValue(chartData[rowIndex],chart.categoryRange.categoryField),seriesIndex):undefined} config={chart.categoryRange} rows={chartData} width={chartSize.width || 680} onSelect={interactiveDatumSelection?onDatumSelect:undefined}/>
                    ) : type === "heatmap" ? (
                        <CategoricalHeatmap onInspect={chart.tooltip?index=>setTooltipActiveId(tooltipEntries[index]?.id):undefined} title={container.title || chart.title || "Categorical heatmap"} config={chart.heatmap} rows={chartData} width={chartSize.width || 680} onSelect={interactiveDatumSelection?onDatumSelect:undefined}/>
                    ) : showZeroDataMessage ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                textAlign: "center",
                                color: "var(--forge-chart-text-muted, #5f6b7c)",
                                fontSize: chartTypography.smallSize,
                                lineHeight: `${chartTypography.smallLineHeight}px`,
                                fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing,
                            }}
                        >
                            <strong style={{ color: "var(--forge-chart-text, #30404d)" }}>All values are zero for the selected period.</strong>
                            <span>Adjust the report filters or choose a wider date interval.</span>
                        </div>
                    ) : showEmptyDataMessage ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                color: "var(--forge-chart-text-muted, #7d8da1)",
                                fontSize: chartTypography.smallSize,
                                lineHeight: `${chartTypography.smallLineHeight}px`,
                                fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing,
                            }}
                        >
                            {emptyChartMessage}
                        </div>
                    ) : showSelectionMessage ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                color: "var(--forge-chart-text-muted, #7d8da1)",
                                fontSize: chartTypography.smallSize,
                                lineHeight: `${chartTypography.smallLineHeight}px`,
                                fontFamily: chartTypography.smallFamily, fontWeight: chartTypography.smallWeight, letterSpacing: chartTypography.smallLetterSpacing,
                            }}
                        >
                            Select at least one series to render the chart.
                        </div>
                    ) : documentAppearance && chartErrorMessage ? null : documentAppearance && isPieChart && pieFilteredData.some(row => Number(row.value) < 0) ? (
                        <Typography as="p" typeRole="body" role="alert">Pie and donut charts require non-negative values. Use a bar chart to compare negative values.</Typography>
                    ) : smallMultiples ? (
                        <div className="forge-chart-multiples">
                            <Typography as="p" typeRole="metadata" className="forge-chart-scale-note">All plots use the same scale: {formatValueByFormat(smallMultiplesDomain[0],leftAxis.format)} to {formatValueByFormat(smallMultiplesDomain[1],leftAxis.format)}.</Typography>
                            {renderableSeriesDefinitions.map(entry => {
                                const childChart={
                                    ...chart,layout:undefined,height:documentStyle.smallPlotHeight,
                                    allowTableSwitch:false,showLegend:false,showControls:false,
                                    xAxis:{...xAxis},yAxis:{...leftAxis,domain:smallMultiplesDomain},axes:undefined,
                                    series:{values:[{...entry,color:chartSeriesColor(1,'#137cbd')}]},
                                };
                                const select=interactiveDatumSelection ? selection=>emitSeriesDatumSelection(entry.value,
                                    normalizedChartData.find(row=>String(readChartDataValue(row,xAxis.dataKey))===String(selection.xValue))) : undefined;
                                return <figure key={entry.value}>
                                    <Typography as="figcaption" typeRole="label">{entry.name || entry.label || entry.value}</Typography>
                                    <Chart container={{id:`${chartExportId}-${entry.value}`,collection:normalizedChartData,chart:childChart}} context={chartContext} embedded onDatumSelect={select} tooltipEntriesOverride={chart.tooltip?tooltipEntries.filter(detail=>detail.seriesKey===String(entry.value)):null} showTooltipInspector={false} onTooltipInspect={setTooltipActiveId}/>
                                </figure>;
                            })}
                        </div>
                    ) : documentAppearance && isHorizontalBar && renderableSeriesDefinitions.length === 1 ? (
                        <ComparisonBars onInspect={chart.tooltip?row=>inspectTooltip(readChartDataValue(row,xAxis.dataKey),renderableSeriesDefinitions[0].value):undefined} rows={normalizedChartData} series={renderableSeriesDefinitions[0]} categoryKey={xAxis.dataKey} colors={chart.series?.categoryColors} colorForValue={value=>resolveConditionalSeriesColor(renderableSeriesDefinitions[0],value,renderableSeriesDefinitions[0].color)} formatter={buildDataLabelFormatter((renderableSeriesDefinitions[0].format || leftAxis.format) === 'currency' ? 'currency2' : renderableSeriesDefinitions[0].format || leftAxis.format)} onSelect={interactiveDatumSelection ? row => emitSeriesDatumSelection(renderableSeriesDefinitions[0].value,row) : undefined}/>
                    ) : chartCanRenderViewport ? (
                        <ResponsiveContainer width={chartSize.width} height={chartSize.height}>
                            {isPieChart
                                ? pieChart
                                : isHorizontalBar
                                    ? horizontalBarChart
                                : type === "composed" || directSeriesChart || hasRightAxis
                                    ? composedChart
                                    : type === "bar"
                                        ? barChart
                                        : type === "area"
                                            ? areaChart
                                            : lineChart}
                        </ResponsiveContainer>
                    ) : null}
                </div>
            ) : (
                <div className="forge-chart-table-scroll">
                    <table className="forge-chart-table" style={{minWidth: resolveChartTableMinWidth(tableColumnWidths)}}>
                        <colgroup>
                            {tableColumnWidths.map((widthValue, index) => <col key={`${visibleColumns[index]}-width`} style={{width: widthValue}}/>)}
                        </colgroup>
                        <thead>
                            <tr>{tableColumnMeta.map((meta) => <th key={meta.key} scope="col">{meta.label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {chartData.map((row, rowIndex) => (
                                <tr key={row?.[xAxis?.dataKey] || rowIndex}>
                                    {tableColumnMeta.map((meta) => {
                                        const raw = readChartDataValue(row, meta.key) ?? '';
                                        const formatted = formatChartTableCell(raw, meta, resolvedTickFormat, resolvedTickValueMode);
                                        const text = String(formatted ?? '');
                                        const isLong = text.length > 120;
                                        return (
                                            <td key={meta.key} title={isLong ? text : undefined}
                                                onClick={() => isLong && setExpandedCell({title: meta.label, content: text})}>
                                                {isLong ? `${text.slice(0, 120)}…` : text}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {centerState.resolved && centerNeedsDetails && !showZeroDataMessage && !showEmptyDataMessage && !showSelectionMessage && <DonutCenterDetails center={centerState.resolved}/>}
            {staleWhileLoading ? (
                <div
                    style={{
                        position: "absolute",
                        top: embedded ? 6 : 10,
                        right: embedded ? 6 : 10,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "var(--forge-chart-surface, rgba(255,255,255,0.9))",
                        border: "1px solid var(--forge-chart-border, rgba(148,163,184,0.35))",
                        color: "var(--forge-chart-text-muted, #5f6b7c)",
                        fontSize: chartTypography.captionSize,
                        lineHeight: `${chartTypography.captionLineHeight}px`,
                        fontFamily: chartTypography.captionFamily, fontWeight: chartTypography.captionWeight, letterSpacing: chartTypography.captionLetterSpacing,
                        backdropFilter: "blur(4px)",
                        pointerEvents: "none",
                    }}
                >
                    Refreshing…
                </div>
            ) : null}

            <Dialog isOpen={!embedded && showColumnDialog} onClose={() => setShowColumnDialog(false)} title="Column customization">
                <div style={{padding: 12, display: "flex", flexDirection: "column", gap: 10}}>
                    {allTableColumns.map((key) => {
                        const meta = chartTableColumnMeta(key, tableXAxis, tableSeriesDefinitions);
                        return (
                        <div key={key} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12}}>
                            <label className="bp4-control bp4-checkbox" style={{marginBottom: 0}}>
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(key)}
                                    onChange={() => toggleColumnVisibility(key)}
                                />
                                <span className="bp4-control-indicator"/>
                                {meta.label}
                            </label>
                            <input
                                className="bp4-input bp4-small"
                                type="number"
                                min={80}
                                max={640}
                                value={Number(columnWidths[key] || computedWidthByCol[key] || 140)}
                                onChange={(e) => {
                                    const v = Number(e.target.value || 0);
                                    if (Number.isFinite(v) && v >= 80) {
                                        setColumnWidths((prev) => ({...prev, [key]: Math.min(640, v)}));
                                    }
                                }}
                                style={{width: 90}}
                            />
                        </div>
                        );
                    })}
                </div>
            </Dialog>

            {chart.tooltip && !effectiveLoading && !error && tooltipResult.error ? <Typography as="p" typeRole="body" role="alert">{tooltipResult.error}</Typography> : null}
            {chart.tooltip && showTooltipInspector && !effectiveLoading && !error && !tooltipResult.error ? <ChartTooltipInspector entries={tooltipEntries} activeId={tooltipActiveId} onChange={setTooltipActiveId}/> : null}

            <Dialog isOpen={!embedded && !!expandedCell} onClose={() => setExpandedCell(null)} title={expandedCell?.title || "Cell content"}>
                <div style={{padding: 12, whiteSpace: "pre-wrap", wordBreak: "break-word"}}>
                    {expandedCell?.content || ""}
                </div>
            </Dialog>
        </div>
    );
};

export default Chart;
