import Foundation

extension ForgeRuntime {
    public func windowFormJSONValue(windowID: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).windowFormID()
        return await dataSourceRuntime.form(dataSourceID: dataSourceID)
    }

    public func setWindowFormValue(
        windowID: String,
        values: [String: JSONValue],
        replace: Bool = false,
        bumpPrefillRevision: Bool = true
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).windowFormID()
        let signal = await signals.form(dataSourceID: dataSourceID)
        let current = await dataSourceRuntime.form(dataSourceID: dataSourceID)
        let nextValues = bumpPrefillRevision
            ? valuesWithPrefillRevision(values, current: current)
            : values
        if replace {
            await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: nextValues)
            await signal.set(nextValues)
            return
        }
        let merged = mergeWindowFormValues(base: current, override: nextValues)
        await dataSourceRuntime.setForm(
            dataSourceID: dataSourceID,
            values: merged
        )
        await signal.set(merged)
    }

    func reconcileWindowForm(
        windowID: String,
        metadata: WindowMetadata,
        parameters: [String: JSONValue]
    ) async {
        let initialValues = resolveInitialWindowFormValues(metadata: metadata)
        let seeded = mergeWindowFormValues(base: parameters, override: initialValues)
        let current = await windowFormJSONValue(windowID: windowID)
        let reconciled = mergeWindowFormValues(base: seeded, override: current)
        await setWindowFormValue(
            windowID: windowID,
            values: reconciled,
            replace: true,
            bumpPrefillRevision: false
        )
    }
}

private func valuesWithPrefillRevision(
    _ values: [String: JSONValue],
    current: [String: JSONValue]
) -> [String: JSONValue] {
    guard values["prefill"] != nil else {
        return values
    }
    var next = values
    let currentMeta = current["__forge"]?.objectValue ?? [:]
    let incomingMeta = values["__forge"]?.objectValue ?? [:]
    var meta = mergeWindowFormValues(base: currentMeta, override: incomingMeta)
    meta["prefillRevision"] = .number(Double(prefillRevision(from: currentMeta) + 1))
    next["__forge"] = .object(meta)
    return next
}

private func prefillRevision(from values: [String: JSONValue]) -> Int {
    switch values["prefillRevision"] {
    case .number(let value):
        return Int(value)
    case .string(let value):
        return Int(value.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
    default:
        return 0
    }
}

private func resolveInitialWindowFormValues(metadata: WindowMetadata) -> [String: JSONValue] {
    var initial: [String: JSONValue] = [:]
    let entries = metadata.on
    for entry in entries where entry.event == "onInit" && entry.handler == "dataSource.setWindowFormData" {
        for parameter in entry.parameters where parameter.input == "const" {
            let name = parameter.name.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            if let location = parameter.location {
                initial[name] = location
            } else if let value = parameter.value {
                initial[name] = value
            }
        }
    }
    for container in metadata.view?.content?.containers ?? [] {
        collectInitialWindowFormItemValues(container: container, initial: &initial)
    }
    return initial
}

private func collectInitialWindowFormItemValues(
    container: ContainerDef,
    initial: inout [String: JSONValue]
) {
    for item in container.items where (item.scope ?? "").trimmingCharacters(in: .whitespacesAndNewlines) == "windowForm" {
        let fieldKey = (item.bindingPath ?? item.dataField ?? item.id ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fieldKey.isEmpty, let value = item.value else { continue }
        initial[fieldKey] = value
    }
    for child in container.containers {
        collectInitialWindowFormItemValues(container: child, initial: &initial)
    }
}

private func mergeWindowFormValues(
    base: [String: JSONValue],
    override: [String: JSONValue]
) -> [String: JSONValue] {
    var result = base
    for (key, value) in override {
        if
            case .object(let currentObject)? = result[key],
            case .object(let overrideObject) = value
        {
            result[key] = .object(mergeWindowFormValues(base: currentObject, override: overrideObject))
        } else {
            result[key] = value
        }
    }
    return result
}

extension JSONValue {
    init?(any: Any?) {
        guard let any else {
            self = .null
            return
        }
        switch any {
        case let value as JSONValue:
            self = value
        case let value as String:
            self = .string(value)
        case let value as Bool:
            self = .bool(value)
        case let value as Int:
            self = .number(Double(value))
        case let value as Int64:
            self = .number(Double(value))
        case let value as Double:
            self = .number(value)
        case let value as Float:
            self = .number(Double(value))
        case let value as NSNumber:
            self = .number(value.doubleValue)
        case let value as [String: JSONValue]:
            self = .object(value)
        case let value as [String: Any]:
            var object: [String: JSONValue] = [:]
            for (key, child) in value {
                guard let jsonValue = JSONValue(any: child) else { return nil }
                object[key] = jsonValue
            }
            self = .object(object)
        case let value as [JSONValue]:
            self = .array(value)
        case let value as [Any]:
            let array = value.compactMap(JSONValue.init(any:))
            guard array.count == value.count else { return nil }
            self = .array(array)
        default:
            return nil
        }
    }

    var anyValue: Any? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value
        case .bool(let value):
            return value
        case .array(let value):
            return value.map(\.anyValue)
        case .object(let value):
            return value.mapValues(\.anyValue)
        case .null:
            return nil
        }
    }
}
