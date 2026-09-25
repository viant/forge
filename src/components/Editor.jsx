import React, {useState} from "react";
import {Card, Elevation} from "@blueprintjs/core";
import {oneDark} from "@codemirror/theme-one-dark";

import CodeMirror from "@uiw/react-codemirror";
import {EditorView} from "@codemirror/view";
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language";
import {tags} from "@lezer/highlight";
import {javascript} from "@codemirror/lang-javascript";
import {python} from "@codemirror/lang-python";
import {go} from "@codemirror/lang-go";
import {html} from "@codemirror/lang-html";
import {css} from "@codemirror/lang-css";
import {sql} from "@codemirror/lang-sql";
import {yaml} from "@codemirror/lang-yaml";
import {json} from "@codemirror/lang-json";
import {useSignalEffect} from "@preact/signals-react";


const languages = {
    js: javascript(),
    jsx: javascript({jsx: true}),
    py: python(),
    html: html(),
    htm: html(),
    css: css(),
    sql: sql(),
    yaml: yaml(),
    yml: yaml(),
    json: json(),
    go: go(),
};

// CodeMirror's default light-theme string color falls below WCAG AA on white.
// Use semantic highlighting so the accessible color remains stable even when
// CodeMirror changes its generated class names.
const accessibleSyntax = syntaxHighlighting(HighlightStyle.define([
    {tag: tags.string, color: "#b42318"},
]));

const BoundEditor = ({context, container}) => {
    const {editor} = container;
    const {handlers} = context;
    const {selector={}}= editor

    const [source, setSource] = useState("");
    const [location, setLocation] = useState("");
    const [extensions, setExtensions] = useState([]);


    useSignalEffect(() => {
        const data = handlers.dataSource.getFormData();
        if (data) {
            setSource(data[selector.source||'source']);
            setLocation(data[selector.location||'location']);
            const extensionValue = data[selector.extension||'extension']
            let values = []
            if(languages[extensionValue]) {
                values = [languages[extensionValue], accessibleSyntax]
            }
            setExtensions(values);
        }
    });


    const handleChange = (value) => {
        handlers.dataSource.setFormField({item: selector.source || 'source', value});
    };

    const style = editor.style || {}
    const {width= '100%', height = '70vh'} = style

    return (
        <>
            <CodeMirror
                value={source}
                height={height}
                width={width}
                extensions={extensions}
                onChange={handleChange}
            />
        </>
    );
};

const Editor = ({context, container, value, onChange, language, height, readOnly = false, ariaLabel}) => value !== undefined
    ? <CodeMirror value={value || ''} height={height || '280px'} extensions={[...(languages[language || 'sql'] ? [languages[language || 'sql']] : []), accessibleSyntax, ...(ariaLabel ? [EditorView.contentAttributes.of({'aria-label': ariaLabel})] : [])]} onChange={onChange} readOnly={readOnly} />
    : <BoundEditor context={context} container={container}/>;
export default Editor;
