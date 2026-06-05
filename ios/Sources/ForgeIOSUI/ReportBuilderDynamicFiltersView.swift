import SwiftUI
import UIKit
import ForgeIOSRuntime

struct ReportBuilderDynamicFiltersView: View {
    let groups: [ReportBuilderDynamicFilterGroupDef]
    let families: [ReportBuilderDynamicFilterFamilyDef]
    let unifiedFamilyRows: Bool
    let rowsByGroupID: [String: [ReportBuilderDynamicRowState]]
    let drafts: [String: String]
    let isLookupAvailable: (String, ReportBuilderDynamicFilterDef) -> Bool
    let onAddRow: (String, String) -> Void
    let onChangeFilter: (String, String, String) -> Void
    let onMoveRow: (String, String, String, String, Bool) -> Void
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

        if unifiedFamilyRows {
            unifiedFamilyCard(family)
        } else {
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
    }

    @ViewBuilder
    private func unifiedFamilyCard(_ family: ReportBuilderDynamicFilterFamilyDef) -> some View {
        let options = familyOptions(family)
        let rows = familyRows(family, options: options)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(family.label ?? family.identityKey)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    if let description = family.description, !description.isEmpty {
                        Text(description)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if let option = options.first, let target = option.includeFilter ?? option.excludeFilter {
                    Button {
                        onAddRow(option.includeFilter == nil ? "exclude" : "include", target.identityKey)
                    } label: {
                        Label("Add line", systemImage: "plus.circle.fill")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color(red: 0.15, green: 0.31, blue: 0.56))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Color(red: 0.96, green: 0.98, blue: 1.0), in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(red: 0.79, green: 0.84, blue: 0.95), lineWidth: 1))
                }
            }

            ForEach(rows) { item in
                unifiedFamilyRow(item, options: options)
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func unifiedFamilyRow(_ item: DynamicFamilyRow, options: [DynamicFamilyOption]) -> some View {
        if let option = options.first(where: { $0.key == item.optionKey }) ?? options.first,
           let selectedFilter = item.direction == "exclude" ? option.excludeFilter ?? option.includeFilter : option.includeFilter ?? option.excludeFilter {
            let row = item.row
            let lookupAvailable = isLookupAvailable(item.direction, selectedFilter)
            let manualDraft = drafts[row.id] ?? ""
            let canAddManualValue = selectedFilter.manualEntry == true && !manualDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 8) {
                    Menu {
                        ForEach(options) { candidate in
                            Button(candidate.label) {
                                changeFamilyFilter(row: row, currentDirection: item.direction, option: candidate)
                            }
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text(option.label)
                                .font(.caption.weight(.medium))
                                .lineLimit(1)
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(Color(red: 0.19, green: 0.25, blue: 0.30))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(Color(red: 0.96, green: 0.98, blue: 1.0), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 0.79, green: 0.84, blue: 0.95), lineWidth: 1))
                    }

                    directionToggle(row: row, option: option, currentDirection: item.direction)
                }

                lookupInput(
                    groupID: item.direction,
                    row: row,
                    selectedFilter: selectedFilter,
                    lookupAvailable: lookupAvailable,
                    canAddManualValue: canAddManualValue,
                    manualDraft: manualDraft
                )

                HStack(spacing: 8) {
                    Button {
                        onToggleEnabled(item.direction, row.id)
                    } label: {
                        Label(row.enabled ? "On" : "Off", systemImage: row.enabled ? "eye" : "eye.slash")
                            .font(.caption.weight(.medium))
                    }
                    .buttonStyle(.bordered)

                    Button(role: .destructive) {
                        onRemoveRow(item.direction, row.id)
                    } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Remove \(selectedFilter.label ?? selectedFilter.identityKey)")
                }
            }
            .padding(10)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(red: 0.85, green: 0.89, blue: 0.93), lineWidth: 1))
            .opacity(row.enabled ? 1 : 0.6)
        }
    }

    private func directionToggle(row: ReportBuilderDynamicRowState, option: DynamicFamilyOption, currentDirection: String) -> some View {
        HStack(spacing: 0) {
            directionButton("Include", active: currentDirection == "include", disabled: option.includeFilter == nil) {
                moveFamilyRow(row: row, currentDirection: currentDirection, nextDirection: "include", option: option, resetSelections: false)
            }
            directionButton("Exclude", active: currentDirection == "exclude", disabled: option.excludeFilter == nil) {
                moveFamilyRow(row: row, currentDirection: currentDirection, nextDirection: "exclude", option: option, resetSelections: false)
            }
        }
        .padding(2)
        .background(Color(red: 0.96, green: 0.98, blue: 1.0), in: Capsule())
        .overlay(Capsule().stroke(Color(red: 0.83, green: 0.88, blue: 0.94), lineWidth: 1))
    }

    private func directionButton(_ title: String, active: Bool, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(active ? Color.white : Color(red: 0.34, green: 0.42, blue: 0.50))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(active ? Color(red: 0.18, green: 0.43, blue: 0.88) : Color.clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }

    private func lookupInput(
        groupID: String,
        row: ReportBuilderDynamicRowState,
        selectedFilter: ReportBuilderDynamicFilterDef,
        lookupAvailable: Bool,
        canAddManualValue: Bool,
        manualDraft: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
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
                        .frame(maxWidth: 180)
                    } else {
                        Text(selectedFilter.manualPlaceholder?.isEmpty == false ? selectedFilter.manualPlaceholder! : "Select value")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: 180, alignment: .leading)
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
                            .frame(width: 28, height: 28)
                            .foregroundStyle(.white)
                            .background(Color(red: 0.09, green: 0.47, blue: 0.31), in: Circle())
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
                selectionChips(row: row, groupID: groupID)
            }
        }
    }

    private func selectionChips(row: ReportBuilderDynamicRowState, groupID: String) -> some View {
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

    private func familyOptions(_ family: ReportBuilderDynamicFilterFamilyDef) -> [DynamicFamilyOption] {
        let includeByID = Dictionary(uniqueKeysWithValues: (groupsByID["include"]?.filters ?? []).map { ($0.identityKey, $0) })
        let excludeByID = Dictionary(uniqueKeysWithValues: (groupsByID["exclude"]?.filters ?? []).map { ($0.identityKey, $0) })
        var options: [String: DynamicFamilyOption] = [:]
        var order: [String] = []

        func register(direction: String, filterID: String, index: Int) {
            let filter = direction == "include" ? includeByID[filterID] : excludeByID[filterID]
            guard let filter else { return }
            let key = filter.targetingFeatureKey?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? filter.targetingFeatureKey!.trimmingCharacters(in: .whitespacesAndNewlines)
                : "pair:\(index)"
            if options[key] == nil {
                order.append(key)
                options[key] = DynamicFamilyOption(
                    key: key,
                    label: filter.label ?? key,
                    includeFilter: nil,
                    excludeFilter: nil
                )
            }
            if direction == "include" {
                options[key]?.includeFilter = filter
            } else {
                options[key]?.excludeFilter = filter
            }
        }

        for (index, filterID) in family.includeFilterIds.enumerated() {
            register(direction: "include", filterID: filterID, index: index)
        }
        for (index, filterID) in family.excludeFilterIds.enumerated() {
            register(direction: "exclude", filterID: filterID, index: index)
        }
        return order.compactMap { options[$0] }
    }

    private func familyRows(_ family: ReportBuilderDynamicFilterFamilyDef, options: [DynamicFamilyOption]) -> [DynamicFamilyRow] {
        let includeIDs = Set(family.includeFilterIds)
        let excludeIDs = Set(family.excludeFilterIds)
        let includeRows = (rowsByGroupID["include"] ?? [])
            .filter { includeIDs.contains($0.filterId) }
            .map { row in
                DynamicFamilyRow(
                    row: row,
                    direction: "include",
                    optionKey: options.first(where: { $0.includeFilter?.identityKey == row.filterId })?.key ?? ""
                )
            }
        let excludeRows = (rowsByGroupID["exclude"] ?? [])
            .filter { excludeIDs.contains($0.filterId) }
            .map { row in
                DynamicFamilyRow(
                    row: row,
                    direction: "exclude",
                    optionKey: options.first(where: { $0.excludeFilter?.identityKey == row.filterId })?.key ?? ""
                )
            }
        return includeRows + excludeRows
    }

    private func changeFamilyFilter(row: ReportBuilderDynamicRowState, currentDirection: String, option: DynamicFamilyOption) {
        let targetDirection = currentDirection == "include"
            ? (option.includeFilter != nil ? "include" : "exclude")
            : (option.excludeFilter != nil ? "exclude" : "include")
        guard let targetFilter = targetDirection == "include" ? option.includeFilter : option.excludeFilter else {
            return
        }
        if targetDirection == currentDirection {
            onChangeFilter(currentDirection, row.id, targetFilter.identityKey)
        } else {
            onMoveRow(currentDirection, row.id, targetDirection, targetFilter.identityKey, true)
        }
    }

    private func moveFamilyRow(
        row: ReportBuilderDynamicRowState,
        currentDirection: String,
        nextDirection: String,
        option: DynamicFamilyOption,
        resetSelections: Bool
    ) {
        guard currentDirection != nextDirection else { return }
        let targetFilter = nextDirection == "include" ? option.includeFilter : option.excludeFilter
        guard let targetFilter else { return }
        onMoveRow(currentDirection, row.id, nextDirection, targetFilter.identityKey, resetSelections)
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

private struct DynamicFamilyOption: Identifiable {
    let key: String
    var label: String
    var includeFilter: ReportBuilderDynamicFilterDef?
    var excludeFilter: ReportBuilderDynamicFilterDef?

    var id: String { key }
}

private struct DynamicFamilyRow: Identifiable {
    let row: ReportBuilderDynamicRowState
    let direction: String
    let optionKey: String

    var id: String { row.id }
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
