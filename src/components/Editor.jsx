import React, {useMemo, useState} from "react";
import {Card, Elevation} from "@blueprintjs/core";
import {oneDark} from "@codemirror/theme-one-dark";

import CodeMirror from "@uiw/react-codemirror";
import {EditorView} from "@codemirror/view";
import {HighlightStyle, syntaxHighlighting, defaultHighlightStyle} from "@codemirror/language";
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
// Explicit base highlighting stays active alongside the accessible string override.
const baseSyntax = syntaxHighlighting(defaultHighlightStyle);
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
                values = [languages[extensionValue], baseSyntax, accessibleSyntax]
            }
            setExtensions(values);
        }
    });


    const handleChange = (value) => {
        handlers.dataSource.setFormField({item: {dataField: selector.source || 'source'}, value});
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

function ControlledEditor({value, onChange, language, height, readOnly = false, ariaLabel}) {
    // Keep the language/facet identities stable while unrelated form state
    // changes. Reconfiguring a multi-megabyte YAML document on every render
    // repeatedly restarts parsing and can stall the editor's browser tab.
    const extensions = useMemo(() => [
        ...(languages[language || 'sql'] ? [languages[language || 'sql']] : []),
        baseSyntax,
        accessibleSyntax,
        ...(ariaLabel ? [EditorView.contentAttributes.of({'aria-label': ariaLabel})] : []),
    ], [language, ariaLabel]);
    return <CodeMirror value={value || ''} height={height || '280px'} extensions={extensions} onChange={onChange} readOnly={readOnly} />;
}

const Editor = props => props.value !== undefined
    ? <ControlledEditor {...props}/>
    : <BoundEditor context={props.context} container={props.container}/>;
export default Editor;
