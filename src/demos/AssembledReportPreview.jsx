import '../packs/blueprint/theme.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../../agently-core/protocol/ui/theme/testdata/baseline.css';
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReportRuntime from '../components/dashboard/ReportRuntime.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../components/ThemeBoundary.jsx';

// This exact synthetic artifact was assembled and filled from native Datly
// execution. Preview does not substitute rows or implement producer behavior.
const raw = await fetch('/doc/examples/assembled-table-runtime-preview.json').then(response => {
  if (!response.ok) throw new Error('Native assembly fixture unavailable');
  return response.text();
});
const fixture = JSON.parse(raw);
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
window.__assemblyFixture = fixture;
window.__assemblyEvidence = {sha256: hash, requestsBefore: JSON.stringify(fixture.reportSpec.datasets), hostPageCalls: 0};
function Preview() {
  const [calls, setCalls] = useState(0);
  return <ForgeThemeProvider themeId="baseline"><ForgeThemeBoundary windowKey="assembly-native-evidence" presentation="document">
    <div style={{padding: 16}}><div>Native synthetic assembly fixture · <code data-testid="assembly-fixture-hash">{hash}</code></div>
      <div>Backend page requests: <output data-testid="assembly-page-calls">{calls}</output></div>
      <ReportRuntime reportSpec={fixture.reportSpec} reportFill={fixture.reportFill} onDatasetPageChange={() => {
        window.__assemblyEvidence.hostPageCalls += 1; setCalls(value => value + 1);
      }}/>
    </div>
  </ForgeThemeBoundary></ForgeThemeProvider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
