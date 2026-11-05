import React, {useCallback, useMemo} from 'react';
import ReportFilterBar from './ReportFilterBar.jsx';
import {normalizeReportDatePresets} from '../../reporting/reportDatePresets.js';
import {useReportDatePresetDraft} from '../../reporting/useReportDatePresetDraft.js';
import {commitBoundReportScopeValues} from './reportRuntimeScopeControls.js';

// This window host only translates authored scope bindings. Calendar resolution,
// request cancellation and control behavior stay with the shared report draft.
export default function BoundReportDatePresetControls({config, context, reportSpec, busy}) {
    const params = reportSpec.scope?.params || [];
    const authored = config.reportSpec.scope.params;
    const ranges = useMemo(() => authored.filter(param => param.datePresets).map(param => {
        const range = {id:param.id, label:param.label, required:param.required, start:`${param.id}.start`, end:`${param.id}.end`};
        try {
            const datePresets = normalizeReportDatePresets(param.datePresets, context.metadata?.dataSource || {});
            if ((datePresets.calendar.inputs || []).some(binding => binding.parameter === param.id)) throw Error('Calendar inputs cannot bind to their own date outputs.');
            const selected = authored.find(other => other.id === datePresets.valueParameter);
            const compatible = selected?.filterBindings?.length && !selected.multiple && (selected.kind === 'text' || selected.options?.length && datePresets.options.every(option => selected.options.some(choice => choice.value === option.value)));
            if (!param.filterBindings?.length || param.kind !== 'dateRange' || datePresets.valueParameter && (!compatible || selected.datePresets)) throw Error('Date-preset selection requires a compatible bound scope parameter.');
            return {...range, datePresets};
        } catch (error) { return {...range, datePresetError:error.message}; }
    }), [authored, context.metadata]);
    const flatten = entries => Object.fromEntries(entries.flatMap(param => [
        [param.id, param.value],
        ...(param.datePresets ? ['start','end'].filter(edge => Object.hasOwn(param.value || {}, edge))
            .map(edge => [`${param.id}.${edge}`, param.value[edge]]) : []),
    ]));
    const parameters = flatten(params);
    const loadCalendar = useCallback((id, inputs, signal) => {
        const loader = context.Context(id)?.handlers?.dataSource?.fetchRecords;
        if (!loader) throw Error('Calendar datasource is unavailable.');
        return loader({parameters:inputs, signal});
    }, [context]);
    const dates = useReportDatePresetDraft({ranges, parameters, resetParameters:flatten(authored),
        contextKey:JSON.stringify([context.identity?.windowId,context.authorization]), loadCalendar,
        onDefaultsReady:() => false});
    const apply = () => {
        if (dates.dateBlocked || ranges.some(range => range.datePresetError) || busy) return;
        const values = {};
        for (const range of ranges) {
            values[range.id] = {start:dates.draft[range.start] ?? '', end:dates.draft[range.end] ?? ''};
            if (range.datePresets?.valueParameter) values[range.datePresets.valueParameter] = dates.draft[range.datePresets.valueParameter];
        }
        dates.expectParameters({...parameters,...dates.draft,...values});
        commitBoundReportScopeValues(config, context, values);
    };
    return <ReportFilterBar controls={dates.controls} values={dates.draft} context={context}
        onChange={(id,value) => {dates.editField(id); dates.writeDraft({...dates.draftRef.current,[id]:value});}}
        onDatePreset={dates.requestPreset} onDateRange={dates.manualRange} onDateDraft={dates.cancelDraftRequests}
        onApply={apply} onReset={dates.reset} busy={busy} applyDisabled={dates.dateBlocked || ranges.some(range => range.datePresetError)}/>;
}
