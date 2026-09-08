import Foundation

public struct ResourceSchemaDef: Codable, Sendable {
    public let type: String?
    public let identity: [String]
    public let required: [String]
    public let properties: [String: ResourceFieldSchemaDef]
    public let additionalProperties: Bool?

    public init(type: String? = nil, identity: [String] = [], required: [String] = [], properties: [String: ResourceFieldSchemaDef] = [:], additionalProperties: Bool? = nil) {
        self.type = type; self.identity = identity; self.required = required; self.properties = properties; self.additionalProperties = additionalProperties
    }

    private enum CodingKeys: String, CodingKey { case type, identity, required, properties, additionalProperties }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        type = try values.decodeIfPresent(String.self, forKey: .type)
        identity = try values.decodeIfPresent([String].self, forKey: .identity) ?? []
        required = try values.decodeIfPresent([String].self, forKey: .required) ?? []
        properties = try values.decodeIfPresent([String: ResourceFieldSchemaDef].self, forKey: .properties) ?? [:]
        additionalProperties = try values.decodeIfPresent(Bool.self, forKey: .additionalProperties)
    }
}

public final class ResourceFieldSchemaDef: Codable, @unchecked Sendable {
    public let type: String?
    public let ref: String?
    public let format: String?
    public let nullable: Bool
    public let readOnly: Bool
    public let writeOnly: Bool
    public let enumValues: [JSONValue]
    public let defaultValue: JSONValue?
    public let minimum: Double?
    public let maximum: Double?
    public let minLength: Int?
    public let maxLength: Int?
    public let minItems: Int?
    public let maxItems: Int?
    public let items: ResourceFieldSchemaDef?
    public let required: [String]
    public let properties: [String: ResourceFieldSchemaDef]

    private enum CodingKeys: String, CodingKey { case type, ref = "$ref", format, nullable, readOnly, writeOnly, enumValues = "enum", defaultValue = "default", minimum, maximum, minLength, maxLength, minItems, maxItems, items, required, properties }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        type = try values.decodeIfPresent(String.self, forKey: .type); ref = try values.decodeIfPresent(String.self, forKey: .ref); format = try values.decodeIfPresent(String.self, forKey: .format)
        nullable = try values.decodeIfPresent(Bool.self, forKey: .nullable) ?? false; readOnly = try values.decodeIfPresent(Bool.self, forKey: .readOnly) ?? false; writeOnly = try values.decodeIfPresent(Bool.self, forKey: .writeOnly) ?? false
        enumValues = try values.decodeIfPresent([JSONValue].self, forKey: .enumValues) ?? []; defaultValue = try values.decodeIfPresent(JSONValue.self, forKey: .defaultValue)
        minimum = try values.decodeIfPresent(Double.self, forKey: .minimum); maximum = try values.decodeIfPresent(Double.self, forKey: .maximum); minLength = try values.decodeIfPresent(Int.self, forKey: .minLength); maxLength = try values.decodeIfPresent(Int.self, forKey: .maxLength); minItems = try values.decodeIfPresent(Int.self, forKey: .minItems); maxItems = try values.decodeIfPresent(Int.self, forKey: .maxItems)
        items = try values.decodeIfPresent(ResourceFieldSchemaDef.self, forKey: .items); required = try values.decodeIfPresent([String].self, forKey: .required) ?? []; properties = try values.decodeIfPresent([String: ResourceFieldSchemaDef].self, forKey: .properties) ?? [:]
    }
}

public struct ResourceModelDef: Codable, Sendable {
    public let schemaRef: String
    public let read: ResourceReadBindingDef?
    public let write: ResourceWriteBindingDef?
    public let fields: [String: ResourceFieldBindingDef]
    public let hooks: ResourceModelHooksDef?

    private enum CodingKeys: String, CodingKey { case schemaRef, read, write, fields, hooks }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        schemaRef = try values.decode(String.self, forKey: .schemaRef); read = try values.decodeIfPresent(ResourceReadBindingDef.self, forKey: .read); write = try values.decodeIfPresent(ResourceWriteBindingDef.self, forKey: .write); fields = try values.decodeIfPresent([String: ResourceFieldBindingDef].self, forKey: .fields) ?? [:]; hooks = try values.decodeIfPresent(ResourceModelHooksDef.self, forKey: .hooks)
    }
}

public struct ResourceReadBindingDef: Codable, Sendable { public let dataSourceRef: String?; public let preserveUnbound: Bool? }
public struct ResourceWriteBindingDef: Codable, Sendable { public let dataSourceRef: String?; public let inputPath: String?; public let mode: String?; public let collection: Bool? }
public struct ResourceFieldBindingDef: Codable, Sendable {
    public let read: String?; public let write: String?; public let codec: String?; public let trim: Bool?; public let empty: String?; public let defaultValue: JSONValue?; public let alwaysWrite: Bool?; public let omitIfUnchanged: Bool?; public let modelRef: String?; public let collection: ResourceCollectionBindingDef?
    private enum CodingKeys: String, CodingKey { case read, write, codec, trim, empty, defaultValue = "default", alwaysWrite, omitIfUnchanged, modelRef, collection }
}
public struct ResourceCollectionBindingDef: Codable, Sendable { public let modelRef: String?; public let identity: [String]?; public let clientKey: String?; public let mode: String?; public let preserveOrder: Bool? }
public struct ResourceModelHooksDef: Codable, Sendable { public let beforeUnmarshal: String?; public let afterUnmarshal: String?; public let beforeMarshal: String?; public let afterMarshal: String? }

public struct ResourceValueSourceDef: Codable, Sendable {
    public let scope: String?; public let dataSourceRef: String?; public let selector: String?; public let value: JSONValue?; public let `where`: ResourceValueFilterDef?; public let mapSelector: String?; public let codec: String?
}
public struct ResourceValueFilterDef: Codable, Sendable { public let field: String; public let equals: JSONValue?; public let notEquals: JSONValue?; public let inValues: [JSONValue]?; private enum CodingKeys: String, CodingKey { case field, equals, notEquals, inValues = "in" } }
public struct ResourcePayloadPreparationDef: Codable, Sendable {
    public let modelRef: String
    public let source: ResourceValueSourceDef?
    public let fields: [String: ResourceValueSourceDef]?
    public let baseline: ResourceValueSourceDef?
    public let mode: String?
    public let target: String?
}
