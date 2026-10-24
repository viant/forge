import React, {forwardRef} from 'react';
import Icon from './Icon.jsx';
import {typographyProps} from './Typography.jsx';
import './selectControl.css';

// Keep the native select's keyboard, labeling and form behavior.
const SelectControl = forwardRef(function SelectControl({wrapperClassName = '', ...props}, ref) {
    if (props['data-forge-type']) typographyProps(props['data-forge-type'], props.style);
    return <span className={`forge-select-control ${wrapperClassName}`.trim()}>
        <select {...props} ref={ref}/>
        <Icon name="lucide:chevron-down"/>
    </span>;
});

export default SelectControl;
