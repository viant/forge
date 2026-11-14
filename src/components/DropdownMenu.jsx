import React from 'react';
import {Button as BlueprintButton} from '@blueprintjs/core';
import Popover from './Popover.jsx';
import Button from './Button.jsx';

/** An anchored action menu. Popover owns focus and placement; menu content owns options. */
export default function DropdownMenu(props) {
    const buttonTarget = [Button, BlueprintButton, 'button'].includes(props.children?.type);
    return <Popover {...props}
        targetProps={buttonTarget ? {onKeyDown:undefined,...props.targetProps} : props.targetProps} menu/>;
}
