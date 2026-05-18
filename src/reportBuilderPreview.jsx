import React from 'react';
import { createRoot } from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';

if (typeof window !== 'undefined') {
  if (typeof window.global === 'undefined') {
    window.global = window;
  }
  if (typeof window.process === 'undefined') {
    window.process = { env: {} };
  } else if (typeof window.process.env === 'undefined') {
    window.process.env = {};
  }
}

async function boot() {
  await import('../index.js');
  const module = await import('./demos/reportBuilder/ReportBuilderPreview.jsx');
  const ReportBuilderPreview = module.default;

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ReportBuilderPreview />
    </React.StrictMode>
  );
}

boot();
