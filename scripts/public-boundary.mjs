// Public-tree guardrails; this is not a claim that historical commits were clean.
import path from 'node:path';

const forbiddenOutput = /(?:^|\/)(?:captures?|screenshots?|recordings?)(?:\/|\.)|\.(?:har|pcap|log|test|csv|jsonl)$/i;
const privatePath = /(?:\/Users\/[^\s/'"]+\/|\/home\/[^\s/'"]+\/|[A-Za-z]:\\Users\\|(?:^|\/)\w+-internal\/)/;
const liveCaptureRead = /Data\(contentsOf:\s*URL\(string:\s*"https?:\/\//;

export function publicBoundaryIssues(name, text, root = process.cwd()) {
  const issues = [];
  if (forbiddenOutput.test(name)) issues.push('raw output/capture artifact');
  if (/(?:^|[-_/.])(?:captured|executed|screenshot|recorded)(?=[-_/.]|$).*\.(?:json|png|jpg|jpeg|webp)$/i.test(name) && name !== 'backend/reporting/fill/testdata/synthetic-metadata-executed.json') issues.push('unproven retained execution/capture output');
  if (privatePath.test(text)) issues.push('private checkout/workstation path');
  if (liveCaptureRead.test(text)) issues.push('hardcoded live application fixture fetch');
  for (const match of text.matchAll(/new URL\(\s*['"](\.\.?\/[^'"]+)['"]/g)) {
    const resolved = path.resolve(root, path.dirname(name), match[1]);
    if (path.relative(root, resolved).startsWith('..' + path.sep)) issues.push('fixture/source dependency outside public checkout');
  }
  return [...new Set(issues)];
}

export function outgoingMessageIssues(message) {
  const issues = [];
  if (privatePath.test(message)) issues.push('private path in outgoing commit message');
  if (/https?:\/\/(?:[^\s/]+\.)?(?:internal|private)(?:[/:\s]|$)/i.test(message)) issues.push('private endpoint in outgoing commit message');
  if (/(?:^|\s)(?:capture|output)\/[^\s]+\.(?:json|har|csv|png)\b/i.test(message)) issues.push('raw output reference in outgoing commit message');
  return issues;
}
