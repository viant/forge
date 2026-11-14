import React from 'react';
import {Button, MenuItem} from '@blueprintjs/core';
import {Select} from '@blueprintjs/select';
import Icon from '../../components/Icon.jsx';
import {typographyProps} from '../../components/Typography.jsx';
import {anchoredPopoverProps} from '../../components/anchoredPopoverProps.js';

// The date picker owns the available options and navigation bounds.
// Its supported Dropdown slot reuses the same listbox and menu recipe as selectors.
export default function CalendarDropdown({caption, children, name, value, onChange, 'aria-label': ariaLabel}) {
    const items = React.Children.toArray(children).map(option => ({
        value: option.props.value,
        label: option.props.children,
        disabled: option.props.disabled,
    }));
    return <Select items={items} itemsEqual="value" filterable={false} initialActiveItem={items.find(item => String(item.value) === String(value))}
        itemDisabled="disabled" menuProps={{'aria-label': ariaLabel, className: 'forge-calendar-dropdown-menu'}}
        popoverProps={anchoredPopoverProps({minimal: true, captureDismiss:true, matchTargetWidth: true, popoverClassName: 'forge-dropdown-menu'})}
        itemRenderer={(item, {handleClick, handleFocus, id, modifiers, ref}) => <MenuItem key={item.value}
            ref={ref} id={id} text={item.label} active={modifiers.active} disabled={item.disabled}
            roleStructure="listoption" selected={String(item.value) === String(value)}
            onClick={handleClick} onFocus={handleFocus}/>}
        onItemSelect={item => onChange?.({target:{value:String(item.value)}})}>
        <Button minimal className={`forge-button forge-calendar-dropdown forge-calendar-dropdown--${name}`}
            data-forge-variant="ghost" data-forge-size="default" {...typographyProps('label')}
            aria-label={ariaLabel} alignText="left" text={caption} rightIcon={<Icon name="lucide:chevron-down"/>}/>
    </Select>;
}
