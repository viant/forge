import React from 'react';
import {navigateNativeLink} from '../../../runtime/nativeNavigation.js';

// Return the native element so the existing cell action owner keeps its handler.
export function renderTableLink({link, context, text = link.text, showTitle = true}) {
    const windowLink = link.kind === 'window', dialogLink = link.kind === 'dialog';
    const local = windowLink || dialogLink;
    return React.createElement(local ? 'button' : 'a', {
        ...(local ? {type: 'button', style: {background:'none',border:'none',padding:0,margin:0,cursor:'pointer'}} : {href:link.href,target:link.target,rel:link.rel}),
        className: 'forge-table-link',
        title: showTitle ? link.title || text || link.text : undefined,
        onClick: event => {
            event.preventDefault();event.stopPropagation();
            if (windowLink) return context?.handlers?.window?.openTarget?.({target:link,context});
            if (dialogLink) return context?.handlers?.window?.openDialog?.({context,execution:{args:[link.dialogId,{awaitResult:link.awaitResult}]},parameters:link.parameters});
            return navigateNativeLink(link);
        },
    }, text);
}
