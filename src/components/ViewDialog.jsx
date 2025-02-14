import React, {useState, useEffect, useRef} from 'react';
import {Dialog, DialogBody, DialogFooter, Button, Classes, InputGroup} from '@blueprintjs/core';
import LayoutRenderer from './LayoutRenderer';
import {useSignalEffect} from "@preact/signals-react";
import {dialogHandlers} from "../hooks";
import {resolveTemplate} from "../utils";


const ViewDialog = ({context, dialog}) => {
    const [isOpen, setIsOpen] = useState(false);
    const {handlers} = context

    const events = dialogHandlers(context, dialog)
    useSignalEffect(() => {


        const isDialogOpen = handlers.dialog.isOpen()
        if(isDialogOpen && ! isOpen) {
            handlers.dataSource.setInputArgs(handlers.dialog.callerArgs())
            if(events.onOpen.isDefined()) {
                events.onOpen.execute()
            }
        }
        if(isOpen !== isDialogOpen) {
            setIsOpen(isDialogOpen);
        }
    });

    const handleClose = () => {
        handlers.dialog.close();
    };
    if (!isOpen) {
        return null;
    }



   const collection =  handlers.dataSource.peekCollection()
    const input = handlers.dataSource.peekInput()

    const title = resolveTemplate(dialog.title, {input})

    const {style={}} = dialog
    const dialogStyle = {
        // height: "100%",
        // display: "flex",
        // flexDirection: "column",
        zIndex: 100,
              ...style,
    }

    return (

        <div             onMouseDown={(e) => e.stopPropagation()} >

        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            title={title}
            isCloseButtonShown={true}
            style={dialogStyle}
        >
            <DialogBody>
                <LayoutRenderer
                    context={context.Context(dialog.dataSourceRef)}
                    container={{dataSourceRef: dialog.dataSourceRef, ...dialog.content}}
                />
            </DialogBody>
            <DialogFooter actions={
                dialog.actions?.map((action) => (
                    <Button
                        key={action.id}
                        intent={action.intent}
                        onClick={(e) => {

                            const handler = events.actions[action.id]
                            if (handler.onClick) {
                                return handler.onClick.execute({event: e, action: action.id})
                            }
                        }}
                    >{action.label}</Button>
                ))
            }/>
        </Dialog>
        </div>

    );
};

export default ViewDialog;
