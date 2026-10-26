# Synthetic report fixtures

Every report in this directory is authored from constants by
`scripts/generate-synthetic-report-fixtures.mjs`. No application exports,
customer records, private source checkout, or network capture is used.
The ten cases exercise tables, line/bar charts and KPI blocks, multiple measures,
formatting, filters, empty/null data, and large numeric values. The sibling
`synthetic_materialization` directory contains deterministic example rows and
Node reference hashes checked independently by the Goja regression suite.
