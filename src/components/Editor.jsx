import React, {useState} from "react";
import {Card, Elevation} from "@blueprintjs/core";
import {oneDark} from "@codemirror/theme-one-dark";

import CodeMirror from "@uiw/react-codemirror";
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

const Editor = ({context, container, isActive = {}}) => {
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
                values = [languages[extensionValue]]
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
export default Editor;