import assert from 'node:assert/strict';
import { derivePreviousTextFromUnifiedDiff } from './unifiedDiff.js';

const current = 'coder changes feed dedupe smoke test\ncreated through system patch\ndedupe verification\n';
const diff = `--- before
+++ after
@@ -1,3 +1,4 @@
-coder changes feed smoke test
+coder changes feed dedupe smoke test
 created through system patch
+dedupe verification
 `;

assert.equal(
    derivePreviousTextFromUnifiedDiff(current, diff),
    'coder changes feed smoke test\ncreated through system patch\n\n'
);
assert.equal(derivePreviousTextFromUnifiedDiff('new\n', '@@ -0,0 +1 @@\n+new'), '');
console.log('unifiedDiff ✓ reconstructs previous content');
