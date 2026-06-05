import SwiftUI
import UIKit
import ForgeIOSRuntime

struct ReportBuilderDynamicFiltersView: View {
    let groups: [ReportBuilderDynamicFilterGroupDef]
    let families: [ReportBuilderDynamicFilterFamilyDef]
    let rowsByGroupID: [String: [ReportBuilderDynamicRowState]]
    let drafts: [String: String]
    let isLookupAvailable: (String, ReportBuilderDynamicFilterDef) -> Bool
    let onAddRow: (String, String) -> Void
    let onChangeFilter: (String, String, String) -> Void
    let onToggleEnabled: (String, String) -> Void
    let onRemoveRow: (String, String) -> Void
    let onDraftChange: (String, String) -> Void
    let onAddManualSelection: (String, String, ReportBuilderDynamicFilterDef, String) -> Bool
    let onRemoveSelection: (String, String, Int) -> Void
    let onPickSelection: (String, String, ReportBuilderDynamicFilterDef) -> Void

    private var groupsByID: [String: ReportBuilderDynamicFilterGroupDef] {
        Dictionary(uniqueKeysWithValues: groups.map { ($0.identityKey, $0) })
    }

    var body: some View {
        if groups.isEmpty && families.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("Advanced filters")
                    .font(.subheadline.weight(.semibold))
                Text("Add one filter line at a time. Committed values become request parameters for the report datasource.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !families.isEmpty {
                    ForEach(families, id: \.identityKey) { family in
                        familyCard(family)
                    }
                } else {
                    ForEach(groups, id: \.identityKey) { group in
                        groupSection(
                            groupID: group.identityKey,
                            title: group.label ?? group.identityKey,
                            description: group.description,
                            filters: group.filters
                        )
                    }
                }
            }
            .padding()
            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    @ViewBuilder
    private func familyCard(_ family: ReportBuilderDynamicFilterFamilyDef) -> some View {
        let includeGroup = groupsByID["include"]
        let excludeGroup = groupsByID["exclude"]
        let includeFilters = includeGroup?.filters.filter { family.includeFilterIds.contains($0.id ?? "") } ?? []
        let excludeFilters = excludeGroup?.filters.filter { family.excludeFilterIds.contains($0.id ?? "") } ?? []

        VStack(alignment: .leading, spacing: 10) {
            Text(family.label ?? family.identityKey)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            if let description = family.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if !includeFilters.isEmpty {
                groupSection(groupID: "include", title: "Include", description: nil, filters: includeFilters)
            }
            if !excludeFilters.isEmpty {
                groupSection(groupID: "exclude", title: "Exclude", description: nil, filters: excludeFilters)
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func groupSection(
        groupID: String,
        title: String,
        description: String?,
        filters: [ReportBuilderDynamicFilterDef]
    ) -> some View {
        let rows = (rowsByGroupID[groupID] ?? []).filter { row in
            filters.contains(where: { $0.identityKey == row.filterId })
        }
        let defaultFilterID = filters.first?.identityKey ?? ""

        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    if let description, !description.isEmpty {
                        Text(description)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if !defaultFilterID.isEmpty {
                    Button {
                        onAddRow(groupID, defaultFilterID)
                    } label: {
                        Label("Add line", systemImage: "plus")
                            .font(.caption.weight(.medium))
                    }
                    .buttonStyle(.plain)
                }
            }

            ForEach(rows) { row in
                filterRow(
                    groupID: groupID,
                    row: row,
                    availableFilters: filters
                )
            }
        }
    }

    @ViewBuilder
    private func filterRow(
        groupID: String,
        row: ReportBuilderDynamicRowState,
        availableFilters: [ReportBuilderDynamicFilterDef]
    ) -> some View {
        if let selectedFilter = availableFilters.first(where: { $0.identityKey == row.filterId }) ?? availableFilters.first {
            let lookupAvailable = isLookupAvailable(groupID, selectedFilter)
            let manualDraft = drafts[row.id] ?? ""
            let canAddManualValue = selectedFilter.manualEntry == true && !manualDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Menu {
                        ForEach(availableFilters, id: \.identityKey) { filter in
                            Button(filter.label ?? filter.identityKey) {
                                onChangeFilter(groupID, row.id, filter.identityKey)
                            }
                        }
                    } label: {
                        Text(selectedFilter.label ?? selectedFilter.identityKey)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                    }
                    Button {
                        onToggleEnabled(groupID, row.id)
                    } label: {
                        Image(systemName: row.enabled ? "eye" : "eye.slash")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel(row.enabled ? "Disable filter row" : "Enable filter row")

                    Button {
                        onRemoveRow(groupID, row.id)
                    } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Remove \(selectedFilter.label ?? selectedFilter.identityKey)")
                }

                if selectedFilter.manualEntry == true || lookupAvailable {
                    HStack(spacing: 4) {
                        if selectedFilter.manualEntry == true {
                            TextField(
                                selectedFilter.manualPlaceholder?.isEmpty == false ? selectedFilter.manualPlaceholder! : "Enter value",
                                text: Binding(
                                    get: { drafts[row.id] ?? "" },
                                    set: { onDraftChange(row.id, $0) }
                                )
                            )
                            .textFieldStyle(.plain)
                            .keyboardType(keyboardType(for: selectedFilter))
                            .onSubmit {
                                _ = onAddManualSelection(
                                    groupID,
                                    row.id,
                                    selectedFilter,
                                    manualDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                                )
                            }
                            .frame(width: 160)
                        } else {
                            Text(selectedFilter.manualPlaceholder?.isEmpty == false ? selectedFilter.manualPlaceholder! : "Select value")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                                .frame(width: 160, alignment: .leading)
                        }

                        Button {
                            if lookupAvailable {
                                onPickSelection(groupID, row.id, selectedFilter)
                            } else {
                                _ = onAddManualSelection(
                                    groupID,
                                    row.id,
                                    selectedFilter,
                                    manualDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                                )
                            }
                        } label: {
                            Image(systemName: lookupAvailable ? "chevron.down" : "plus")
                                .font(.caption.weight(.semibold))
                                .frame(width: 26, height: 26)
                                .foregroundStyle(.white)
                                .background(Color(red: 0.06, green: 0.39, blue: 0.24), in: Circle())
                                .overlay(Circle().stroke(Color(red: 0.05, green: 0.34, blue: 0.21), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .disabled(!lookupAvailable && !canAddManualValue)
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 4)
                    .padding(.vertical, 3)
                    .background(Color(red: 0.93, green: 0.98, blue: 0.95), in: Capsule())
                    .overlay(Capsule().stroke(Color(red: 0.81, green: 0.88, blue: 0.84), lineWidth: 1))
                    .foregroundStyle(Color(red: 0.12, green: 0.23, blue: 0.17))
                }

                if !row.selections.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Array(row.selections.enumerated()), id: \.offset) { index, selection in
                                Button {
                                    onRemoveSelection(groupID, row.id, index)
                                } label: {
                                    HStack(spacing: 6) {
                                        Text(selection.label.isEmpty ? selection.value.displayText : selection.label)
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.caption)
                                    }
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .foregroundStyle(Color(red: 0.46, green: 0.34, blue: 0.0))
                                    .background(Color(red: 1.0, green: 0.97, blue: 0.85), in: Capsule())
                                    .overlay(Capsule().stroke(Color(red: 0.89, green: 0.79, blue: 0.42), lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .opacity(row.enabled ? 1 : 0.6)
        }
    }

    private func keyboardType(for filter: ReportBuilderDynamicFilterDef) -> UIKeyboardType {
        let valueType = (filter.manualValueType ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch valueType {
        case "int", "integer":
            return .numberPad
        default:
            return .default
        }
    }
}

private extension JSONValue {
    var displayText: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(format: value.rounded(.towardZero) == value ? "%.0f" : "%g", value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let value):
            return value.map(\.displayText).joined(separator: ", ")
        case .object:
            return "{...}"
        case .null:
            return ""
        }
    }
}
