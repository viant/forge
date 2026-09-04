export const isolateButtonCellProps = (props = {}) => ({
    ...props,
    onClick: (event) => {
        event?.stopPropagation?.();
        return props.onClick?.(event);
    },
});
