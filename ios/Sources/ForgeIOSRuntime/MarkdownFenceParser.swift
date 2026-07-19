import Foundation

public enum MarkdownFencePart: Equatable, Sendable {
    case text(String)
    case fence(raw: String, language: String, header: String, body: String, closed: Bool)
}

/// Framework-neutral markdown fence segmentation for Forge hosts.
public enum MarkdownFenceParser {
    private static let marker = "```"

    public static func parse(_ content: String) -> [MarkdownFencePart] {
        guard !content.isEmpty else { return [] }
        var parts: [MarkdownFencePart] = []
        var cursor = content.startIndex
        while cursor < content.endIndex {
            guard let opening = content.range(of: marker, range: cursor..<content.endIndex) else {
                appendText(&parts, String(content[cursor...]))
                break
            }
            if opening.lowerBound > cursor { appendText(&parts, String(content[cursor..<opening.lowerBound])) }
            let languageStart = opening.upperBound
            var languageEnd = languageStart
            while languageEnd < content.endIndex, isLanguageCharacter(content[languageEnd]) {
                languageEnd = content.index(after: languageEnd)
            }
            guard let envelope = headerAndBodyStart(in: content, after: languageEnd) else {
                appendText(&parts, marker)
                cursor = languageStart
                continue
            }
            let language = String(content[languageStart..<languageEnd]).lowercased()
            guard let closing = closingMarker(in: content, from: envelope.bodyStart) else {
                parts.append(.fence(raw: String(content[opening.lowerBound...]), language: language, header: envelope.header, body: String(content[envelope.bodyStart...]), closed: false))
                break
            }
            parts.append(.fence(raw: String(content[opening.lowerBound..<closing.upperBound]), language: language, header: envelope.header, body: String(content[envelope.bodyStart..<closing.lowerBound]), closed: true))
            cursor = closing.upperBound
        }
        return parts
    }

    private struct HeaderAndBodyStart { let header: String; let bodyStart: String.Index }
    private static func headerAndBodyStart(in content: String, after index: String.Index) -> HeaderAndBodyStart? {
        guard index < content.endIndex else { return nil }
        switch content[index] {
        case "\n": return HeaderAndBodyStart(header: "", bodyStart: content.index(after: index))
        case "\r":
            let next = content.index(after: index)
            return next < content.endIndex && content[next] == "\n" ? HeaderAndBodyStart(header: "", bodyStart: content.index(after: next)) : nil
        case "{", "[": return HeaderAndBodyStart(header: "", bodyStart: index)
        case " ", "\t":
            var newline = index
            while newline < content.endIndex, content[newline] != "\n", content[newline] != "\r" { newline = content.index(after: newline) }
            guard newline < content.endIndex else { return nil }
            if content[newline] == "\n" { return HeaderAndBodyStart(header: String(content[index..<newline]).trimmingCharacters(in: .whitespaces), bodyStart: content.index(after: newline)) }
            let next = content.index(after: newline)
            guard next < content.endIndex, content[next] == "\n" else { return nil }
            return HeaderAndBodyStart(header: String(content[index..<newline]).trimmingCharacters(in: .whitespaces), bodyStart: content.index(after: next))
        default: return nil
        }
    }
    private static func isLanguageCharacter(_ character: Character) -> Bool { character.isLetter || character.isNumber || character == "_" || character == "+" || character == "-" }

    private static func closingMarker(in content: String, from bodyStart: String.Index) -> Range<String.Index>? {
        var searchStart = bodyStart
        while let candidate = content.range(of: marker, range: searchStart..<content.endIndex) {
            let atLineStart = candidate.lowerBound == content.startIndex || content[content.index(before: candidate.lowerBound)] == "\n"
            let body = String(content[bodyStart..<candidate.lowerBound])
            // Compact JSON fences are emitted without line breaks. Only accept
            // their closing marker once the full body is valid JSON.
            if atLineStart || isValidJSON(body) {
                return candidate
            }
            searchStart = candidate.upperBound
        }
        return nil
    }

    private static func isValidJSON(_ value: String) -> Bool {
        let data = Data(value.trimmingCharacters(in: .whitespacesAndNewlines).utf8)
        return !data.isEmpty && (try? JSONSerialization.jsonObject(with: data)) != nil
    }

    private static func appendText(_ parts: inout [MarkdownFencePart], _ value: String) {
        guard !value.isEmpty else { return }
        if case .text(let existing)? = parts.last { parts[parts.count - 1] = .text(existing + value) } else { parts.append(.text(value)) }
    }
}

/// Parses standard key=value attributes from a fence header without regexes.
public enum MarkdownFenceHeader {
    public static func attributes(_ header: String) -> [String: String] {
        var result: [String: String] = [:]
        var cursor = header.startIndex
        while cursor < header.endIndex {
            while cursor < header.endIndex, header[cursor].isWhitespace { cursor = header.index(after: cursor) }
            let keyStart = cursor
            while cursor < header.endIndex, header[cursor].isLetter || header[cursor].isNumber || header[cursor] == "_" || header[cursor] == "-" { cursor = header.index(after: cursor) }
            guard keyStart < cursor, cursor < header.endIndex, header[cursor] == "=" else { return result }
            let key = String(header[keyStart..<cursor]).lowercased()
            cursor = header.index(after: cursor)
            let value: String
            if cursor < header.endIndex, (header[cursor] == "\"" || header[cursor] == "'") {
                let quote = header[cursor]; cursor = header.index(after: cursor); let start = cursor
                while cursor < header.endIndex, header[cursor] != quote { cursor = header.index(after: cursor) }
                guard cursor < header.endIndex else { return result }
                value = String(header[start..<cursor]); cursor = header.index(after: cursor)
            } else {
                let start = cursor
                while cursor < header.endIndex, !header[cursor].isWhitespace { cursor = header.index(after: cursor) }
                value = String(header[start..<cursor])
            }
            result[key] = value
        }
        return result
    }
}
