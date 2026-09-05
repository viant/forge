export const normalizeContainerAnchor = (container) => String(container?.id || '').trim();

export const containerAnchorProps = (container) => {
    const id = normalizeContainerAnchor(container);
    return id ? {'data-forge-container-id': id} : {};
};
