import React from 'react';
import {Button} from '@blueprintjs/core';
import MutationCommand from '../../primitives/MutationCommand.jsx';
import {isolateButtonCellProps} from './buttonCellEvents.js';

export default function TableCellMutation({context, command, extras, buttonProps}) {
    return <MutationCommand context={context} command={command} extras={extras} disabled={buttonProps.disabled === true || buttonProps.readOnly === true}
        renderTrigger={({invoke, disabled, pending}) => <Button {...isolateButtonCellProps({...buttonProps, onClick: invoke})}
            aria-label={buttonProps['aria-label'] || command.label} disabled={disabled} loading={pending}/>}/>;
}
