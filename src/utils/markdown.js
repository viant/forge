// Minimal, safe-ish Markdown → HTML renderer used by chat and widgets
// Escapes HTML before applying basic Markdown patterns.

export function renderMarkdown(md = '') {
  // Escape HTML to avoid XSS vectors
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks ```code```
  const withCodeBlocks = escaped.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre><code>${p1}</code></pre>`;
  });

  // Inline code `code`
  const withInlineCode = withCodeBlocks.replace(/`([^`]+?)`/g, '<code>$1</code>');

  // Bold **text**
  const withBold = withInlineCode.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  const withItalic = withBold.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Strikethrough ~~text~~
  const withStrike = withItalic.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Links [text](url)
  const withLinks = withStrike.replace(
    /\[([^\]]+)\]\(([^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Line breaks → <br/>
  return withLinks.replace(/\n/g, '<br/>');
}

