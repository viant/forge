// Read the mounted renderer so paging, collapsed panels, chart selection and
// formatted null values match what the user can inspect in this window.
const blockSelector = '[data-report-runtime-block-id]';
const reportSelector = '[data-forge-report-active-section]';

function displayed(element) {
  if (!element?.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  if (element.checkVisibility) return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  return element.getClientRects().length > 0 && element.ownerDocument.defaultView.getComputedStyle(element).visibility === 'visible';
}

export function readVisibleReport(root) {
  if (!displayed(root)) return undefined;
  const result = { sectionId: root.getAttribute('data-forge-report-active-section'), blocks: [] };
  const filter = root.ownerDocument.defaultView.NodeFilter;
  let remaining = 16000;
  for (const element of root.querySelectorAll(blockSelector)) {
    if (!displayed(element) || element.closest(reportSelector) !== root) continue;
    if (remaining <= 0 || result.blocks.length === 64) {
      result.truncated = true;
      break;
    }
    const block = { id: element.getAttribute('data-report-runtime-block-id'), text: '' };
    const limit = Math.min(remaining, 3200);
    const append = value => {
      const text = String(value || '').trim();
      if (!text) return;
      const next = (block.text ? '\n' : '') + text;
      if (next.length > limit - block.text.length) block.truncated = true;
      block.text += next.slice(0, limit - block.text.length);
    };
    const walker = element.ownerDocument.createTreeWalker(element, filter.SHOW_ELEMENT | filter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === 3) return filter.FILTER_ACCEPT;
        if (node.matches(blockSelector + ', ' + reportSelector + ', script, style, option, title, desc') || !displayed(node)) return filter.FILTER_REJECT;
        return filter.FILTER_ACCEPT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 3) append(node.nodeValue);
      else if (node.localName === 'select') append(node.selectedOptions[0]?.label);
      else if (node.namespaceURI === 'http://www.w3.org/2000/svg') append(node.getAttribute('aria-label'));
      if (block.truncated) break;
    }
    if (block.text) {
      result.blocks.push(block);
      remaining -= block.text.length;
      if (block.truncated) result.truncated = true;
    }
  }
  return result;
}
