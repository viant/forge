import Foundation

/// Runs synchronous lifecycle hooks against a snapshot and returns ordered effects.
/// The adapter has no network access; the runtime must validate and apply effects.
public struct DataSourceHookProjectionResult: Sendable, Equatable {
    public let effects: [JSONValue]
    public let result: JSONValue?
}

public enum DataSourceHookProjection {
    public static func invoke(code: String, function: String, namespace: String?, source: String,
                              snapshots: [String: JSONValue], collection: [[String: JSONValue]]) throws -> DataSourceHookProjectionResult {
        var name = function
        if let namespace, name.hasPrefix(namespace + ".") { name.removeFirst(namespace.count + 1) }
        let wrapper = #"""
        (() => {
          const timers = [];
          const setTimeout = (fn, delay = 0) => {
            if (delay !== 0) throw new Error('Delayed lifecycle timers are unsupported');
            timers.push(fn); return timers.length;
          };
          const module = (
        """# + code + #"""
          );
          return { run: ({name, source, snapshots, collection}) => {
            const effects = [];
            const contexts = {};
            const contextFor = ref => {
              if (!Object.prototype.hasOwnProperty.call(snapshots, ref)) return undefined;
              if (contexts[ref]) return contexts[ref];
              const state = snapshots[ref];
              const form = { peek: () => state.form || {} };
              Object.defineProperty(form, 'value', {
                get: () => state.form || {},
                set: value => { state.form = value; effects.push({kind:'form', ref, value}); }
              });
              const ctx = {
                Context: contextFor,
                signals: {form},
                handlers: {dataSource: {
                  getFormData: () => state.form || {},
                  getCollection: () => state.collection || [],
                  setInputParameters: value => { state.input = value; effects.push({kind:'input', ref, value}); },
                  fetchCollection: options => { effects.push({kind:'fetch', ref, value: options || {}}); }
                }}
              };
              contexts[ref] = ctx; return ctx;
            };
            const fn = module[name];
            if (typeof fn !== 'function') throw new Error('Missing lifecycle hook: ' + name);
            const result = fn({context:contextFor(source), collection});
            if (result && typeof result.then === 'function') throw new Error('Async lifecycle hooks are unsupported');
            let count = 0;
            while (timers.length) {
              if (++count > 100) throw new Error('Lifecycle timer limit exceeded');
              timers.shift()();
            }
            return {effects, result: result === undefined ? null : result};
          }};
        })()
        """#
        let result = try ActionHookRuntime.invoke(code: wrapper, functionName: "run", props: .object([
            "name": .string(name), "source": .string(source), "snapshots": .object(snapshots),
            "collection": .array(collection.map(JSONValue.object))
        ]))
        let object = result?.objectValue ?? [:]
        return DataSourceHookProjectionResult(
            effects: object["effects"]?.arrayValue ?? [],
            result: object["result"] == .null ? nil : object["result"]
        )
    }
}
