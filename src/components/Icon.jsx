import React from 'react';
import {Icon as BlueprintIcon} from '@blueprintjs/core';
import {ArrowLeft, ArrowRight, ArrowUp, Bell, Gauge, LogOut, Building, Camera, Check, CloudUpload, Clock3, FileText, Flag, House, LayoutGrid, Maximize, Mic, Minimize, SlidersHorizontal, ChevronDown, ChevronRight, CircleAlert, CircleHelp, CirclePause, LoaderCircle, Link, RotateCcw, FileDown, History,
    Maximize2, Menu, MessageSquare, Minimize2, Paperclip, PanelRight, PanelRightClose,
    PanelRightOpen, Plus, RefreshCw, Search, Settings, Square, ThumbsUp, ThumbsDown, Ellipsis, Trash2, User, X, ZoomIn, ZoomOut} from 'lucide-react';
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
    'cloud-upload': CloudUpload, plus: Plus, 'refresh-cw': RefreshCw, search: Search, settings: Settings,
    square: Square, 'trash-2': Trash2, user: User, x: X, bell: Bell, gauge: Gauge, 'log-out': LogOut,
    'zoom-in': ZoomIn, 'zoom-out': ZoomOut,
    'circle-help': CircleHelp, 'circle-pause': CirclePause, 'loader-circle': LoaderCircle, link: Link, 'rotate-ccw': RotateCcw,
    'thumbs-up': ThumbsUp, 'thumbs-down': ThumbsDown, ellipsis: Ellipsis,
};
export const iconNames = Object.freeze(Object.keys(icons).map(name => `lucide:${name}`));

// Portable drawing metadata only: never forward markup, URLs or arbitrary SVG attributes.
function DrawingIcon({icon, accessibility, className}) {
    if (!icon || typeof icon !== 'object' || Array.isArray(icon)) return null;
    const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 4096;
    if (!Array.isArray(icon.viewBox) || icon.viewBox.length !== 4 || !icon.viewBox.every(finite)
        || icon.viewBox[2] <= 0 || icon.viewBox[3] <= 0) return null;
    const paths = icon.paths || [], rects = icon.rects || [];
    if (!Array.isArray(paths) || !Array.isArray(rects) || paths.length + rects.length === 0
        || paths.length + rects.length > 32) return null;
    if (paths.some(d => typeof d !== 'string' || !d || d.length > 8192 || !/^[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\s-]+$/.test(d))) return null;
    if (rects.some(rect => !rect || typeof rect !== 'object' || Array.isArray(rect)
        || !['x', 'y', 'width', 'height'].every(key => finite(rect[key]))
        || rect.width <= 0 || rect.height <= 0 || (rect.rx !== undefined && (!finite(rect.rx) || rect.rx < 0)))) return null;
    if ((icon.fill !== undefined && !['none', 'currentColor'].includes(icon.fill))
        || (icon.stroke !== undefined && !['none', 'currentColor'].includes(icon.stroke))) return null;
    return <svg {...accessibility} focusable="false" className={`forge-icon ${className}`.trim()}
        viewBox={icon.viewBox.join(' ')} fill={icon.fill ?? 'none'} stroke={icon.stroke ?? 'currentColor'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, index) => <path key={`p${index}`} d={d}/>)}
        {rects.map((rect, index) => <rect key={`r${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={rect.rx}/>)}
    </svg>;
}

// Explicit names opt into Lucide. Existing Blueprint names keep their meaning.
export default function Icon({name, iconSvg, label, className = ''}) {
    const accessibility = label ? {role: 'img', 'aria-label': label} : {'aria-hidden': true};
    if (!name && iconSvg !== undefined) return <DrawingIcon icon={iconSvg} accessibility={accessibility} className={className}/>;
    if (typeof name !== 'string' || !name.startsWith('lucide:')) {
        return <BlueprintIcon icon={name} size={14} {...accessibility} className={className}/>;
    }
    const Glyph = icons[name.slice(7)];
    if (!Glyph) throw new Error(`Unsupported icon: ${name}`);
    return <Glyph {...accessibility} focusable="false" className={`forge-icon ${className}`.trim()}/>;
}
