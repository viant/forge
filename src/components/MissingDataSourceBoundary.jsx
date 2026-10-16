import React from 'react';
import {MissingDataSourceReferenceError} from '../core/context/dataSourceReference.js';
import {getLogger} from '../utils/logger.js';

// Rendering may omit a region whose optional source definition was not supplied.
// Commands still use strict Context resolution; no fallback datasource or success
// result is synthesized. Authorization/transport failures propagate unchanged.
export default class MissingDataSourceBoundary extends React.Component {
    state = {error: null, metadata: this.props.metadata, reference: this.props.reference};
    static getDerivedStateFromProps(props, state) {
        if (props.metadata !== state.metadata || props.reference !== state.reference) {
            return {error: null, metadata: props.metadata, reference: props.reference};
        }
        return null;
    }
    static getDerivedStateFromError(error) {
        if (!(error instanceof MissingDataSourceReferenceError)) throw error;
        return {error};
    }
    componentDidCatch(error) {
        getLogger('ds').debug('Omitted render region with unresolved datasource reference', {
            dataSourceRef: error.dataSourceRef,
            windowId: error.identity?.windowId,
        });
    }
    render() {return this.state.error ? null : this.props.children;}
}
