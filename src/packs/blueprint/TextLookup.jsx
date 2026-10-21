import NativeControlTarget from '../../runtime/NativeControlTarget.jsx';
import React from 'react';
import { InputGroup, Button } from '@blueprintjs/core';
import { applyLookupSelection, openLookup, resolveLookupValue } from '../../utils/lookup.js';
import { createLookupOpenHandler } from './TextLookupHandlers.js';

export default function TextLookup(props) {
    const { value = '', readOnly, context, item, adapter, ...rest } = props;

    const latest = React.useRef(null);
    latest.current = { item, context, adapter, value };

    const handleOpen = React.useMemo(() => createLookupOpenHandler(latest, openLookup), []);

    const requestTrigger = item?.lookup?.requestTrigger === 'change' ? 'change' : 'blur';
    const requestVersion = React.useRef(0);
    React.useEffect(() => () => { ++requestVersion.current; }, []);
    const resolve = async (raw,strict=false) => {
        const version = ++requestVersion.current;
        if (readOnly) return;
        if (!item?.lookup?.dataSource || !item?.lookup?.resolveInput) return;
        if (raw == null || String(raw).trim() === '') return;
        try {
            const resolved = await resolveLookupValue({ item, value: raw });
            if (!resolved || version !== requestVersion.current) return;
            await applyLookupSelection({
                item,
                context,
                adapter,
                outputs: item?.lookup?.outputs || [],
                record: resolved,
                strict,
            });
        } catch (e) {
            if(strict)throw e;
            console.error('lookup resolve failed', e);
        }
    };

    const edit=(raw,strict=false)=>{
        if(readOnly || rest.disabled)return false;
        const next=raw?.target?.value ?? raw;++requestVersion.current;
        if(strict)adapter.set(next);else try{adapter.set(next);}catch(_){}
        if(requestTrigger==='change')return resolve(next,strict);
    };
    const intent = item?.lookup?.intent || item?.intent || rest?.intent;
    const rightElement = React.useMemo(() => (
        <Button icon="search" minimal onClick={handleOpen} aria-label="Open lookup" disabled={readOnly || rest.disabled} data-forge-part="button" />
    ), [handleOpen, readOnly, rest.disabled]);

    return (
        <NativeControlTarget context={context} item={item} readOnly={readOnly===true} disabled={rest.disabled===true} value={value}
            validate={next=>typeof next==='string'?null:'lookup input must be a string'} actions={{click:()=>handleOpen.operate(),setValue:({value})=>edit(value,true)}}><InputGroup
            {...rest}
            intent={intent}
            className={[rest.className, 'forge-text-lookup'].filter(Boolean).join(' ')}
            value={value ?? ''}
            readOnly={readOnly}
            onChange={edit}
            onBlur={event => {
                rest?.onBlur?.(event);
                if (requestTrigger === 'blur') void resolve(event.target.value);
            }}
            rightElement={rightElement}
        /></NativeControlTarget>
    );
}
