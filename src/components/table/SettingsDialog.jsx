import React, { useState, useEffect } from "react";
import {
    Button,
    Classes,
    Dialog,
    DialogBody,
    DialogFooter,
    Menu,
    MenuItem,
    Tabs,
    Tab,
    NumericInput,
    HTMLSelect,
} from "@blueprintjs/core";

const SettingsDialog = ({
                            isOpen,
                            onClose,
                            columns,
                            onSaveColumnSettings,
                            onResetColumns, // Accept onResetColumns as a prop
                        }) => {
    const [localColumns, setLocalColumns] = useState(columns || []);
    const [selectedTabId, setSelectedTabId] = useState('visibility');

    useEffect(() => {
        if (isOpen && columns) {
            setLocalColumns(columns);
        }
    }, [isOpen, columns]);

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
                        icon={col.visible ? "eye-open" : "eye-off"}
                        onClick={() => handleToggleVisible(col.id)}
                    />
                ))}
        </Menu>
    );

    const renderColumnsPanel = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {localColumns
                .filter((col) => !col.nonExcludable) // Exclude non-excludable columns
                .map((col, index) => (
                    <div key={col.id} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h5>{col.displayName || col.name}</h5>
                            <div>
                                <Button
                                    icon="arrow-up"
                                    minimal
                                    disabled={index === 0}
                                    onClick={() => handleMoveUp(col.id)}
                                />
                                <Button
                                    icon="arrow-down"
                                    minimal
                                    disabled={index === localColumns.length - 1}
                                    onClick={() => handleMoveDown(col.id)}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <NumericInput
                                min={0}
                                value={col.width || ''}
                                onValueChange={(valueAsNumber) => handleWidthChange(col.id, valueAsNumber)}
                                placeholder="Width (px)"
                                style={{ marginRight: '10px' }}
                            />
                            <HTMLSelect
                                options={[
                                    { label: 'Left', value: 'left' },
                                    { label: 'Center', value: 'center' },
                                    { label: 'Right', value: 'right' },
                                ]}
                                value={col.align || 'left'}
                                onChange={(e) => handleAlignChange(col.id, e.currentTarget.value)}
                            />
                        </div>
                    </div>
                ))}
        </div>
    );

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Table Settings"
            style={{
                zIndex: 100,
            }}
            className={Classes.DARK}
        >
            <DialogBody>
                <Tabs id="settings-tabs" selectedTabId={selectedTabId} onChange={handleTabChange}>
                    <Tab id="visibility" title="Visibility" panel={renderVisibilityPanel()} />
                    <Tab id="columns" title="Columns" panel={renderColumnsPanel()} />
                </Tabs>
            </DialogBody>
            <DialogFooter
                actions={[
                    <Button
                        key="reset"
                        text="Reset"
                        onClick={() => {
                            onResetColumns();
                            onClose();
                        }}
                    />,
                    <Button key="cancel" text="Cancel" onClick={onClose} />,
                    <Button
                        key="save"
                        intent="primary"
                        text="Save"
                        onClick={() => {
                            onSaveColumnSettings(localColumns);
                            onClose();
                        }}
                    />,
                ]}
            />
        </Dialog>
    );
};

export default SettingsDialog;