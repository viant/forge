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
                className="window-control close-control"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(e);
                }}
            />
            {showMinimize && (
                <button
                    className="window-control minimize-control"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMinimize(e);
                    }}
                />
            )}
            {showMaximize && (
                <button
                    className="window-control maximize-control"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMaximize(e);
                    }}
                />
            )}
        </div>
    );
};


export default WindowControls;
