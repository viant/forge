# Engine test inputs

`authored_report.json` is generated independently from constants by
`scripts/generate-synthetic-engine-fixture.mjs`. It contains six example MCP
source descriptors and eight complete dependency fingerprints, with generic
requests, a row calculation, a selected table and metric blocks. No private
application definition, execution output, customer record or network capture
is used. Run the generator with `--check` to verify it without writing.
