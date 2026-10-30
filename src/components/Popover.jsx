import React, {forwardRef} from 'react';
import {Popover as BlueprintPopover} from '@blueprintjs/core';
import {anchoredPopoverProps} from './anchoredPopoverProps.js';
import './popover.css';

// Keep the existing focus, dismissal, resize and scroll behavior in Blueprint.
export default forwardRef(function Popover(props, ref) {
    return <BlueprintPopover {...anchoredPopoverProps(props)} ref={ref}/>;
});
