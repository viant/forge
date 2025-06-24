import React, {useState} from 'react';
import {resolveSelector} from "../utils/selector.js";
import {useSignalEffect} from '@preact/signals-react';
import {
    InputGroup,
    Checkbox,
    RadioGroup,
    Radio,
    TextArea,
    Label,
    FormGroup,
    Switch,
    NumericInput,
    ProgressBar,
    MenuItem,
    Button,
} from '@blueprintjs/core';
import {DateInput3} from '@blueprintjs/datetime2';
import {Select} from '@blueprintjs/select';
import {enUS} from 'date-fns/locale';
import {format, parse} from "date-fns";
import {addStyles, EditableMathField} from "react-mathquill";

function adjustProperties(item, properties) {
    if (!properties) {
        return; // Safeguard to avoid null/undefined errors
    }

    const hasPlaceholder = Object.prototype.hasOwnProperty.call(properties, 'placeholder');
    const hasTimePrecision = Object.prototype.hasOwnProperty.call(properties, 'timePrecision');
    let placeholder = properties['placeholder'];

    switch (item.type) {
        case 'datetime':
            if (!hasTimePrecision) {
                properties['timePrecision'] = 'minute';
            }
            properties['inputProps'] = {name: item.id, placeholder: placeholder || 'Select a time...'};
            delete (properties['placeholder']);

            break;
        case 'date':
            if (!hasPlaceholder) {
                properties['placeholder'] = 'Select a date...';
            }
            properties['inputProps'] = {name: item.id, placeholder: placeholder || 'Select a date...'};
            delete (properties['placeholder']);
            break;
        case 'text':
        case 'math':
        case 'string':
        case 'number':
        case 'numeric':
        case '':
        case 'textarea':
        case 'currency':
            properties['name'] = item.id;
            if (!hasPlaceholder) {
                properties['placeholder'] = `Enter ${item.label}...`;
            }
            break;
        default:
            // No placeholder logic for other types
            break;
    }
}


function getDateProperties(properties, item, events, value, readOnly) {
    const dateProperties = {
        ...properties,
        formatDate: (date) => {
            if (item.dateFnsFormat) {
                const formatted = format(date, item.dateFnsFormat, {locale: enUS})
                return formatted

            }
            return date.toLocaleDateString()
        },
        parseDate: (str) => {
            if (item.dateFnsFormat) {
                const parsed = parse(str, item.dateFnsFormat, new Date(), {locale: enUS})
                return parsed
            }
            return new Date(str)
        },
        ...events,
        value: (value || ''),
        disabled: readOnly,
        locale: enUS
    }
    return dateProperties;
}

