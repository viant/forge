import { formatDashboardValue } from "../components/dashboard/dashboardUtils.js";
import {
  aggregateGeoRows,
  buildGeoConfig,
  DEFAULT_GEO_PALETTE,
  findGeoColorRule,
  normalizeGeoKey,
  resolveGeoColor,
} from "../components/dashboard/geoMapUtils.js";
import { resolveKey } from "../utils/selector.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function buildLegend(config = {}, range = {}, locale = "en-US") {
  const colorRules = config.color?.field && Array.isArray(config.color?.rules)
    ? config.color.rules.filter((rule) => rule?.color)
    : [];
  if (colorRules.length > 0) {
    return {
      rules: colorRules.map((rule) => ({
        color: normalizeString(rule?.color),
        label: normalizeString(rule?.label || rule?.value || rule?.equals || rule?.when),
      })),
    };
  }
  return {
    min: formatDashboardValue(range.min, config.format, locale),
    max: formatDashboardValue(range.max, config.format, locale),
    palette: Array.isArray(config.color?.palette) && config.color.palette.length > 0
      ? cloneValue(config.color.palette)
      : cloneValue(DEFAULT_GEO_PALETTE),
  };
}

export function buildReportFillGeoPayload(block = {}, rows = [], { locale = "en-US" } = {}) {
  const config = buildGeoConfig({ geo: block?.geo || {} });
  const geoRows = aggregateGeoRows(Array.isArray(rows) ? rows : [], config);
  const values = Array.from(geoRows.values())
    .map((entry) => Number(entry.value))
    .filter(Number.isFinite);
  const range = values.length > 0
    ? { min: Math.min(...values), max: Math.max(...values) }
    : { min: 0, max: 0 };

  const regions = Array.from(geoRows.values())
    .map((entry) => {
      const row = entry?.row || null;
      const key = normalizeGeoKey(resolveKey(row, config.key));
      const label = config.labelKey ? resolveKey(row, config.labelKey) : key;
      const rawValue = Number.isFinite(Number(entry?.value)) ? Number(entry.value) : null;
      const colorRule = row ? findGeoColorRule(row, config.color) : null;
      return {
        key,
        label: normalizeString(label || key),
        rawValue,
        displayValue: rawValue != null ? formatDashboardValue(rawValue, config.format, locale) : "-",
        color: rawValue != null
          ? resolveGeoColor({ row, value: rawValue, minValue: range.min, maxValue: range.max, colorConfig: config.color })
          : config.color.empty,
        statusColor: normalizeString(colorRule?.color),
        statusLabel: normalizeString(colorRule ? (colorRule.label || colorRule.value || colorRule.equals || colorRule.when) : ""),
        rowCount: Number(entry?.count || 0) || 0,
      };
    })
    .filter((entry) => entry.key)
    .sort((left, right) => left.key.localeCompare(right.key));

  const ranking = [...regions]
    .filter((region) => Number.isFinite(region.rawValue))
    .sort((left, right) => {
      if (Number(right.rawValue || 0) !== Number(left.rawValue || 0)) {
        return Number(right.rawValue || 0) - Number(left.rawValue || 0);
      }
      return String(left.key || "").localeCompare(String(right.key || ""));
    });

  const totalValue = regions.reduce((sum, region) => sum + (Number(region.rawValue || 0) || 0), 0);
  const activeRegion = ranking[0] || regions[0] || null;

  return {
    shape: normalizeString(config.shape || "us-states"),
    keyField: normalizeString(config.key),
    labelField: normalizeString(config.labelKey),
    metricKey: normalizeString(config.metricKey),
    metricLabel: normalizeString(config.metricLabel),
    format: normalizeString(config.format),
    aggregate: normalizeString(config.aggregate || "sum"),
    regions: cloneValue(regions),
    ranking: cloneValue(ranking),
    activeRegion: cloneValue(activeRegion),
    summary: {
      regionCount: regions.length,
      totalValue: formatDashboardValue(totalValue, config.format, locale),
      topKey: normalizeString(ranking[0]?.key),
    },
    legend: config.legend === false ? null : buildLegend(config, range, locale),
  };
}
