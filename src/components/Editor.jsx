import {formatEditorValue, parseEditorValue} from './editorValue.js';
import {resolveSelector} from '../utils/selector.js';
import {evaluatePlainVisibleWhen} from './visibleWhen.js';
import React, {useMemo, useRef, useState} from "react";
import {Card, Elevation, Callout} from "@blueprintjs/core";
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
    const [language, setLanguage] = useState('');
    const [readOnly, setReadOnly] = useState(false);
    const [parseError, setParseError] = useState('');
    const previous = useRef({source: undefined, location: undefined});


    useSignalEffect(() => {
        const data = handlers.dataSource.getFormData();
        if (data) {
            const nextSource = formatEditorValue(resolveSelector(data, selector.source || 'source'), editor.valueFormat);
            const nextLocation = resolveSelector(data, selector.location || 'location');
            if (nextSource !== previous.current.source || nextLocation !== previous.current.location) {
                setSource(nextSource);setParseError('');
                previous.current = {source: nextSource, location: nextLocation};
            }
            setLocation(nextLocation);
            setReadOnly(editor.readOnly === true || (!!editor.readOnlyWhen && evaluatePlainVisibleWhen(editor.readOnlyWhen, context)));
            const extensionValue = editor.language || resolveSelector(data, selector.extension || 'extension')
            setLanguage(extensionValue || '');
        }
    });


    const handleChange = (value) => {
        if (readOnly) return;
        setSource(value);
        try {
            const parsed = parseEditorValue(value, editor.valueFormat);
            previous.current.source = formatEditorValue(parsed, editor.valueFormat);
            handlers.dataSource.setFormField({item: {dataField: selector.source || 'source'}, value: parsed});
            setParseError('');
            for (const execute of editor.on || []) {
                if (execute.event === 'onChange' && execute.handler) context.lookupHandler?.(execute.handler)?.({context, value:parsed, execution:execute});
            }
            if (editor.errorField) handlers.dataSource.setFormField({item: {dataField: editor.errorField}, value: ''});
        } catch (error) {
            setParseError(error.message);
            if (editor.errorField) handlers.dataSource.setFormField({item: {dataField: editor.errorField}, value: error.message});
        }
    };

    const style = editor.style || {}
    const {width= '100%', height = '70vh'} = style

    return (
        <>
            <ControlledEditor value={source} language={language} readOnly={readOnly}
                height={height} width={width} onChange={handleChange} ariaLabel={editor.title}/>
            {parseError && <Callout intent="warning" role="alert">{parseError}</Callout>}

        </>
    );
};

function ControlledEditor({value, onChange, language, height, width, readOnly = false, ariaLabel}) {
    // Keep the language/facet identities stable while unrelated form state
    // changes. Reconfiguring a multi-megabyte YAML document on every render
    // repeatedly restarts parsing and can stall the editor's browser tab.
    const extensions = useMemo(() => [
        ...(languages[language ?? 'sql'] ? [languages[language ?? 'sql']] : []),
        baseSyntax,
        accessibleSyntax,
        ...(ariaLabel ? [EditorView.contentAttributes.of({'aria-label': ariaLabel})] : []),
    ], [language, ariaLabel]);
    return <CodeMirror value={value || ''} height={height || '280px'} width={width} extensions={extensions} onChange={onChange} readOnly={readOnly} />;
}

const Editor = props => props.value !== undefined
    ? <ControlledEditor {...props}/>
    : <BoundEditor context={props.context} container={props.container}/>;
export default Editor;
