import Foundation
import JavaScriptCore

public enum ActionHookRuntimeError: Error, LocalizedError {
    case invalidModule
    case missingFunction(String)
    case exception(String)
    case unsupportedResult(String)

    public var errorDescription: String? {
        switch self {
        case .invalidModule:
            return "Hook module did not evaluate to an object."
        case .missingFunction(let name):
            return "Hook function '\(name)' was not found."
        case .exception(let message):
            return "Hook execution failed: \(message)"
        case .unsupportedResult(let detail):
            return "Hook returned an unsupported value: \(detail)"
        }
    }
}

public enum ActionHookRuntime {
    public static func invoke(
        code: String,
        functionName: String,
        props: JSONValue = .object([:])
    ) throws -> JSONValue? {
        let context = JSContext()
        var capturedError: ActionHookRuntimeError?
        context?.exceptionHandler = { _, exception in
            let message = exception?.toString() ?? "Unknown JavaScript error"
            capturedError = .exception(message)
        }
        guard let module = context?.evaluateScript(code) else {
            throw capturedError ?? .invalidModule
        }
        if let capturedError {
            throw capturedError
        }
        let fn = module.forProperty(functionName)
        guard let fn, !fn.isUndefined else {
            throw ActionHookRuntimeError.missingFunction(functionName)
        }
        let argument = JSValue(object: foundationValue(from: props), in: context)
        let result = fn.call(withArguments: argument.map { [$0] } ?? [])
        if let capturedError {
            throw capturedError
        }
        guard let result, !result.isUndefined, !result.isNull else {
            return nil
        }
        return try jsonValue(from: result)
    }

    private static func foundationValue(from value: JSONValue) -> Any {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .array(let values):
            return values.map(foundationValue(from:))
        case .object(let values):
            return values.mapValues(foundationValue(from:))
        case .null:
            return NSNull()
        }
    }

    private static func jsonValue(from value: JSValue) throws -> JSONValue {
        guard let object = value.toObject() else {
            return .null
        }
        return try jsonValue(fromAny: object)
    }

    private static func jsonValue(fromAny value: Any) throws -> JSONValue {
        switch value {
        case is NSNull:
            return .null
        case let string as String:
            return .string(string)
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let array as [Any]:
            return .array(try array.map(jsonValue(fromAny:)))
        case let dict as [String: Any]:
            return .object(try dict.mapValues(jsonValue(fromAny:)))
        default:
            throw ActionHookRuntimeError.unsupportedResult(String(describing: type(of: value)))
        }
    }
}
