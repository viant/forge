import React from 'react';
import {Icon as BlueprintIcon} from '@blueprintjs/core';
import {ArrowLeft, ArrowRight, ArrowUp, Bell, Gauge, LogOut, Building, Camera, Check, CloudUpload, Clock3, FileText, Flag, House, LayoutGrid, Maximize, Mic, Minimize, SlidersHorizontal, ChevronDown, ChevronRight, CircleAlert, CircleHelp, CirclePause, LoaderCircle, Link, RotateCcw, FileDown, History,
    Maximize2, Menu, MessageSquare, Minimize2, Paperclip, PanelRight, PanelRightClose,
    PanelRightOpen, Plus, RefreshCw, Search, Settings, Square, ThumbsUp, ThumbsDown, Ellipsis, Trash2, User, X, ZoomIn, ZoomOut, ArrowDown, Bot, Briefcase, Calendar, CalendarClock, ChartNoAxesCombined, ChevronLeft, ChevronUp, ChevronsLeft, ChevronsRight, ChevronsUpDown, Circle, CircleCheck, CircleX, Clipboard, Code, Columns3, Copy, Database, DollarSign, Download, EllipsisVertical, ExternalLink, Eye, EyeOff, FileSpreadsheet, Folder, FolderOpen, GitCompare, GripVertical, Info, ListFilter, FilterX, LogIn, Mail, Pause, Pencil, Play, Redo2, Rows3, Save, Send, Sparkles, Table, Target, Terminal, TriangleAlert, Undo2, Wrench, Users, Minus, Bug, ChartPie, Blend, FlaskConical, Globe, Handshake, Image, Palette, Route, Rocket, ShieldAlert, Tag, Activity, Layers, TrendingUp, Network, Gamepad2, List, CircleUserRound, Lightbulb, Brain} from 'lucide-react';
import './foundations.css';

const icons = {
    'bug': Bug,
    'chart-pie': ChartPie,
    'blend': Blend,
    'flask-conical': FlaskConical,
    'globe': Globe,
    'handshake': Handshake,
    'image': Image,
    'palette': Palette,
    'route': Route,
    'rocket': Rocket,
    'shield-alert': ShieldAlert,
    'tag': Tag,
    'activity': Activity,
    'layers': Layers,
    'trending-up': TrendingUp,
    'network': Network,
    'gamepad-2': Gamepad2,
    'list': List,
    'circle-user': CircleUserRound,
    'lightbulb': Lightbulb,
    'brain': Brain,

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
    // Explicit Lucide names and established action names share one stroke family.
    'arrow-down': ArrowDown,
    'chevron-left': ChevronLeft,
    'chevron-up': ChevronUp,
    'chevrons-left': ChevronsLeft,
    'chevrons-right': ChevronsRight,
    'chevrons-up-down': ChevronsUpDown,
    'triangle-alert': TriangleAlert,
    'info': Info,
    'clipboard': Clipboard,
    'copy': Copy,
    'chart-no-axes-combined': ChartNoAxesCombined,
    'log-in': LogIn,
    'dollar-sign': DollarSign,
    'list-filter': ListFilter,
    'database': Database,
    'eye': Eye,
    'eye-off': EyeOff,
    'undo-2': Undo2,
    'redo-2': Redo2,
    'wrench': Wrench,
    'pencil': Pencil,
    'list-filter-x': FilterX,
    'file-spreadsheet': FileSpreadsheet,
    'external-link': ExternalLink,
    'play': Play,
    'pause': Pause,
    'folder': Folder,
    'folder-open': FolderOpen,
    'save': Save,
    'ellipsis-vertical': EllipsisVertical,
    'download': Download,
    'send': Send,
    'mail': Mail,
    'calendar': Calendar,
    'calendar-clock': CalendarClock,
    'briefcase': Briefcase,
    'target': Target,
    'circle-check': CircleCheck,
    'circle-x': CircleX,
    'code': Code,
    'terminal': Terminal,
    'git-compare': GitCompare,
    'bot': Bot,
    'sparkles': Sparkles,
    'circle': Circle,
    'columns-3': Columns3,
    'rows-3': Rows3,
    'table': Table,
    'grip-vertical': GripVertical,
    'minus': Minus,
    'folder-close': Folder,
    'people': Users,
    'users': Users,
    'document': FileText,
    'application': LayoutGrid,
    'applications': LayoutGrid,
    'chat': MessageSquare,
    'comment': MessageSquare,
    'comments': MessageSquare,
    'notifications': Bell,
    'dashboard': Gauge,
    'cog': Settings,
    'cross': X,
    'small-cross': X,
    'tick': Check,
    'small-tick': Check,
    'trash': Trash2,
    'refresh': RefreshCw,
    'reset': RotateCcw,
    'undo': Undo2,
    'redo': Redo2,
    'duplicate': Copy,
    'export': Download,
    'import': CloudUpload,
    'upload': CloudUpload,
    'warning-sign': TriangleAlert,
    'error': CircleAlert,
    'info-sign': Info,
    'help': CircleHelp,
    'help-sign': CircleHelp,
    'confirm': CircleCheck,
    'disable': CircleX,
    'double-chevron-left': ChevronsLeft,
    'double-chevron-right': ChevronsRight,
    'double-caret-vertical': ChevronsUpDown,
    'caret-up': ChevronUp,
    'caret-down': ChevronDown,
    'caret-left': ChevronLeft,
    'caret-right': ChevronRight,
    'step-backward': ChevronsLeft,
    'step-forward': ChevronsRight,
    'eye-open': Eye,
    'filter': ListFilter,
    'filter-remove': FilterX,
    'chart': ChartNoAxesCombined,
    'dollar': DollarSign,
    'edit': Pencil,
    'stop': Square,
    'more': Ellipsis,
    'more-vertical': EllipsisVertical,
    'time': Clock3,

    'home': House,
    'grid-view': LayoutGrid,
    'th': Table,
    'th-list': Rows3,
    'th-derived': Columns3,
    'compressed': Minimize2,
    'changes': GitCompare,
    'clean': Sparkles,
    'build': Wrench,
    'automatic-updates': RefreshCw,
    'updated': CircleCheck,
    'cloud-download': Download,

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

// Known action names retain their meaning with Lucide geometry. Unmapped legacy
// producer names retain Blueprint compatibility until an explicit match is reviewed.
export default function Icon({name, iconSvg, label, className = ''}) {
    const accessibility = label ? {role: 'img', 'aria-label': label} : {'aria-hidden': true};
    if (!name && iconSvg !== undefined) return <DrawingIcon icon={iconSvg} accessibility={accessibility} className={className}/>;
    const key = typeof name === 'string' ? name.replace(/^lucide:/, '') : '';
    const Glyph = Object.hasOwn(icons, key) ? icons[key] : null;
    if (!Glyph) {
        if (typeof name === 'string' && name.startsWith('lucide:')) throw new Error(`Unsupported icon: ${name}`);
        return <BlueprintIcon icon={name} size={14} {...accessibility} className={className}/>;
    }
    return <Glyph {...accessibility} focusable="false" className={`forge-icon ${className}`.trim()}/>;
}
