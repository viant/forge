import React, {useEffect, useRef, useState} from 'react';
import {Divider} from '@blueprintjs/core';
import './Splitter.css';

const Splitter = ({orientation = 'horizontal', divider = {}, children}) => {
    const containerRef = useRef(null);
    const startPosRef = useRef(null);
    const activeDividerIndexRef = useRef(null);

    const isVertical = orientation === 'vertical';
    const [containerSize, setContainerSize] = useState(0);
    const childCount = React.Children.count(children);

    const [sizes, setSizes] = useState(() => {
        if(divider.sizes) {
            return divider.sizes
        }
        const initialSize = (100 / childCount);
        return Array(childCount).fill(initialSize);
    });

    const isVisible = divider.visible || false;
    useEffect(() => {
        if (!containerRef.current || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const updateSize = () => {
            const nextSize = isVertical
                ? containerRef.current?.offsetHeight
                : containerRef.current?.offsetWidth;
            setContainerSize(Number(nextSize || 0));
        };
        updateSize();
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isVertical]);

    const dividerThickness = isVisible ? 5 : 0;
    const availableMainSize = containerSize > 0
        ? Math.max(0, containerSize - (Math.max(childCount - 1, 0) * dividerThickness))
        : 0;

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
                flex: '1 1 auto',
                flexDirection: isVertical ? 'column' : 'row',
                height: '100%',
                width: '100%',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
            }}
        >
            {React.Children.map(children, (child, index) => {

                const style = {
                    flexGrow: 0,
                    flexShrink: 0,
                    overflow: 'auto',
                    minHeight: 0,
                    minWidth: 0,
                }
                if (availableMainSize > 0) {
                    const basis = `${Math.max(0, (availableMainSize * sizes[index]) / 100)}px`;
                    if (isVertical) {
                        style.height = basis;
                    } else {
                        style.width = basis;
                    }
                } else {
                    style.flexBasis = `${sizes[index]}%`;
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
