import Foundation

public enum MetadataResolver {
    public static func resolve(
        _ metadata: WindowMetadata,
        for targetContext: ForgeTargetContext
    ) -> WindowMetadata {
        guard
            let json = try? JSONEncoder().encode(metadata),
            let raw = try? JSONDecoder().decode(JSONValue.self, from: json),
            let resolved = resolveValue(raw, for: targetContext),
            let resolvedJSON = try? JSONEncoder().encode(resolved),
            let decoded = try? JSONDecoder().decode(WindowMetadata.self, from: resolvedJSON)
        else {
            return metadata
        }
        return decoded
    }

    private static func resolveValue(_ value: JSONValue, for targetContext: ForgeTargetContext) -> JSONValue? {
        switch value {
        case .array(let items):
            return .array(items.compactMap { resolveValue($0, for: targetContext) })
        case .object(let object):
            return resolveObject(object, for: targetContext)
        default:
            return value
        }
    }

    private static func resolveObject(
        _ object: [String: JSONValue],
        for targetContext: ForgeTargetContext
    ) -> JSONValue? {
        if !matchesTarget(object["target"], for: targetContext) {
            return nil
        }

        var working = object
        for override in applicableOverrides(object["targetOverrides"], for: targetContext) {
            working = deepMerge(base: working, override: override)
        }

        var result: [String: JSONValue] = [:]
        for (key, value) in working {
            if shouldStripTargetingKey(key, value) {
                continue
            }
            if let resolved = resolveValue(value, for: targetContext) {
                result[key] = resolved
            }
        }
        return .object(result)
    }

    private static func applicableOverrides(
        _ raw: JSONValue?,
        for targetContext: ForgeTargetContext
    ) -> [[String: JSONValue]] {
        guard case .object(let object)? = raw else {
            return []
        }

        let keys = targetOverrideKeys(for: targetContext)

        var result: [[String: JSONValue]] = []
        var seen = Set<String>()
        for key in keys where seen.insert(key).inserted {
            guard case .object(let override)? = object[key] else {
                continue
            }
            result.append(override)
        }
        return result
    }

    private static func targetOverrideKeys(for targetContext: ForgeTargetContext) -> [String] {
        let platform = targetContext.platform.trimmingCharacters(in: .whitespacesAndNewlines)
        let formFactor = targetContext.formFactor.trimmingCharacters(in: .whitespacesAndNewlines)
        let surface = targetContext.surface.trimmingCharacters(in: .whitespacesAndNewlines)
        let mobilePlatforms: Set<String> = ["android", "ios"]
        let mobileFormFactors: Set<String> = ["phone", "tablet"]
        let isMobile = mobilePlatforms.contains(platform) || mobileFormFactors.contains(formFactor)
        var keys: [String] = []

        if !surface.isEmpty {
            keys.append("surface:\(surface)")
            keys.append(surface)
        }
        if isMobile {
            keys.append("mobile")
        }
        if !formFactor.isEmpty {
            keys.append("formFactor:\(formFactor)")
            keys.append(formFactor)
        }
        if !platform.isEmpty {
            keys.append(platform)
        }
        if isMobile && !formFactor.isEmpty {
            keys.append("mobile.\(formFactor)")
            keys.append("mobile:\(formFactor)")
            keys.append("mobile/\(formFactor)")
        }
        if !platform.isEmpty && !formFactor.isEmpty {
            keys.append("\(platform).\(formFactor)")
            keys.append("\(platform)/\(formFactor)")
            keys.append("\(platform):\(formFactor)")
        }
        return keys
    }

    private static func matchesTarget(_ raw: JSONValue?, for targetContext: ForgeTargetContext) -> Bool {
        guard let spec = normalizeTarget(raw) else {
            return true
        }

        if !spec.platforms.isEmpty && !spec.platforms.contains(targetContext.platform) {
            return false
        }
        if !spec.excludePlatforms.isEmpty && spec.excludePlatforms.contains(targetContext.platform) {
            return false
        }
        if !spec.formFactors.isEmpty && !spec.formFactors.contains(targetContext.formFactor) {
            return false
        }
        if !spec.capabilities.isEmpty {
            let actual = Set(targetContext.capabilities)
            if !Set(spec.capabilities).isSubset(of: actual) {
                return false
            }
        }
        return true
    }

    private static func normalizeTarget(_ raw: JSONValue?) -> NormalizedTarget? {
        switch raw {
        case nil, .null:
            return nil
        case .string(let value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : NormalizedTarget(platforms: [trimmed])
        case .array(let values):
            return normalizedTargetOrNil(NormalizedTarget(platforms: stringList(.array(values))))
        case .object(let object):
            return normalizedTargetOrNil(
                NormalizedTarget(
                    platforms: stringList(object["platforms"]),
                    excludePlatforms: stringList(object["excludePlatforms"]),
                    formFactors: stringList(object["formFactors"]),
                    capabilities: stringList(object["capabilities"])
                )
            )
        default:
            return nil
        }
    }

    private static func normalizedTargetOrNil(_ target: NormalizedTarget) -> NormalizedTarget? {
        guard
            !target.platforms.isEmpty ||
            !target.excludePlatforms.isEmpty ||
            !target.formFactors.isEmpty ||
            !target.capabilities.isEmpty
        else {
            return nil
        }
        return target
    }

    private static func shouldStripTargetingKey(_ key: String, _ value: JSONValue) -> Bool {
        switch key {
        case "target":
            return normalizeTarget(value) != nil
        case "targetOverrides":
            guard case .object(let object) = value else {
                return false
            }
            return !object.isEmpty && object.values.allSatisfy {
                if case .object = $0 {
                    return true
                }
                return false
            }
        default:
            return false
        }
    }

    private static func stringList(_ raw: JSONValue?) -> [String] {
        switch raw {
        case .string(let value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? [] : [trimmed]
        case .array(let values):
            return values.compactMap {
                guard case .string(let value) = $0 else { return nil }
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                return trimmed.isEmpty ? nil : trimmed
            }
        default:
            return []
        }
    }

    private static func deepMerge(
        base: [String: JSONValue],
        override: [String: JSONValue]
    ) -> [String: JSONValue] {
        var result = base
        for (key, overrideValue) in override {
            if
                case .object(let currentObject)? = result[key],
                case .object(let overrideObject) = overrideValue
            {
                result[key] = .object(deepMerge(base: currentObject, override: overrideObject))
            } else {
                result[key] = overrideValue
            }
        }
        return result
    }
}

private struct NormalizedTarget {
    let platforms: [String]
    let excludePlatforms: [String]
    let formFactors: [String]
    let capabilities: [String]

    init(
        platforms: [String] = [],
        excludePlatforms: [String] = [],
        formFactors: [String] = [],
        capabilities: [String] = []
    ) {
        self.platforms = platforms
        self.excludePlatforms = excludePlatforms
        self.formFactors = formFactors
        self.capabilities = capabilities
    }
}
