import {
  DEFAULT_GEO_PALETTE,
  normalizeGeoKey,
  US_STATE_TILES,
} from "../components/dashboard/geoMapUtils.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function escapeXml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGeoDiagnostic(code = "", message = "") {
  const normalizedCode = normalizeString(code);
  const normalizedMessage = normalizeString(message);
  if (!normalizedCode || !normalizedMessage) {
    return null;
  }
  return {
    code: normalizedCode,
    severity: "warning",
    message: normalizedMessage,
  };
}

function resolveGeoTiles(shape = "") {
  const normalizedShape = normalizeString(shape).toLowerCase();
  if (normalizedShape === "us-states" || normalizedShape === "us-state-tiles") {
    return US_STATE_TILES;
  }
  return null;
}

function buildLegendSvg(legend = null, x = 0, y = 0, width = 220) {
  if (!legend || typeof legend !== "object" || Array.isArray(legend)) {
    return { svg: "", height: 0 };
  }
  if (Array.isArray(legend?.rules) && legend.rules.length > 0) {
    const ruleLines = legend.rules.map((rule, index) => {
      const lineY = y + (index * 18);
      return `
        <rect x="${x}" y="${lineY + 3}" width="12" height="12" rx="2" fill="${escapeXml(normalizeString(rule?.color) || "#98a2b3")}" />
        <text x="${x + 18}" y="${lineY + 14}" font-size="11" fill="#344054">${escapeXml(normalizeString(rule?.label) || "Rule")}</text>
      `;
    }).join("\n");
    return {
      svg: ruleLines,
      height: (legend.rules.length * 18) + 2,
    };
  }
  const palette = Array.isArray(legend?.palette) && legend.palette.length > 0
    ? legend.palette.map((entry) => normalizeString(entry)).filter(Boolean)
    : DEFAULT_GEO_PALETTE;
  const segmentWidth = Math.max(12, Math.floor((width - 70) / Math.max(1, palette.length)));
  const gradient = palette.map((color, index) => `
    <rect x="${x + 34 + (index * segmentWidth)}" y="${y + 3}" width="${segmentWidth}" height="10" fill="${escapeXml(color)}" />
  `).join("\n");
  return {
    svg: `
      <text x="${x}" y="${y + 12}" font-size="10" fill="#667085">${escapeXml(normalizeString(legend?.min) || "Low")}</text>
      ${gradient}
      <text x="${x + 38 + (palette.length * segmentWidth)}" y="${y + 12}" font-size="10" fill="#667085">${escapeXml(normalizeString(legend?.max) || "High")}</text>
    `,
    height: 18,
  };
}

function buildRankingSvg(ranking = [], x = 0, y = 0, width = 220) {
  const topRanking = (Array.isArray(ranking) ? ranking : []).slice(0, 5);
  if (topRanking.length === 0) {
    return { svg: "", height: 0 };
  }
  const maxValue = Math.max(...topRanking.map((entry) => normalizeNumber(entry?.rawValue) || 0), 1);
  const barX = x + 46;
  const barWidth = Math.max(40, width - 108);
  const rows = topRanking.map((region, index) => {
    const rawValue = normalizeNumber(region?.rawValue) || 0;
    const lineY = y + (index * 18);
    const fillWidth = Math.max(2, (rawValue / maxValue) * barWidth);
    return `
      <text x="${x}" y="${lineY + 11}" font-size="10" fill="#344054">${escapeXml(normalizeString(region?.key) || "-")}</text>
      <rect x="${barX}" y="${lineY + 2}" width="${barWidth}" height="8" rx="4" fill="#eaecf0" />
      <rect x="${barX}" y="${lineY + 2}" width="${fillWidth}" height="8" rx="4" fill="${escapeXml(normalizeString(region?.color) || "#2563eb")}" />
      <text x="${barX + barWidth + 6}" y="${lineY + 11}" font-size="10" fill="#667085">${escapeXml(normalizeString(region?.displayValue) || "-")}</text>
    `;
  }).join("\n");
  return {
    svg: rows,
    height: (topRanking.length * 18) + 2,
  };
}

