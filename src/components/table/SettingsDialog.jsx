import UnifiedIcon from '../Icon.jsx';
import React, { useState, useEffect } from "react";
import './SettingsDialog.css';
import TableViewPresets from './TableViewPresets.jsx';
import Typography from '../Typography.jsx';
import {useForgeTheme} from '../ThemeBoundary.jsx';
import {
    Button,
    Checkbox,
    Classes,
    Dialog,
    Drawer,
    DialogBody,
    DialogFooter,
    Menu,
    MenuItem,
    Tabs,
    Tab,
    NumericInput,
    HTMLSelect,
    InputGroup,
    FormGroup,
} from "@blueprintjs/core";

const SettingsDialog = ({
                            isOpen,
                            onClose,
                            columns,
                            baseColumns = columns,
                            savedViews,
                            density = 'normal',
                            onSaveColumnSettings,
                            onResetColumns,
                            presentation = 'dialog',
                        }) => {
    const isDesignSystem2 = useForgeTheme()?.themeId === 'design-system-2';
    const [localColumns, setLocalColumns] = useState(columns || []);
    const [selectedTabId, setSelectedTabId] = useState('visibility');
    const [localDensity,setLocalDensity] = useState(density);
    const [columnQuery,setColumnQuery] = useState('');

    useEffect(() => {
        if (isOpen && columns) {
            setLocalColumns(columns);
            setLocalDensity(density);
            setColumnQuery('');
        }
    }, [isOpen, columns, density]);

    const handleTabChange = (newTabId) => {
        setSelectedTabId(newTabId);
    };

    const handleToggleVisible = (colId) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, visible: !c.visible } : c
        );
        setLocalColumns(updated);
    };

    const handleWidthChange = (colId, newWidth) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, width: newWidth } : c
        );
        setLocalColumns(updated);
    };

    const handleAlignChange = (colId, newAlign) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, align: newAlign } : c
        );
        setLocalColumns(updated);
    };

    const handleTooltipChange = (colId, newTooltip) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, tooltip: newTooltip } : c
        );
        setLocalColumns(updated);
    };

    const handleMoveUp = (colId) => {
        const index = localColumns.findIndex((c) => c.id === colId);
        if (index > 0) {
            const updated = [...localColumns];
            [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
            setLocalColumns(updated);
        }
    };

    const handleMoveDown = (colId) => {
        const index = localColumns.findIndex((c) => c.id === colId);
        if (index < localColumns.length - 1) {
            const updated = [...localColumns];
            [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
            setLocalColumns(updated);
        }
    };

    const renderVisibilityPanel = () => (
        <Menu>
            {localColumns
                .filter((col) => !col.nonExcludable) // Exclude non-excludable columns
                .map((col) => (
                    <MenuItem
                        key={col.id}
                        text={col.displayName || col.name}
                        icon={(iconName => iconName ? <UnifiedIcon name={iconName}/> : iconName)(col.visible ? "eye-open" : "eye-off")}
                        onClick={() => handleToggleVisible(col.id)}
                    />
                ))}
        </Menu>
    );

    const renderColumnsPanel = () => (
        <div className="forge-table-settings__columns">
            {localColumns
                .filter((col) => !col.nonExcludable) // Exclude non-excludable columns
                .map((col, index) => (
                    <div key={col.id} className="forge-table-settings__column">
                        <div className="forge-table-settings__column-heading">
                            <h5>{col.displayName || col.name}</h5>
                            <div>
                                <Button
                                    icon={<UnifiedIcon name="arrow-up"/>}
                                    minimal
                                    disabled={index === 0}
                                    onClick={() => handleMoveUp(col.id)}
                                />
                                <Button
                                    icon={<UnifiedIcon name="arrow-down"/>}
                                    minimal
                                    disabled={index === localColumns.length - 1}
                                    onClick={() => handleMoveDown(col.id)}
                                />
                            </div>
                        </div>
                        <div className="forge-table-settings__fields">
                            <FormGroup label="Width" labelFor={`width-${col.id}`}>
                                <NumericInput
                                    id={`width-${col.id}`}
                                    min={24}
                                    max={4096}
                                    value={col.width || ''}
                                    onValueChange={(valueAsNumber) => handleWidthChange(col.id, valueAsNumber)}
                                    placeholder="Width (px)"
                                />
                            </FormGroup>
                            <FormGroup label="Alignment" labelFor={`align-${col.id}`}>
                                <HTMLSelect
                                    id={`align-${col.id}`}
                                    options={[
                                        { label: 'Left', value: 'left' },
                                        { label: 'Center', value: 'center' },
                                        { label: 'Right', value: 'right' },
                                    ]}
                                    value={col.align || 'left'}
                                    onChange={(e) => handleAlignChange(col.id, e.currentTarget.value)}
                                />
                            </FormGroup>
                            <Checkbox label="Freeze column" checked={col.sticky === 'left'} onChange={event=>setLocalColumns(previous=>previous.map(entry=>entry.id===col.id?{...entry,sticky:event.target.checked?'left':false}:entry))}/>
                            <FormGroup
                                label="Tooltip"
                                labelFor={`tooltip-${col.id}`}
                                className="forge-table-settings__full-width"
                            >
                                <InputGroup
                                    id={`tooltip-${col.id}`}
                                    value={col.tooltip || ''}
                                    onChange={(e) => handleTooltipChange(col.id, e.target.value)}
                                    placeholder="Tooltip text (optional)"
                                />
                            </FormGroup>
                        </div>
                    </div>
                ))}
        </div>
    );

    const drawer = presentation === 'drawer';
    const Frame = drawer ? Drawer : Dialog;
    const changed=JSON.stringify(localColumns)!==JSON.stringify(columns)||localDensity!==density;
    const defaultView=JSON.stringify(localColumns)===JSON.stringify(baseColumns);
    const allColumnsView=!defaultView&&localColumns.length>0&&localColumns.every(column=>column.nonExcludable||column.visible!==false);
    return (
        <Frame
            isOpen={isOpen}
            onClose={onClose}
            title={drawer?'Customize View':'Table Settings'}
            className={`forge-table-settings${drawer?' forge-drawer forge-list-page-drawer':''}`}
            {...(drawer ? {position:'right',size:360,transitionDuration:200,shouldReturnFocusOnClose:true} : {})}
        >
            <DialogBody className={drawer?'forge-drawer-body':undefined}>
                {drawer && <InputGroup type="search" className="forge-drawer-search" data-forge-part="input" aria-label="Search columns" placeholder="Search" leftElement={<UnifiedIcon name="lucide:search" className="bp6-icon"/>} value={columnQuery} onChange={event=>setColumnQuery(event.target.value)}/>}
                {!drawer && savedViews && <TableViewPresets model={savedViews} columns={localColumns} baseColumns={baseColumns} density={localDensity}
                    onApply={(nextColumns, preferences) => {setLocalColumns(nextColumns); setLocalDensity(preferences.density || density);}}/>}
                {!drawer && <FormGroup label="Density" labelFor="table-preference-density"><HTMLSelect id="table-preference-density" value={localDensity} onChange={event=>setLocalDensity(event.target.value)} options={[{label:'Compact',value:'compact'},{label:'Normal',value:'normal'}]}/></FormGroup>}
                {drawer ? <div className="forge-drawer-scroll">
                    <section className="forge-drawer-section"><Typography as="h3" typeRole="label" className="forge-drawer-section-label">Views</Typography><Menu className="forge-drawer-options" role="listbox" aria-label="Column views"><MenuItem text="Default" roleStructure="listoption" selected={defaultView} onClick={()=>setLocalColumns(baseColumns.map(column=>({...column})))}/><MenuItem text="All Columns" roleStructure="listoption" selected={allColumnsView} onClick={()=>setLocalColumns(current=>current.map(column=>({...column,visible:true})))}/></Menu>
                    {savedViews && <TableViewPresets model={savedViews} columns={localColumns} baseColumns={baseColumns} density={localDensity} onApply={(next,preferences)=>{setLocalColumns(next);setLocalDensity(preferences.density||density);}}/>}</section>
                    <hr/>
                    <section className="forge-drawer-section"><Typography as="h3" typeRole="label" className="forge-drawer-section-label">Columns</Typography><div className="forge-list-page__columns">{localColumns.filter(column=>(column.name || column.displayName)&&String(column.displayName||column.name).toLowerCase().includes(columnQuery.toLowerCase())).map(column=><div className="forge-drawer-option" key={column.id}><Checkbox label={column.displayName || column.name} checked={column.visible || column.nonExcludable} disabled={column.nonExcludable} onChange={()=>handleToggleVisible(column.id)}/></div>)}</div></section>
                    <details><summary className="forge-drawer-section-label"><UnifiedIcon name="lucide:chevron-right"/><span>Advanced column settings</span></summary>{renderColumnsPanel()}</details>
                </div> : <Tabs id="settings-tabs" selectedTabId={selectedTabId} onChange={handleTabChange} animate={false}>
                    <Tab id="visibility" title="Visibility" panel={renderVisibilityPanel()} />
                    <Tab id="columns" title="Columns" panel={renderColumnsPanel()} />
                </Tabs>}
            </DialogBody>
            <DialogFooter
                className={drawer?'forge-drawer-actions':undefined}
                actions={[
                    !(drawer && isDesignSystem2) && <Button
                        key="reset"
                        text="Reset"
                        minimal={drawer}
                        onClick={() => {
                            onResetColumns();
                            onClose();
                        }}
                    />,
                    <Button key="cancel" text="Cancel" minimal={drawer} onClick={onClose} />,
                    <Button
                        key="save"
                        intent="primary"
                        disabled={drawer&&!changed}
                        text={drawer?'Apply':'Save'}
                        onClick={() => {
                            onSaveColumnSettings(localColumns,{density:localDensity,frozenColumnIds:localColumns.filter(column=>column.sticky==='left').map(column=>column.id)});
                            onClose();
                        }}
                    />,
                ]}
            />
        </Frame>
    );
};

export default SettingsDialog;
