// SchemaExplorer.jsx – displays a JSON-schema in an expandable table view.

import React, { useMemo, useState } from 'react';
import { jsonSchemaToRows } from '../utils/schemaExplorer.js';
import { Icon } from '@blueprintjs/core';
import './SchemaExplorer.css';

/*
Props
  schema:   JSON-Schema object (root.type must be "object")
  style?:   React.CSSProperties – optional table style overrides
*/

const SchemaExplorer = ({ schema, value, style }) => {
    const effectiveSchema = schema ?? value;

    // Derive the immutable rows model once per schema instance.
    const rows = useMemo(() => jsonSchemaToRows(effectiveSchema), [effectiveSchema]);

    // Track the expanded state via a Set of row ids.
    const [open, setOpen] = useState(new Set());

    const toggle = (id) => {
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderRows = (rowsArr, level = 0) =>
        rowsArr.map((row) => {
            const hasChildren = Array.isArray(row.children) && row.children.length > 0;
            const isOpen = open.has(row.id);

            return (
                <React.Fragment key={row.id}>
                    <tr>
                        <td style={{ paddingLeft: level * 16 }}>
                            {hasChildren && (
                                <Icon
                                    icon={isOpen ? 'chevron-down' : 'chevron-right'}
                                    size={12}
                                    style={{ cursor: 'pointer', marginRight: 4 }}
                                    onClick={() => toggle(row.id)}
                                />
                            )}
                            {row.name}
                        </td>
                        <td>{row.type}</td>
                        <td>{row.widget || ''}</td>
                        <td>{row.format || ''}</td>
                        <td>{row.default !== undefined ? String(row.default) : ''}</td>
                        <td>{Array.isArray(row.enum) ? row.enum.join(', ') : ''}</td>
                        <td>{row.description || ''}</td>
                    </tr>
                    {hasChildren && isOpen && renderRows(row.children, level + 1)}
                </React.Fragment>
            );
        });

    return (
        <table
            className="bp4-html-table bp4-html-table-striped bp4-html-table-condensed bp4-interactive bp4-small forge-schema-table"
            style={{ width: '100%', ...(style || {}) }}
        >
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Widget</th>
                    <th>Format</th>
                    <th>Default</th>
                    <th>Enum</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>{renderRows(rows)}</tbody>
        </table>
    );
};

export default SchemaExplorer;
