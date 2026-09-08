import React from 'react';
import TableToolbar from '../table/basic/Toolbar.jsx';

export default function QueryToolbar({container, context}) {
  const spec = container.queryToolbar || {};
  const dataContext = spec.dataSourceRef ? context.Context?.(spec.dataSourceRef) || context : context;
  return <div data-forge-primitive="queryToolbar"><TableToolbar context={dataContext} toolbarItems={spec.items || []} density={spec.density || 'compact'} layout={spec.layout || 'responsive'}/></div>;
}
