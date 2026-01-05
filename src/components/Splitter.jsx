import React, {useRef, useState} from 'react';
import {Divider} from '@blueprintjs/core';
import './Splitter.css';

const Splitter = ({orientation = 'horizontal', divider = {}, children}) => {
    const containerRef = useRef(null);
    const startPosRef = useRef(null);
    const activeDividerIndexRef = useRef(null);

    const isVertical = orientation === 'vertical';

    const [sizes, setSizes] = useState(() => {
        if(divider.sizes) {
            return divider.sizes
        }
        const initialSize = (100 / React.Children.count(children));
        return Array(React.Children.count(children)).fill(initialSize);
    });

    const isVisible = divider.visible || false;
    const handleMouseDown = (index, event) => {
        event.preventDefault();
        startPosRef.current = isVertical ? event.clientY : event.clientX;
        activeDividerIndexRef.current = index;

        const containerSize = isVertical
            ? containerRef.current.offsetHeight
            : containerRef.current.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const currentPos = isVertical ? moveEvent.clientY : moveEvent.clientX;
            const delta = ((currentPos - startPosRef.current) / containerSize) * 100;

            setSizes((prevSizes) => {
                const newSizes = [...prevSizes];
                const index = activeDividerIndexRef.current;

                const clampedDelta = Math.min(
                    newSizes[index] - 10,
                    Math.max(delta, -(newSizes[index + 1] - 10))
                );

                newSizes[index] += clampedDelta;
                newSizes[index + 1] -= clampedDelta;
                startPosRef.current = currentPos;

                return newSizes;
            });
        };

        const stopDragging = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', stopDragging);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stopDragging);
    };

    return (
        <div
            className={`splitter-container ${isVertical ? 'vertical' : ''}`}
            ref={containerRef}
            style={{
                display: 'flex',
                flexDirection: isVertical ? 'column' : 'row',
                height: '100%',
                width: '100%',
                minHeight: 0,
                minWidth: 0,
            }}
        >
            {React.Children.map(children, (child, index) => {

                const style = {
                    flexBasis: `${sizes[index]}%`,
                    flexGrow: 0,
                    flexShrink: 0,
                    marginRight: '5px',
                    marginLeft: '5px',
                    overflow: 'auto',
                    minHeight: 0,
                    minWidth: 0,
                }
                if (index !== sizes.length - 1) {
                    if (isVertical) {
                        style['marginBottom'] = '5px'
                    }
                }
                return (
                    <React.Fragment key={'sf' + (child?.id || index)}>
                        <div
                            key={'kv' + (child.id|| index)}
                            className="splitter-panel"
                            style={style}
                        >
                            {child}
                        </div>
                        {index < children.length - 1 && isVisible && (
                            <Divider key={'kvd' + (child.id|| index)}
                                className={`splitter-resizer ${isVertical ? 'vertical' : 'horizontal'}`}
                                onMouseDown={(e) => handleMouseDown(index, e)}
                            />
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    );
};


export default Splitter;
