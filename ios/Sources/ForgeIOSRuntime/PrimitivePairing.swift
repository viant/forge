import Foundation

public enum PrimitivePairing {
    public static let presentationKeys = ["derivedDataSource", "resourceHeader", "queryToolbar", "notificationRules", "editableCollection", "statusWorkflow", "draftForm", "metricSummary", "relationDrill", "detailView", "historyDiff", "mutationCommand"]

    // Each primitive observes its own declared datasource, even when siblings
    // in the same container read different records.
    public static func scopedContainers(_ container: ContainerDef) -> [ContainerDef] {
        guard let data = try? JSONEncoder().encode(container),
              let raw = try? JSONDecoder().decode(JSONValue.self, from: data).objectValue else { return [] }
        return presentationKeys.compactMap { key in
            guard let spec = raw[key]?.objectValue else { return nil }
            var scoped = raw
            for other in presentationKeys where other != key { scoped.removeValue(forKey: other) }
            scoped["id"] = .string((container.id ?? "primitive") + ":" + key)
            if key != "mutationCommand", let ref = spec["dataSourceRef"]?.stringValue, !ref.isEmpty { scoped["dataSourceRef"] = .string(ref) }
            guard let encoded = try? JSONEncoder().encode(JSONValue.object(scoped)) else { return nil }
            return try? JSONDecoder().decode(ContainerDef.self, from: encoded)
        }
    }
}
