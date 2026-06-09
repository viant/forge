import Foundation
import ForgeIOSRuntime

struct LinkResolutionContext {
    var row: [String: JSONValue] = [:]
    var value: JSONValue? = nil
    var form: [String: JSONValue] = [:]
    var metrics: [String: JSONValue] = [:]
    var windowForm: [String: JSONValue] = [:]
}

struct WindowLinkTarget {
    let windowKey: String
    let title: String
    let parameters: [String: JSONValue]
    let inTab: Bool
    let modal: Bool
    let newInstance: Bool
}

enum ResolvedLinkTarget {
    case external(URL)
    case window(WindowLinkTarget)
}

func resolveColumnLinkTargetFromContext(
    column: ColumnDef,
    context: LinkResolutionContext
) -> ResolvedLinkTarget? {
    let type = (column.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard type == "link", let link = column.link else {
        return nil
    }
    let windowKey = (link.windowKey ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let kind = (link.kind ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let fallbackTitle = (context.value?.linkDisplayString ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .nilIfEmpty
        ?? (column.label ?? "").trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        ?? windowKey.nilIfEmpty
        ?? "Open"
    if !windowKey.isEmpty || kind == "window" {
        guard !windowKey.isEmpty else {
            return nil
        }
        return .window(
            WindowLinkTarget(
                windowKey: windowKey,
                title: resolveLinkWindowTitleFromContext(
                    link: link,
                    context: context,
                    fallbackTitle: fallbackTitle
                ),
                parameters: resolveLinkParametersFromContext(link: link, context: context),
                inTab: link.inTab != false,
                modal: link.modal == true,
                newInstance: link.newInstance == true
            )
        )
    }

    let hrefSelector = (link.href ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !hrefSelector.isEmpty else {
        return nil
    }
    let href = linkJSONValue(from: SelectorUtil.resolve(context.row, selector: hrefSelector))?
        .linkDisplayString
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !href.isEmpty,
          let url = URL(string: href) else {
        return nil
    }
    return .external(url)
}

func resolveLinkWindowTitleFromContext(
    link: LinkDef,
    context: LinkResolutionContext,
    fallbackTitle: String
) -> String {
    let template = (link.windowTitleTemplate ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if !template.isEmpty {
        let holder = resolveLinkSourceValue(
            source: (link.windowTitleSource ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased().nilIfEmpty ?? "row",
            selector: "",
            context: context
        )
        let rendered = renderLinkTemplate(template, holder: holder)
        if !rendered.isEmpty {
            return rendered
        }
    }

    let selector = (link.windowTitleSelector ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let source = (link.windowTitleSource ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if !selector.isEmpty || !source.isEmpty {
        let resolved = (
            resolveLinkSourceValue(
            source: source.isEmpty ? "row" : source,
            selector: selector,
            context: context
            )?.linkDisplayString ?? ""
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        if !resolved.isEmpty {
            return resolved
        }
    }

    let explicit = (link.windowTitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if !explicit.isEmpty {
        return explicit
    }
    return fallbackTitle
}

func resolveLinkParametersFromContext(
    link: LinkDef,
    context: LinkResolutionContext
) -> [String: JSONValue] {
    var resolved: [String: JSONValue] = [:]
    for (key, spec) in link.parameters {
        guard let value = resolveLinkParameterValue(spec, context: context) else {
            continue
        }
        resolved[key] = value
    }
    return resolved
}

@discardableResult
func openResolvedWindowLink(
    runtime: ForgeRuntime,
    window: WindowContext,
    link: WindowLinkTarget
) async -> ForgeRuntime.WindowState {
    let currentState = await runtime.windowState(id: window.windowID)
    let replaceHostedWindow =
        currentState?.presentation?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "hosted"
        && currentState?.region?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "chat.top"
        && !link.newInstance
    return await runtime.openWindow(
        key: link.windowKey,
        title: link.title,
        id: replaceHostedWindow ? currentState?.id : nil,
        inTab: link.inTab,
        parameters: link.parameters,
        conversationID: currentState?.conversationID,
        presentation: currentState?.presentation,
        region: currentState?.region,
        workspaceSharePct: currentState?.workspaceSharePct,
        workspaceMinHeight: currentState?.workspaceMinHeight,
        parentKey: currentState?.parentKey,
        isModal: link.modal
    )
}

private func resolveLinkParameterValue(
    _ spec: JSONValue,
    context: LinkResolutionContext
) -> JSONValue? {
    guard let object = spec.objectValue else {
        return spec
    }
    let selector = (
        object["selector"]?.stringValue
            ?? object["field"]?.stringValue
            ?? object["location"]?.stringValue
            ?? ""
        ).trimmingCharacters(in: .whitespacesAndNewlines)
    let explicitSource = (object["source"]?.stringValue ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
    let source: String
    if !explicitSource.isEmpty {
        source = explicitSource
    } else if !selector.isEmpty {
        source = "row"
    } else if object["value"] != nil {
        source = "const"
    } else {
        source = "value"
    }

    let candidate: JSONValue?
    if source == "const" {
        candidate = object["value"]
    } else {
        candidate = resolveLinkSourceValue(source: source, selector: selector, context: context)
    }

    guard let candidate else {
        return nil
    }
    let wrap = (object["wrap"]?.stringValue ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
    if wrap == "array" {
        return .array([candidate])
    }
    return candidate
}

private func resolveLinkSourceValue(
    source: String,
    selector: String,
    context: LinkResolutionContext
) -> JSONValue? {
    switch source {
    case "row":
        if selector.isEmpty {
            return .object(context.row)
        }
        return linkJSONValue(from: SelectorUtil.resolve(context.row, selector: selector))
    case "value":
        if selector.isEmpty {
            return context.value
        }
        return linkJSONValue(from: SelectorUtil.resolve(context.value?.objectValue, selector: selector))
    case "form":
        if selector.isEmpty {
            return .object(context.form)
        }
        return linkJSONValue(from: SelectorUtil.resolve(context.form, selector: selector))
    case "windowform":
        if selector.isEmpty {
            return .object(context.windowForm)
        }
        return linkJSONValue(from: SelectorUtil.resolve(context.windowForm, selector: selector))
    case "metrics":
        if selector.isEmpty {
            return .object(context.metrics)
        }
        return linkJSONValue(from: SelectorUtil.resolve(context.metrics, selector: selector))
    default:
        return selector.isEmpty ? context.value : nil
    }
}

private func renderLinkTemplateValue(
    _ template: String,
    holder: JSONValue?
) -> String {
    var rendered = ""
    let nsTemplate = template as NSString
    let matches = linkTemplateRegex.matches(in: template, range: NSRange(location: 0, length: nsTemplate.length))
    var currentLocation = 0
    for match in matches {
        let fullRange = match.range(at: 0)
        let selectorRange = match.range(at: 1)
        if fullRange.location > currentLocation {
            rendered += nsTemplate.substring(with: NSRange(location: currentLocation, length: fullRange.location - currentLocation))
        }
        let selector = nsTemplate.substring(with: selectorRange).trimmingCharacters(in: .whitespacesAndNewlines)
        let replacement: String
        if selector.isEmpty {
            replacement = ""
        } else if let object = holder?.objectValue {
            replacement = linkJSONValue(from: SelectorUtil.resolve(object, selector: selector))?.linkDisplayString ?? ""
        } else {
            replacement = ""
        }
        rendered += replacement
        currentLocation = fullRange.location + fullRange.length
    }
    if currentLocation < nsTemplate.length {
        rendered += nsTemplate.substring(from: currentLocation)
    }
    return rendered.replacingOccurrences(of: "\\s{2,}", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
}

private func renderLinkTemplate(
    _ template: String,
    holder: JSONValue?
) -> String {
    return renderLinkTemplateValue(template, holder: holder)
}

private func linkJSONValue(from value: Any?) -> JSONValue? {
    switch value {
    case let value as JSONValue:
        return value
    case let value as String:
        return .string(value)
    case let value as Bool:
        return .bool(value)
    case let value as Int:
        return .number(Double(value))
    case let value as Int64:
        return .number(Double(value))
    case let value as Double:
        return .number(value)
    case let value as Float:
        return .number(Double(value))
    case let value as NSNumber:
        return .number(value.doubleValue)
    case let value as [String: JSONValue]:
        return .object(value)
    case let value as [String: Any]:
        let object = value.compactMapValues { linkJSONValue(from: $0) }
        return .object(object)
    case let value as [Any]:
        return .array(value.compactMap(linkJSONValue(from:)))
    default:
        return nil
    }
}

private extension JSONValue {
    var linkDisplayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let value):
            return value.map(\.linkDisplayString).joined(separator: ", ")
        case .object(let value):
            return value.keys.sorted().map { "\($0): \(value[$0]?.linkDisplayString ?? "—")" }.joined(separator: ", ")
        case .null:
            return "—"
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

private let linkTemplateRegex = try! NSRegularExpression(pattern: "\\{\\{\\s*([^}]+?)\\s*\\}\\}")
