import SwiftUI
import ForgeIOSRuntime

struct NativeTreeChoices: View {
    let options: [(JSONValue, String)]
    let selected: [JSONValue]
    let separator: String
    let enabled: Bool
    let onChange: ([JSONValue]) -> Void
    var depth: Int = 0
    private var groups: [(String, [(JSONValue, String)])] {
        var keys: [String] = []; var result: [String: [(JSONValue, String)]] = [:]
        for option in options {
            let parts = NativeWidgetContract.text(option.0).components(separatedBy: separator.isEmpty ? "_" : separator)
            let key = parts.indices.contains(depth) ? parts[depth] : option.1
            if result[key] == nil { keys.append(key) }
            result[key, default: []].append(option)
        }
        return keys.map { ($0, result[$0]!) }
    }
    var body: some View {
        ForEach(groups.indices, id: \.self) { index in
            let group = groups[index]
            let branch = group.1.contains { NativeWidgetContract.text($0.0).components(separatedBy: separator.isEmpty ? "_" : separator).count > depth + 1 }
            if branch {
                DisclosureGroup {
                    Toggle("Select all \(group.0)", isOn: Binding(get: { group.1.allSatisfy { option in selected.contains { NativeWidgetContract.equivalent($0, option.0) } } }, set: { checked in
                        let values = group.1.map(\.0)
                        onChange(checked ? selected + values.filter { value in !selected.contains { NativeWidgetContract.equivalent($0, value) } } : selected.filter { selectedValue in !values.contains { NativeWidgetContract.equivalent($0, selectedValue) } })
                    })).disabled(!enabled)
                    AnyView(NativeTreeChoices(options: group.1, selected: selected, separator: separator, enabled: enabled, onChange: onChange, depth: depth + 1))
                } label: { Text(group.0) }
            } else {
                ForEach(group.1.indices, id: \.self) { leaf in
                    let option = group.1[leaf]
                    Toggle(option.1, isOn: Binding(get: { selected.contains { NativeWidgetContract.equivalent($0, option.0) } }, set: { checked in onChange(checked ? selected + (selected.contains { NativeWidgetContract.equivalent($0, option.0) } ? [] : [option.0]) : selected.filter { !NativeWidgetContract.equivalent($0, option.0) }) })).disabled(!enabled)
                }
            }
        }
    }
}
