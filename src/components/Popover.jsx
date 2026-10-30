import React, {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {Popover as BlueprintPopover} from '@blueprintjs/core';
import {anchoredPopoverProps} from './anchoredPopoverProps.js';
import './popover.css';

// Blueprint handles focus, dismissal and scroll; refresh placement when the viewport changes.
export default forwardRef(function Popover(props, ref) {
    const popoverRef = useRef(null);
    useImperativeHandle(ref, () => popoverRef.current);
    useEffect(() => {
        const reposition = () => popoverRef.current?.reposition();
        window.addEventListener('resize', reposition);
        window.visualViewport?.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('resize', reposition);
            window.visualViewport?.removeEventListener('resize', reposition);
        };
    }, []);
    return <BlueprintPopover {...anchoredPopoverProps(props)} ref={popoverRef}/>;
});
