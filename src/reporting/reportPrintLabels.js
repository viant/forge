// Collapse consecutive repeated touchpoints without losing order or multiplicity.
// The source ReportFill remains unchanged.
export function compactReportPrintSequence(value = "") {
  const text = String(value ?? "").replace(/\s*(?:→|â†’|->)\s*/g, " -> ");
  const members = text.split(" -> ");
  if (members.length < 3) return text;
  const runs = [];
  for (const member of members) {
    const last = runs[runs.length - 1];
    if (last?.member === member) last.count += 1;
    else runs.push({ member, count: 1 });
  }
  if (runs.length === members.length) return text;
  return `${runs.map(({ member, count }) => count > 1 ? `${member} [x${count}]` : member).join(" -> ")} (${members.length} touchpoints)`;
}

export function wrapReportPrintLabel(value, maxCharacters) {
  const lines = [];
  let remaining = String(value ?? "").trim();
  while (remaining.length > maxCharacters) {
    let split = remaining.lastIndexOf(" ", maxCharacters);
    if (split < maxCharacters / 2) split = maxCharacters;
    lines.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) lines.push(remaining);
  return lines;
}
