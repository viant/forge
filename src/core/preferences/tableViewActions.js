// Authored actions supply application wire formats through the normal context
// boundary. This adapter neither chooses a transport nor supplies actor identity.
export function createTableViewActionAdapter(context, actions) {
    if (!actions || typeof actions !== 'object' || Array.isArray(actions)) return null;
    const adapter = {};
    const invoke = (name, args) => {
        if (typeof context?.lookupHandler !== 'function') throw new Error('Saved view action context is unavailable');
        const handler = context.lookupHandler(name);
        if (typeof handler !== 'function') throw new Error('Saved view action is unavailable');
        return handler({context, ...args});
    };
    for (const operation of ['list', 'save', 'remove']) {
        const name = actions[operation];
        if (typeof name !== 'string' || !name.trim()) continue;
        if (operation === 'list') adapter.list = key => invoke(name, {key});
        if (operation === 'save') adapter.save = (key, input) => invoke(name, {key, input});
        if (operation === 'remove') adapter.remove = (key, id) => invoke(name, {key, id});
    }
    return adapter;
}
