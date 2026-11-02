import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import ReportRuntime from './ReportRuntime.jsx';

// Exercise the runtime boundary using the Chart's existing normalized selection contract.
vi.mock('../Chart.jsx', () => ({default: ({onDatumSelect, context}) => <button
  onClick={() => onDatumSelect?.({row:{category:'Alpha'},selectionRows:context.signals.collection.value})}>Select mark</button>}));

it('opens only the declared safe source row URL on an explicit mark selection', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const spec = {version:1,kind:'reportSpec',title:'Synthetic records',source:{kind:'test',containerId:'records',stateKey:'records',dataSourceRef:'records'},parameters:{viewMode:'table',pageSize:25},layoutIntent:{kind:'stack',blockOrder:['chart']},refinements:[],calculatedFields:[],datasets:[{id:'records',dataSourceRef:'records',request:{}}],blocks:[{id:'chart',kind:'chartBlock',datasetRef:'records',chartSpec:{type:'bar',xField:'category',yFields:['amount']},runtime:{actions:[{kind:'select',dimension:'category'},{kind:'external',urlField:'detailUrl'}]}}]};
  try {
    const rows = [{category:'Alpha',amount:4,detailUrl:'https://example.invalid/records/17'}];
    await act(async () => root.render(<ReportRuntime reportSpec={spec} reportFill={{datasets:[{id:'records',rows}],blocks:[{...spec.blocks[0],content:{chartSpec:spec.blocks[0].chartSpec,chartModel:{type:'bar',xAxis:{dataKey:'category'},series:{values:[{value:'amount'}]}}}}]}}/>));
    expect(open).not.toHaveBeenCalled();
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Select mark').click());
    expect(open).toHaveBeenCalledWith('https://example.invalid/records/17','_blank','noopener,noreferrer');
  } finally {await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks();}
});
