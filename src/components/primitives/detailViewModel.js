export async function copyDetailValue(clipboard, label, value) {
  if (typeof clipboard?.writeText !== 'function') return `Could not copy ${label}`;
  try { await clipboard.writeText(String(value)); return `Copied ${label}`; }
  catch (_) { return `Could not copy ${label}`; }
}
