import React from 'react';
import {Icon as BlueprintIcon} from '@blueprintjs/core';
import {ArrowLeft, ArrowRight, ArrowUp, Building, Camera, Check, Clock3, FileText, Flag, House, LayoutGrid, Maximize, Mic, Minimize, SlidersHorizontal, ChevronDown, ChevronRight, CircleAlert, FileDown, History,
    Maximize2, Menu, MessageSquare, Minimize2, Paperclip, PanelRight, PanelRightClose,
    PanelRightOpen, Plus, RefreshCw, Search, Settings, Square, User, X} from 'lucide-react';
import './foundations.css';

const icons = {
    'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, building: Building, camera: Camera,
    'clock-3': Clock3, 'file-text': FileText, flag: Flag, house: House, 'layout-grid': LayoutGrid,
    maximize: Maximize, mic: Mic, minimize: Minimize, 'sliders-horizontal': SlidersHorizontal,
    'arrow-up': ArrowUp, check: Check, 'chevron-down': ChevronDown,
    'chevron-right': ChevronRight, 'circle-alert': CircleAlert, 'file-down': FileDown,
    history: History, 'maximize-2': Maximize2, menu: Menu, 'message-square': MessageSquare,
    'minimize-2': Minimize2, paperclip: Paperclip, 'panel-right': PanelRight,
    'panel-right-close': PanelRightClose, 'panel-right-open': PanelRightOpen,
    plus: Plus, 'refresh-cw': RefreshCw, search: Search, settings: Settings,
    square: Square, user: User, x: X,
};
export const iconNames = Object.freeze(Object.keys(icons).map(name => `lucide:${name}`));

// Explicit names opt into Lucide. Existing Blueprint names keep their meaning.
export default function Icon({name, label, className = ''}) {
    const accessibility = label ? {role: 'img', 'aria-label': label} : {'aria-hidden': true};
    if (typeof name !== 'string' || !name.startsWith('lucide:')) {
        return <BlueprintIcon icon={name} size={14} {...accessibility} className={className}/>;
    }
    const Glyph = icons[name.slice(7)];
    if (!Glyph) throw new Error(`Unsupported icon: ${name}`);
    return <Glyph {...accessibility} focusable="false" className={`forge-icon ${className}`.trim()}/>;
}
