import React from 'react';
import { Dialog, Button } from "@blueprintjs/core";
import PrettyJson from "../PrettyJson";

const JsonViewer = ({ content }) => {
    let parsed;

    try {
        parsed = JSON.parse(content);
    } catch {
        return <TextViewer content={content} />;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
    };

    return (
        <div style={styles.jsonViewer}>
            <div style={styles.copyButtonWrapper}>
                <Button icon="clipboard" onClick={handleCopy} >
                </Button>
            </div>
            <PrettyJson
                value={parsed}
                readOnly={true}
                maxHeight={400}
                style={styles.prettyJson}
            />
        </div>
    );
};

const TextViewer = ({ content }) => (
    <p style={styles.paragraph}>{content}</p>
);

const FullContentDialog = ({ isOpen, onClose, content }) => (
    <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Full Content"
        style={{ width: '800px', maxWidth: '90%' }}
    >
        <div style={styles.container}>
            <JsonViewer content={content} />
        </div>
    </Dialog>
);

const styles = {
    container: {
        padding: 20,
        maxHeight: '70vh',
        overflowY: 'auto',
    },
    jsonViewer: {
        fontFamily: 'monospace',
        position: 'relative',
    },
    copyButtonWrapper: {
        textAlign: 'right',
        marginBottom: 10,
    },
    prettyJson: {
        fontSize: '13px',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        backgroundColor: 'transparent',
    },
    paragraph: {
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
    },
};

export default FullContentDialog;
