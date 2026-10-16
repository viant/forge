// A picker bundle retains the authored Dialog and uses the ordinary dialog
// lifecycle. The outer window transports its result back to the original caller.
export async function openWindowPickerDialog(window, metadata, context) {
    const id = window?.pickerDialogId;
    if (!id) return;
    if (!metadata?.dialogs?.some(dialog => dialog?.id === id)) throw new Error('Picker dialog is missing from its owning window bundle');
    const handlers = context?.handlers?.window;
    if (!handlers?.openDialog) throw new Error('Picker dialog handler is unavailable');
    const result = await handlers.openDialog({
        execution: {args: [id, {awaitResult: true, parameters: window.pickerParameters || []}]},
        parameters: window.parameters || {}, context,
    });
    if (result?.status === 'canceled' || result?.status === 'busy' || !result) handlers.closeWindow?.();
    else handlers.commit?.({payload: result, context});
}
