import Foundation

public enum ParameterResolver {
    public static func resolve(
        parameters: [String: String],
        values: [String: String]
    ) -> [String: String] {
        var resolved: [String: String] = [:]
        for (key, value) in parameters {
            if value.hasPrefix("$"), let replacement = values[String(value.dropFirst())] {
                resolved[key] = replacement
            } else {
                resolved[key] = value
            }
        }
        return resolved
    }
}
