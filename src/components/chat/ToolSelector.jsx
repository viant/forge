// ToolSelector.jsx – compact button with popover multi-select
import React, { useState } from "react";
import { Button, Menu, MenuItem, Popover } from "@blueprintjs/core";

export default function ToolSelector({ tools = [], value = [], onChange, disabled = false }) {
    const [selected, setSelected] = useState(value);

    const toggle = (tool) => {
        const next = selected.includes(tool)
            ? selected.filter((t) => t !== tool)
            : [...selected, tool];
        setSelected(next);
        if (onChange) onChange(next);
    };

    const menu = (
        <Menu>
            {tools.map((t) => (
                <MenuItem
                    key={t}
                    text={t}
                    icon={selected.includes(t) ? "tick" : "blank"}
                    onClick={() => toggle(t)}
                    shouldDismissPopover={false}
                />
            ))}
        </Menu>
    );

    return (
        <Popover content={menu} placement="top" disabled={disabled}>
            <Button
                icon="wrench"
                minimal
                small
                disabled={disabled}
                text={selected.length ? `${selected.length}` : undefined}
            />
        </Popover>
    );
}
