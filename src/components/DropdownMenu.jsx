import React from 'react';
import Popover from './Popover.jsx';

/** An anchored action menu. Popover owns focus and placement; menu content owns options. */
export default function DropdownMenu(props) {
    return <Popover {...props} menu/>;
}
