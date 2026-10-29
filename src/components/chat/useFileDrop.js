import {useEffect, useRef, useState} from 'react';

export default function useFileDrop(onFiles, enabled = true) {
    const [fileDrag, setFileDrag] = useState(false);
    const dragDepth = useRef(0);
    const canDropFiles = enabled && typeof onFiles === 'function';
    const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files');
    const clearFileDrag = () => {dragDepth.current = 0; setFileDrag(false);};
    useEffect(() => {if (!canDropFiles) clearFileDrag();}, [canDropFiles]);

    return {fileDrag, dropHandlers: {
        onDragEnter: event => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            if (canDropFiles) {dragDepth.current += 1; setFileDrag(true);}
        },
        onDragOver: event => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = canDropFiles ? 'copy' : 'none';
        },
        onDragLeave: () => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setFileDrag(false);
        },
        onDragEnd: clearFileDrag,
        onDrop: event => {
            if (!isFileDrag(event)) return;
            event.preventDefault(); event.stopPropagation(); clearFileDrag();
            const files = Array.from(event.dataTransfer.files || []);
            if (canDropFiles && files.length) onFiles(files);
        },
    }};
}
