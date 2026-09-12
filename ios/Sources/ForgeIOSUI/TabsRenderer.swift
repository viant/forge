import SwiftUI
import ForgeIOSRuntime

public struct TabsRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let suppressTitle: Bool
    private let authorization: [String: JSONValue]
    @State private var selectedIndex = 0

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, suppressTitle: Bool = false, authorization: [String: JSONValue] = [:]) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.suppressTitle = suppressTitle
        self.authorization = authorization
    }

    private var visibleChildren: [ContainerDef] {
        container.containers.filter { child in
            guard let condition = child.visibleWhen, tabUsesAuthorizationOnly(condition) else { return true }
            return DashboardRuntime.evaluateDashboardCondition(condition, authorization: authorization.mapValues(tabJSONValue))
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !suppressTitle, let title = container.title, !title.isEmpty {
                Text(title)
                    .font(.headline)
            }
            if visibleChildren.count > 3 || (horizontalSizeClass == .compact && visibleChildren.count > 1) {
                CompactSectionNavigator(
                    entries: visibleChildren.enumerated().map { index, child in
                        (id: child.id ?? "tab-\(index)", title: child.title ?? child.id ?? "Tab")
                    },
                    selectedID: selectedContainer?.id ?? "tab-\(clampedSelectedIndex)",
                    onSelect: { selectedID in
                        visibleChildren.enumerated().first(where: { ($0.element.id ?? "tab-\($0.offset)") == selectedID })
                            .map { selectTab(at: $0.offset) }
                    }
                )
            } else if usesMenuStyle {
                Menu {
                    ForEach(Array(visibleChildren.enumerated()), id: \.element.id) { index, child in
                        Button(child.title ?? child.id ?? "Tab") { selectTab(at: index) }
                    }
                } label: {
                    Label(selectedContainer?.title ?? selectedContainer?.id ?? "Tab", systemImage: "chevron.down")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 12))
                }
            } else {
                SectionTabRail(
                    items: visibleChildren.enumerated().map { index, child in
                        SectionTabItem(id: child.id ?? "tab-\(index)", label: child.title ?? child.id ?? "Tab")
                    },
                    selectedID: selectedContainer?.id ?? "tab-\(clampedSelectedIndex)",
                    onSelect: { selectedID in
                        visibleChildren.enumerated().first(where: { ($0.element.id ?? "tab-\($0.offset)") == selectedID })
                            .map { selectTab(at: $0.offset) }
                    }
                )
            }

            if let child = selectedContainer {
                ContainerRenderer(
                    runtime: runtime,
                    window: window,
                    container: child,
                    suppressTitle: true
                )
            }
        }
        .onChange(of: visibleChildren.map(\.id)) { _, _ in
            selectedIndex = resolveInitialTabIndex()
        }
        .onAppear {
            selectedIndex = resolveInitialTabIndex()
        }
    }

    private var clampedSelectedIndex: Int {
        guard !visibleChildren.isEmpty else {
            return 0
        }
        return min(max(selectedIndex, 0), visibleChildren.count - 1)
    }

    private var selectedContainer: ContainerDef? {
        guard visibleChildren.indices.contains(clampedSelectedIndex) else {
            return nil
        }
        return visibleChildren[clampedSelectedIndex]
    }

    private var usesMenuStyle: Bool {
        let style = container.tabs?.style?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        return style == "menu" || style == "dropdown" || style == "picker"
    }

    private func resolveInitialTabIndex() -> Int {
        let requestedId = (container.tabs?.selectedTabId?.isEmpty == false ? container.tabs?.selectedTabId : container.tabs?.defaultSelectedTabId)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let requestedId, !requestedId.isEmpty else {
            return 0
        }
        return visibleChildren.firstIndex(where: { $0.id == requestedId }) ?? 0
    }

    private func selectTab(at index: Int) {
        guard visibleChildren.indices.contains(index) else { return }
        selectedIndex = index
        guard let runtime, let window else { return }
        let child = visibleChildren[index]
        Task {
            await runtime.emitInteraction(
                kind: "feed.tab_changed",
                windowID: window.windowID,
                dataSourceRef: container.dataSourceRef,
                detail: [
                    "containerId": .string(container.id ?? ""),
                    "tabId": .string(child.id ?? "tab-\(index)"),
                    "tabTitle": .string(child.title ?? child.id ?? "Tab \(index + 1)"),
                    "tabIndex": .number(Double(index))
                ]
            )
        }
    }
}

private func tabUsesAuthorizationOnly(_ condition: DashboardConditionDef) -> Bool {
    let source = condition.source?.lowercased()
    let own = condition.field == nil && condition.selector == nil && condition.key == nil
        || source == "authorization"
    return own && condition.all.allSatisfy(tabUsesAuthorizationOnly)
        && condition.any.allSatisfy(tabUsesAuthorizationOnly)
        && (condition.not.map(tabUsesAuthorizationOnly) ?? true)
}

private func tabJSONValue(_ value: JSONValue) -> Any {
    switch value {
    case .string(let value): return value
    case .number(let value): return value
    case .bool(let value): return value
    case .array(let values): return values.map(tabJSONValue)
    case .object(let values): return values.mapValues(tabJSONValue)
    case .null: return NSNull()
    }
}
