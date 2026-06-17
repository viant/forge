function normalizeString(value = "") {
  return String(value || "").trim();
}

function resolvePreviewInventorySiteType(row = {}) {
  const channel = normalizeString(row?.channelV2);
  const ageGroup = normalizeString(row?.agegroupId);
  if (channel === "CTV") {
    return ageGroup === "18-24" ? "FAST" : "Premium Streaming";
  }
  if (channel === "Display") {
    return ageGroup === "18-24" ? "Open Web" : "Private Marketplace";
  }
  return "";
}

export const BASE_ROWS = [
  { eventDate: "2026-05-01", channelV2: "Display", agegroupId: "18-24", country: "US", avails: 18000, hhUniqs: 7400 },
  { eventDate: "2026-05-01", channelV2: "Display", agegroupId: "25-34", country: "US", avails: 22400, hhUniqs: 9100 },
  { eventDate: "2026-05-01", channelV2: "CTV", agegroupId: "18-24", country: "US", avails: 14200, hhUniqs: 6100 },
  { eventDate: "2026-05-01", channelV2: "CTV", agegroupId: "25-34", country: "US", avails: 20100, hhUniqs: 8600 },
  { eventDate: "2026-05-02", channelV2: "Display", agegroupId: "18-24", country: "US", avails: 19100, hhUniqs: 7800 },
  { eventDate: "2026-05-02", channelV2: "Display", agegroupId: "25-34", country: "US", avails: 23300, hhUniqs: 9500 },
  { eventDate: "2026-05-02", channelV2: "CTV", agegroupId: "18-24", country: "US", avails: 15100, hhUniqs: 6400 },
  { eventDate: "2026-05-02", channelV2: "CTV", agegroupId: "25-34", country: "US", avails: 20900, hhUniqs: 8900 },
  { eventDate: "2026-05-03", channelV2: "Display", agegroupId: "18-24", country: "CA", avails: 16200, hhUniqs: 6800 },
  { eventDate: "2026-05-03", channelV2: "Display", agegroupId: "25-34", country: "CA", avails: 20400, hhUniqs: 8400 },
  { eventDate: "2026-05-03", channelV2: "CTV", agegroupId: "18-24", country: "CA", avails: 13700, hhUniqs: 5700 },
  { eventDate: "2026-05-03", channelV2: "CTV", agegroupId: "25-34", country: "CA", avails: 19400, hhUniqs: 8100 },
  { eventDate: "2026-05-04", channelV2: "Display", agegroupId: "18-24", country: "CA", avails: 17500, hhUniqs: 7100 },
  { eventDate: "2026-05-04", channelV2: "Display", agegroupId: "25-34", country: "CA", avails: 21500, hhUniqs: 8800 },
  { eventDate: "2026-05-04", channelV2: "CTV", agegroupId: "18-24", country: "CA", avails: 14500, hhUniqs: 6000 },
  { eventDate: "2026-05-04", channelV2: "CTV", agegroupId: "25-34", country: "CA", avails: 20300, hhUniqs: 8500 },
];

export function buildPreviewRawRows(baseRows = BASE_ROWS) {
  return (Array.isArray(baseRows) ? baseRows : []).map((row, index) => ({
    ...row,
    siteType: resolvePreviewInventorySiteType(row),
    publisher: row.country === "US" ? "Acme Media" : "North Star Media",
    metrocode: row.country === "US"
      ? (row.channelV2 === "CTV" ? "Los Angeles DMA" : (row.agegroupId === "18-24" ? "New York DMA" : "Chicago DMA"))
      : (row.channelV2 === "CTV" ? "Toronto GTA" : (row.agegroupId === "18-24" ? "Montreal Metro" : "Vancouver Metro")),
    city: row.country === "US"
      ? (row.channelV2 === "CTV" ? "Los Angeles" : (row.agegroupId === "18-24" ? "New York" : "Chicago"))
      : (row.channelV2 === "CTV" ? "Toronto" : (row.agegroupId === "18-24" ? "Montreal" : "Vancouver")),
    advertiser: row.country === "US" ? "Northwind Health" : "Maple Retail",
    campaign: row.agegroupId === "18-24" ? "Prospect Sprint" : "Family Reach",
    adOrder: row.channelV2 === "CTV" ? "Connected TV Burst" : "Display Always-On",
    audience: row.agegroupId === "18-24" ? "Young Adults" : "Established Adults",
    deal: row.channelV2 === "CTV" ? "Premium OTT Deal" : "Open Exchange",
    deviceType: index % 2 === 0 ? "Mobile" : "CTV",
    region: row.country === "US"
      ? (row.agegroupId === "18-24" ? "West" : (row.channelV2 === "CTV" ? "Northeast" : "Midwest"))
      : (row.agegroupId === "18-24" ? "Ontario" : (row.channelV2 === "CTV" ? "British Columbia" : "Quebec")),
    channelsFilter: row.channelV2,
    scopeFilter: row.country === "US" ? "national" : "regional",
    inventoryFilter: row.channelV2 === "CTV" ? "premium" : "open",
    targetingFilter: row.country === "US" ? "audience" : "geo",
    publisherFilter: row.country === "US" ? "Acme Media" : "North Star Media",
    advertiserFilter: row.country === "US" ? "Northwind Health" : "Maple Retail",
    campaignFilter: row.agegroupId === "18-24" ? "Prospect Sprint" : "Family Reach",
    deviceFilter: index % 2 === 0 ? "Mobile" : "CTV",
  }));
}

export const RAW_ROWS = buildPreviewRawRows();
