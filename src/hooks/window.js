// useGenericDataSourceHandlers.js
import {
    addWindow,
    getDialogSignal, removeSignalsForKey,
} from "../core";

const openViewDialog = (dialogSignal, props) => {
    dialogSignal.value = {...dialogSignal.peek(), open: true, props};
}

const dialogArgs = (dialogSignal) => {
    return dialogSignal.peek().args || {};
}


const closeViewDialog = (dialogSignal) => {
    dialogSignal.value = {...dialogSignal.peek(), open: false};
}


export function useDialogHandlers(windowId, dialogId) {
    const getDialogId = () => {
        return `${windowId}Dialog${dialogId}`;
    }

    const close = () => {
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        closeViewDialog(dialogSignal)
    }

    const callerArgs = () => {
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        return dialogArgs(dialogSignal)
    }
    const isOpen = () => {
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        return dialogSignal.value?.open || false
    }

    return {
        isOpen,
        callerArgs,
        close
    }

}


export function useWindowHandlers(windowId) {

    const inTab = true;
    const getDialogId = (id) => {
        return `${windowId}Dialog${id}`;
    }

    const openWindow = (props = {}) => {
        const {execution, parameters} = props
       const {args=[]} = execution;
        const windowKey = args[0];
        const windowTitle = args[1] ?? "";    // Default empty string if missing
        const windowData = args.length > 2 ? args[2] : "";     // Default empty string if missing
        const inTabOverride = args.length > 3 ? args[3] : inTab; // Use args[3] if available, else fallback
        return addWindow(windowTitle,  windowId, windowKey, windowData, inTabOverride, parameters);
    }


    const closeWindow = (props = {}) => {
        console.log('Closing window:', windowId, ' TODO ... removeWindow');
        removeSignalsForKey(windowId);
    }


    const openDialog = (props = {}) => {
        const {execution} = props
        if (execution.args?.length === 0) {
            throw new Error("parameters[0] (dialog id) is required")
        }
        const dialogId = execution.args[0]
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        openViewDialog(dialogSignal, props)
    }

    const closeDialog = (props = {}) => {
        const {dialogId} = args
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        closeViewDialog(dialogSignal)
    }

    const callerArgs = () => {
        return dialogArgs(dialogArgs)
    }

    return {
        openWindow,
        closeWindow,
        openDialog,
        closeDialog,
        callerArgs,
    }

}
