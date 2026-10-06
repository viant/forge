import Foundation
import CryptoKit

public let nativeReportDigestProfile = "agently-json-binary64-v1"

public enum NativeReportDigestError: Error { case unsupportedNumber }

/// Shared framed JSON profile. Scope/request equality is checked separately.
public func nativeReportAdmissionDigest(_ value: JSONValue) throws -> String {
    var digest = SHA256()
    func ascii(_ text: String) { digest.update(data: Data(text.utf8)) }
    func string(_ text: String) {
        let bytes = Data(text.utf8)
        ascii("S\(bytes.count):")
        digest.update(data: bytes)
    }
    func emit(_ value: JSONValue) throws {
        switch value {
        case .null: ascii("N")
        case .bool(let value): ascii(value ? "T" : "F")
        case .number(let value):
            guard value.isFinite, !(value.rounded(.towardZero) == value && abs(value) > 9_007_199_254_740_991) else { throw NativeReportDigestError.unsupportedNumber }
            let bits = (value == 0 ? 0.0 : value).bitPattern
            let hex = String(bits, radix: 16)
            ascii("D" + String(repeating: "0", count: 16 - hex.count) + hex)
        case .string(let value): string(value)
        case .array(let values):
            ascii("A\(values.count):")
            for value in values { try emit(value) }
        case .object(let values):
            let keys = values.keys.sorted { $0.utf8.lexicographicallyPrecedes($1.utf8) }
            ascii("O\(keys.count):")
            for key in keys { string(key); try emit(values[key]!) }
        }
    }
    ascii(nativeReportDigestProfile + "\n")
    try emit(value)
    return digest.finalize().map { String(format: "%02x", $0) }.joined()
}
