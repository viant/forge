import { resolveParameters } from "../hooks/parameters.js";
import { mergeWindowFormValues } from "../hooks/dataSource.js";

export function collectWindowLifecycleEntries(metadata = {}) {
  const windowCfg = metadata?.window || {};
  return [
    ...(Array.isArray(windowCfg.on) ? windowCfg.on : []),
    ...(Array.isArray(metadata?.on) ? metadata.on : []),
  ];
}

export function runWindowLifecycleHandlers({
  eventName = 'onInit',
  metadata = {},
  context = null,
  defaultDataSourceRef = '',
  windowFormSignal = null,
  log = null,
  windowId = '',
  windowKey = '',
} = {}) {
  const windowOnArr = collectWindowLifecycleEntries(metadata);
  const evts = windowOnArr.filter((entry) => entry?.event === eventName);
  evts.forEach((ev) => {
    try {
      const { handler: handlerId, args = [], parameters = [] } = ev;
      if (handlerId === 'dataSource.setWindowFormData') {
        const resolvedParameters = resolveParameters(parameters, {
          identity: { dataSourceRef: defaultDataSourceRef },
          signals: { windowForm: windowFormSignal },
          dataSources: metadata?.dataSource || {},
          Context() { return this; },
          handlers: {
            dataSource: {
              peekFormData: () => ({}),
              peekSelection: () => ({ selected: null }),
              peekFilter: () => ({}),
            },
          },
        });
        try {
          log?.debug?.('[window.onInit]', {
            windowId,
            windowKey,
            handlerId,
            parameters,
            resolvedParameters,
            before: windowFormSignal?.peek?.() || {},
          });
        } catch (_) {}
        windowFormSignal.value = mergeWindowFormValues(windowFormSignal.peek?.() || {}, resolvedParameters || {});
        return;
      }

      // A multi-source window can intentionally have no default datasource.
      // Its window-level onInit actions still belong to the root context;
      // Context('') would try to resolve an absent datasource and skip them.
      const handlerContext = defaultDataSourceRef ? context.Context(defaultDataSourceRef) : context;
      const fn = handlerContext.lookupHandler(handlerId);
      const resolvedParameters = resolveParameters(parameters, handlerContext);
      fn({
        execution: { id: handlerId, args, parameters },
        args,
        parameters: resolvedParameters,
        context: handlerContext,
      });
    } catch (err) {
      // Preserve current runtime behavior: lifecycle handler failures are surfaced
      // to console but do not crash the whole window.
      console.error(`window.${eventName} handler failed`, ev?.handler, err);
    }
  });
}