export function buildReportPrintGeoSvg({
  resolvedGeo = null,
  width = 680,
} = {}) {
  const geo = resolvedGeo && typeof resolvedGeo === "object" && !Array.isArray(resolvedGeo)
    ? resolvedGeo
    : null;
  if (!geo) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildGeoDiagnostic("emptyReportPrintGeo", "Geo block is missing resolved geo payload for ReportPrint."),
      ].filter(Boolean),
    };
  }

  const tiles = resolveGeoTiles(geo?.shape);
  if (!tiles) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildGeoDiagnostic("unsupportedReportPrintGeoShape", `ReportPrint geo lowering does not support shape ${normalizeString(geo?.shape) || "unknown"}.`),
      ],
    };
  }

  const regions = Array.isArray(geo?.regions) ? geo.regions : [];
  if (regions.length === 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildGeoDiagnostic("emptyReportPrintGeo", "Geo block has no regions to lower into ReportPrint."),
      ].filter(Boolean),
    };
  }

  const regionByKey = new Map(
    regions.map((region) => [normalizeGeoKey(region?.key), region]).filter(([key]) => !!key),
  );
  const activeRegion = geo?.activeRegion || null;
  const activeKey = normalizeGeoKey(activeRegion?.key);
  const gridColumns = Math.max(...tiles.map((tile) => Number(tile.col) || 1), 12);
  const gridRows = Math.max(...tiles.map((tile) => Number(tile.row) || 1), 8);

  const summary = geo?.summary || {};
  const mapWidth = Math.min(360, Math.max(280, Math.floor(width * 0.52)));
  const sideWidth = Math.max(180, width - mapWidth - 24);
  const tileGap = 4;
  const tileSize = Math.floor(Math.min(
    (mapWidth - ((gridColumns - 1) * tileGap)) / gridColumns,
    22,
  ));
  const mapHeight = (gridRows * tileSize) + ((gridRows - 1) * tileGap);
  const sideX = mapWidth + 24;

  const summarySvg = `
    <text x="0" y="12" font-size="11" fill="#667085">${escapeXml(String(summary.regionCount ?? regions.length))} Regions</text>
    <text x="120" y="12" font-size="11" fill="#667085">Total ${escapeXml(normalizeString(geo?.metricLabel) || "Value")}: ${escapeXml(normalizeString(summary?.totalValue) || "-")}</text>
    <text x="${Math.max(260, width - 140)}" y="12" font-size="11" fill="#667085">Top: ${escapeXml(normalizeString(summary?.topKey) || "-")}</text>
  `;

  const tileSvg = tiles.map((tile) => {
    const region = regionByKey.get(normalizeGeoKey(tile.key)) || null;
    const col = (Number(tile.col) || 1) - 1;
    const row = (Number(tile.row) || 1) - 1;
    const x = col * (tileSize + tileGap);
    const y = 24 + (row * (tileSize + tileGap));
    const fill = normalizeString(region?.color) || "#eef3f8";
    const stroke = normalizeGeoKey(tile.key) === activeKey ? "#101828" : "#d0d5dd";
    const strokeWidth = normalizeGeoKey(tile.key) === activeKey ? 1.5 : 1;
    return `
      <rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="4" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" />
      <text x="${x + (tileSize / 2)}" y="${y + (tileSize / 2) + 4}" text-anchor="middle" font-size="${Math.max(8, tileSize * 0.38)}" fill="#ffffff">${escapeXml(tile.key)}</text>
    `;
  }).join("\n");

  const detailLabel = activeRegion
    ? `${normalizeString(activeRegion?.label) || normalizeString(activeRegion?.key)} (${normalizeString(activeRegion?.key)})`
    : "-";
  const detailValue = activeRegion ? normalizeString(activeRegion?.displayValue) || "-" : "-";
  const detailStatus = activeRegion ? normalizeString(activeRegion?.statusLabel) : "";
  const detailColor = normalizeString(activeRegion?.statusColor || activeRegion?.color) || "#2563eb";
  const detailSvg = `
    <text x="${sideX}" y="40" font-size="11" fill="#667085">Selected Area</text>
    <text x="${sideX}" y="58" font-size="14" font-weight="600" fill="#101828">${escapeXml(detailLabel)}</text>
    <text x="${sideX}" y="76" font-size="11" fill="#344054">${escapeXml(normalizeString(geo?.metricLabel) || "Value")}: ${escapeXml(detailValue)}</text>
    ${detailStatus ? `<rect x="${sideX}" y="86" width="${Math.max(44, detailStatus.length * 7)}" height="18" rx="9" fill="${escapeXml(detailColor)}" opacity="0.18" />
    <text x="${sideX + 10}" y="99" font-size="10" fill="${escapeXml(detailColor)}">${escapeXml(detailStatus)}</text>` : ""}
  `;

  const legend = buildLegendSvg(geo?.legend, sideX, detailStatus ? 120 : 102, sideWidth);
  const rankingTitleY = (detailStatus ? 120 : 102) + legend.height + 20;
  const ranking = buildRankingSvg(geo?.ranking, sideX, rankingTitleY, sideWidth);

  const svgHeight = Math.max(
    mapHeight + 28,
    rankingTitleY + ranking.height + 8,
  );

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${svgHeight}" width="${width}" height="${svgHeight}">
      ${summarySvg}
      ${tileSvg}
      ${detailSvg}
      ${legend.svg}
      <text x="${sideX}" y="${rankingTitleY - 8}" font-size="11" fill="#667085">Top Regions</text>
      ${ranking.svg}
    </svg>`,
    height: svgHeight,
    diagnostics: [],
  };
}
