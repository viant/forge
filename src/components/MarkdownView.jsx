import React from 'react';
import { renderMarkdown } from '../utils/markdown.js';

export default function MarkdownView({ value = '', className = '', style = {}, ...rest }) {
  // Render markdown as HTML inside a simple container.
  // `prose` class can be styled by consumers (e.g. Tailwind typography or custom CSS).
  return (
    <div
      className={`prose max-w-full ${className}`}
      style={style}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderMarkdown(String(value ?? '')) }}
      {...rest}
    />
  );
}