const ControlRenderer = ({item, context, container, events = {}, stateEvents = {}, state}) => {
        const {layout} = container;
        const columns = layout?.columns || 1;
        let properties = item?.properties ? {...item.properties} : {};
        let style = item?.style ? {...item.style} : {};
        const labelPosition = item.labelPosition || layout?.labelPosition || 'top';
        const isInline = labelPosition === 'left';
        const span = Math.min(item.columnSpan || 1, columns);
        const [dynamicReadOnly, setDynamicReadOnly] = useState(null);
        const [dynamicProperties, setDynamicProperties] = useState(null);
        const [dynamicValue, setDynamicValue] = useState(null);
        // properties['name'] = item.id;
        const itemId = context.itemId(container, item)
        // properties['aria-label'] = item.label || item.id;


        adjustProperties(item, properties);
        const itemStyle = {
            gridColumn: `span ${span}`,
            ...style,
        };


        const [formData, setFormData] = state ? state : useState({});

        // Determine the key representing where this control stores its value
        const fieldKey = item.dataField || item.bindingPath || item.id;

        // If the component has a default value defined on the schema but it is
        // still missing in the form data, initialise it.
        if (item.value && resolveSelector(formData, fieldKey) === undefined) {
            // Mutate the local formData object to inject the default value in
            // the same way the old flat implementation did.
            const keys = fieldKey.split('.');
            let target = formData;
            for (let i = 0; i < keys.length - 1; i++) {
                if (typeof target[keys[i]] !== 'object' || target[keys[i]] === null) {
                    target[keys[i]] = {};
                }
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = item.value;
        }

        // Resolve current value (falling back to empty string for undefined)
        let value = resolveSelector(formData, fieldKey) || '';

        useSignalEffect(() => {

            if (!state) {
                switch (item.scope) {
                    case 'filter':
                        const filterData = context.handlers.dataSource.getFilter();
                        setFormData(filterData);
                        break;
                    default:
                        const data = context.handlers.dataSource.getFormData();
                        setFormData(data);
                        value = resolveSelector(data, fieldKey) || ''
                }
            }


            if (stateEvents.onValue) {
                const evaluatedValue = stateEvents.onValue({data: formData, item: item, value, context});
                setDynamicValue(evaluatedValue);
            }
            if (stateEvents.onReadonly) {
                const evaluatedReadonly = stateEvents.onReadonly({data: formData, item: item, value, context});
                setDynamicReadOnly(evaluatedReadonly);
            }

            if (stateEvents.onProperties) {
                const evaluatedProperties = stateEvents.onProperties({data: formData, item: item, value, context});
                setDynamicProperties(evaluatedProperties);
            }

        });



        let readOnly = dynamicReadOnly !== null ? dynamicReadOnly : (item.readOnly || false);
        if (dynamicProperties !== null) {
            properties = {...properties, ...dynamicProperties}
        }
        if(dynamicValue !== null) {
            value = dynamicValue
        }

        let layoutItem;
        let isItemControl = false;
        let dateProperties = {}

        switch (item.type) {
            case 'button':
                isItemControl = true;
                layoutItem = (
                    <Button
                        {...properties}
                        {...events}
                        intent={item.intent}
                        disabled={readOnly}
                    >
                        {item.label}
                    </Button>
                );
                break;

            case 'text':
            case 'string':
            case undefined:
                layoutItem = (
                    <InputGroup
                        {...properties}
                        {...events}
                        value={value}
                        readOnly={readOnly}
                    />
                );
                break;
            case 'math':
                layoutItem = (
                    <EditableMathField  {...properties} {...events} latex={value}/>)
            case 'number': //fallthrough
            case 'numeric':
                layoutItem = (
                    <NumericInput
                        {...properties}
                        {...events}
                        value={value}
                        readOnly={readOnly}
                    />
                );
                break;

            case 'checkbox':
                layoutItem = (
                    <Checkbox
                        {...properties}
                        {...events}
                        checked={!!value}
                        readOnly={readOnly}
                    />
                );
                break;

            case 'toggle':
                layoutItem = (
                    <Switch
                        {...properties}
                        {...events}
                        checked={!!value}
                        disabled={readOnly}
                    />
                );
                break;

            case 'radio': {
                const options = item.options || [];
                layoutItem = (
                    <RadioGroup
                        {...properties}
                        {...events}
                        disabled={readOnly}
                        selectedValue={`${value}`}
                    >
                        {options.map((option) => (
                            <Radio key={itemId + option.value} label={option.label} value={option.value}/>
                        ))}
                    </RadioGroup>
                );
                break;
            }

            case 'select':
            case 'dropdown':
                const opts = (dynamicProperties && dynamicProperties.options) || item.options || [];
                layoutItem = (
                    <Select
                        items={opts}
                        itemRenderer={(selectItem, {handleClick, modifiers}) => (
                            <MenuItem
                                key={itemId + selectItem.value}
                                text={selectItem.label}
                                onClick={handleClick}
                                active={modifiers.active}
                            />
                        )}
                        {...properties}
                        {...events}
                        filterable={false}
                        disabled={readOnly}
                    >
                        <Button
                            text={
                                (opts.find((opt) => opt.value === (resolveSelector(formData, fieldKey) || ''))?.label) ||
                                `Select ${item.label}`
                            }
                            rightIcon="caret-down"
                            disabled={readOnly}
                        />
                    </Select>
                );
                break;

            case 'textarea':
                layoutItem = (
                    <TextArea
                        {...properties}
                        {...events}
                        value={value}
                        readOnly={readOnly}
                    />
                );
                break;

            case 'datetime':
                dateProperties = getDateProperties(properties, item, events, value, readOnly);
            case 'date':
                dateProperties = getDateProperties(properties, item, events, value, readOnly);
                layoutItem = (
                    <DateInput3 {...dateProperties}/>
                );
                break;

            case 'label':
                layoutItem = (
                    <Label className={"label-data"} {...properties}>
                        {value}
                    </Label>
                );
                break;

            case 'progressBar':
                layoutItem = (
                    <ProgressBar
                        {...properties}
                        value={value || 0}
                    />
                );
                break;

            case 'currency':
                layoutItem = (
                    <NumericInput
                        {...properties}
                        {...events}
                        value={value}
                        readOnly={readOnly}
                        leftIcon="dollar"
                    />
                );
                break;

            case 'keyValuePairs':
                // Example custom component:
                layoutItem = (
                    <KeyValuePairsComponent

                        {...properties}
                        {...events}
                        data={value || {}}
                        disabled={readOnly}
                    />
                );
                break;

            default:
                // Retains the original default case
                layoutItem = (
                    <InputGroup
                        {...properties}
                        {...events}
                        value={value || ''}
                        readOnly={readOnly}
                    />
                );
                break;
        }


        // If it's a standalone control (e.g., a button), return it directly within the styled div
        if (isItemControl) {
            return (
                <div key={item.id} style={itemStyle}>
                    {layoutItem}
                </div>
            );
        }


        return (
            <div key={item.id} style={itemStyle}>
                <FormGroup label={item.label} labelFor={item.id} inline={isInline}>
                    {layoutItem}
                </FormGroup>
            </div>
        );
    }
;

export default ControlRenderer;
