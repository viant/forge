import assert from "node:assert/strict";
import {
    buildReportCatalogPageItems,
    normalizeReportCatalogPageSize,
    paginateReportCatalogEntries,
} from "./reportCatalogPagination.js";

assert.equal(normalizeReportCatalogPageSize(50), 50);
assert.equal(normalizeReportCatalogPageSize(25), 20);
assert.equal(normalizeReportCatalogPageSize(24, [12, 24, 48]), 24);

const entries = Array.from({ length: 111 }, (_, index) => ({ id: index + 1 }));
const firstPage = paginateReportCatalogEntries(entries, 1, 20);
assert.deepEqual(firstPage.entries.map((entry) => entry.id), Array.from({ length: 20 }, (_, index) => index + 1));
assert.equal(firstPage.totalPages, 6);
assert.equal(firstPage.startIndex, 0);
assert.equal(firstPage.endIndex, 20);

const lastPage = paginateReportCatalogEntries(entries, 99, 20);
assert.equal(lastPage.currentPage, 6);
assert.deepEqual(lastPage.entries.map((entry) => entry.id), Array.from({ length: 11 }, (_, index) => index + 101));
assert.equal(lastPage.startIndex, 100);
assert.equal(lastPage.endIndex, 111);

assert.deepEqual(buildReportCatalogPageItems(1, 6), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(buildReportCatalogPageItems(6, 20), [1, "ellipsis-start", 4, 5, 6, 7, 8, "ellipsis-end", 20]);
assert.deepEqual(buildReportCatalogPageItems(19, 20), [1, "ellipsis-start", 15, 16, 17, 18, 19, 20]);

console.log("reportCatalogPagination ✓ page sizing, slicing, clamping, and compact navigation");
