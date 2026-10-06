import Foundation

/// Shared lowering for authored report chart specifications on both native report paths.
public enum ReportChartMaterializer {
    public static func materialize(_ document: [String: JSONValue], fieldsByDataset: [String: [[String: JSONValue]]] = [:]) -> [String: JSONValue] {
        var result = document
        result["blocks"] = .array((document["blocks"]?.arrayValue ?? []).map { value in
            guard var block = value.objectValue,
                  block["kind"]?.stringValue == "chartBlock",
                  block["chartModel"] == nil,
                  let spec = block["chartSpec"]?.objectValue,
                  let xField = nonEmpty(spec["xField"]?.stringValue) else {
                return value
            }
            let yFields = (spec["yFields"]?.arrayValue ?? []).compactMap { nonEmpty($0.stringValue) }
            guard !yFields.isEmpty else { return value }
            let authoredType = spec["type"]?.stringValue?.lowercased() ?? ""
            let type: String
            switch authoredType {
            case "horizontal_bar", "horizontalbar": type = "horizontal_bar"
            case "column": type = "bar"
            case "stackedbar": type = "stacked_bar"
            default: type = authoredType.isEmpty ? "line" : authoredType
            }
            let fields = fieldsByDataset[block["datasetRef"]?.stringValue ?? ""] ?? []
            func field(_ key: String) -> [String: JSONValue] { fields.first { $0["key"]?.stringValue == key } ?? [:] }
            let series: [JSONValue] = yFields.map { key in
                let definition = field(key)
                return .object(["label": definition["label"] ?? .string(key), "value": .string(key), "format": definition["format"] ?? .null])
            }
            block["chartModel"] = .object([
                "title": spec["title"] ?? block["title"] ?? .null,
                "type": .string(spec["orientation"]?.stringValue == "horizontal" && type == "bar" ? "horizontal_bar" : type),
                "xAxis": .object(["dataKey": .string(xField), "label": field(xField)["label"] ?? .null]),
                "yAxis": .object(["label": spec["yLabel"] ?? .null, "format": field(yFields[0])["format"] ?? .null]),
                "series": .object(["values": .array(series)])
            ])
            return .object(block)
        })
        return result
    }



    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}
