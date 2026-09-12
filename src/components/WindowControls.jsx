import React from 'react';
import './WindowControls.css';

const WindowControls = ({
                            onClose,
                            onMinimize,
                            onMaximize,
                            showMinimize = true,
                            showMaximize = true,
                        }) => {
    return (
        <div className="window-controls">
            <button
                type="button" aria-label="Close window"
                className="window-control close-control"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(e);
                }}
            ><span className="window-control__indicator" aria-hidden="true" /></button>
            {showMinimize && (
                <button
                    type="button" aria-label="Minimize window"
                className="window-control minimize-control"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMinimize(e);
                    }}
                ><span className="window-control__indicator" aria-hidden="true" /></button>
            )}
            {showMaximize && (
                <button
                    type="button" aria-label="Maximize window"
                className="window-control maximize-control"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMaximize(e);
                    }}
                ><span className="window-control__indicator" aria-hidden="true" /></button>
            )}
        </div>
    );
};


export default WindowControls;
