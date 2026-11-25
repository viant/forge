import React from 'react';
import {Button} from '@blueprintjs/core';
import MutationCommand from '../../primitives/MutationCommand.jsx';
import {isolateButtonCellProps} from './buttonCellEvents.js';
import UnifiedIcon from '../../Icon.jsx';
import {useForgeTheme} from '../../ThemeBoundary.jsx';

export default function TableCellMutation({context, command, extras, buttonProps}) {
    const isDesignSystem2 = useForgeTheme()?.themeId === 'design-system-2';
    const props = isDesignSystem2 ? {...buttonProps,
        icon: typeof buttonProps.icon === 'string' ? <UnifiedIcon name={buttonProps.icon}/> : buttonProps.icon,
        rightIcon: typeof buttonProps.rightIcon === 'string' ? <UnifiedIcon name={buttonProps.rightIcon}/> : buttonProps.rightIcon,
    } : buttonProps;
    return <MutationCommand context={context} command={command} extras={extras} disabled={buttonProps.disabled === true || buttonProps.readOnly === true}
        renderTrigger={({invoke, disabled, pending}) => <Button {...isolateButtonCellProps({...props, onClick: invoke})}
            aria-label={buttonProps['aria-label'] || command.label} disabled={disabled} loading={pending}/>}/>;
}
