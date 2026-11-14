import React from 'react';
import {Button as BlueprintButton} from '@blueprintjs/core';
import Popover from './Popover.jsx';
import Button from './Button.jsx';
import {useForgeTheme} from './ThemeBoundary.jsx';

/** An anchored action menu. Popover owns focus and placement; menu content owns options. */
export default function DropdownMenu(props) {
    const themed = useForgeTheme()?.themeId === 'design-system-2';
    const buttonTarget = [Button, BlueprintButton, 'button'].includes(props.children?.type);
    return <Popover {...props}
        targetProps={themed && buttonTarget ? {onKeyDown:undefined,...props.targetProps} : props.targetProps} menu/>;
}
