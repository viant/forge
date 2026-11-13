import React, {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {Menu as BlueprintMenu, Popover as BlueprintPopover} from '@blueprintjs/core';
import {anchoredPopoverProps, menuTriggerMinWidthModifier} from './anchoredPopoverProps.js';
import {useForgeTheme} from './ThemeBoundary.jsx';
import './popover.css';

// Blueprint handles focus, dismissal and scroll; refresh placement when the viewport changes.
export default forwardRef(function Popover(props, ref) {
    const theme = useForgeTheme();
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
    const {menu, ...popoverProps} = props;
    const isDesignSystemMenu = theme?.themeId === 'design-system-2' && (menu || props.content?.type === BlueprintMenu);
    const resolvedProps = isDesignSystemMenu ? {
        ...popoverProps,
        minimal: true,
        popoverClassName: [popoverProps.popoverClassName, 'forge-dropdown-menu'].filter(Boolean).join(' '),
        modifiersCustom: [...(popoverProps.modifiersCustom || []), menuTriggerMinWidthModifier],
    } : popoverProps;
    return <BlueprintPopover {...anchoredPopoverProps(resolvedProps)} ref={popoverRef}/>;
});
