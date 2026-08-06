import Foundation

public func lowerReportBuilderPredicates(_ config: DashboardReportBuilderDef) -> DashboardReportBuilderDef {
    guard !config.predicates.isEmpty else { return config }
    let normalizedPredicates = config.predicates.compactMap(normalizePredicate)
    guard !normalizedPredicates.isEmpty else { return config }

    var staticFilters = config.staticFilters
    var staticIds = Set(staticFilters.compactMap { $0.id?.trimmedNonEmpty })
    for predicate in normalizedPredicates where predicate.pinned {
        guard !staticIds.contains(predicate.id) else { continue }
        staticIds.insert(predicate.id)
        staticFilters.append(lowerPinnedPredicate(predicate))
    }

    var dynamicGroups = config.dynamicFilterGroups
    var groupById: [String: ReportBuilderDynamicFilterGroupDef] = Dictionary(
        uniqueKeysWithValues: dynamicGroups.compactMap { group in
            guard let id = group.id?.trimmedNonEmpty else { return nil }
            return (id, group)
        }
    )
    let bucketById: [String: ReportBuilderPredicateBucketDef] = Dictionary(
        uniqueKeysWithValues: config.predicateBuckets.enumerated().compactMap { index, bucket in
            guard let id = bucket.id?.trimmedNonEmpty else { return nil }
            return (
                id,
                ReportBuilderPredicateBucketDef(
                    id: bucket.id,
                    label: bucket.label,
                    description: bucket.description,
                    order: bucket.order ?? Double(index)
                )
            )
        }
    )

    @discardableResult
    func seedGroup(_ groupId: String) -> ReportBuilderDynamicFilterGroupDef? {
        let id = groupId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else { return nil }
        if let existing = groupById[id] {
            return existing
        }
        let bucket = bucketById[id]
        let seeded = ReportBuilderDynamicFilterGroupDef(
            id: id,
            label: bucket?.label?.trimmedNonEmpty ?? defaultGroupLabel(id),
            icon: nil,
            description: bucket?.description?.trimmedNonEmpty,
            filters: []
        )
        dynamicGroups.append(seeded)
        groupById[id] = seeded
        return seeded
    }

    bucketById.values.sorted { ($0.order ?? 0) < ($1.order ?? 0) }.forEach { bucket in
        if let id = bucket.id {
            seedGroup(id)
        }
    }

    var familyMembership: [String: (include: [String], exclude: [String])] = [:]
    func registerFamily(predicate: NormalizedReportBuilderPredicate, direction: NormalizedReportBuilderDirection) {
        guard !predicate.group.isEmpty, !direction.direction.isEmpty, let filterId = direction.filter.id else {
            return
        }
        var membership = familyMembership[predicate.group] ?? (include: [], exclude: [])
        if direction.direction == "include" {
            if !membership.include.contains(filterId) {
                membership.include.append(filterId)
            }
        } else {
            if !membership.exclude.contains(filterId) {
                membership.exclude.append(filterId)
            }
        }
        familyMembership[predicate.group] = membership
    }

    for predicate in normalizedPredicates where !predicate.pinned {
        for direction in predicate.directions {
            guard let group = seedGroup(direction.groupId), let groupId = group.id?.trimmedNonEmpty else {
                continue
            }
            if !(group.filters.contains { $0.id?.trimmedNonEmpty == direction.filter.id?.trimmedNonEmpty }) {
                let updated = ReportBuilderDynamicFilterGroupDef(
                    id: group.id,
                    label: group.label,
                    icon: group.icon,
                    description: group.description,
                    filters: group.filters + [direction.filter]
                )
                if let index = dynamicGroups.firstIndex(where: { $0.id?.trimmedNonEmpty == groupId }) {
                    dynamicGroups[index] = updated
                }
                groupById[groupId] = updated
            }
            registerFamily(predicate: predicate, direction: direction)
        }
    }

    var dynamicFamilies = config.dynamicFilterFamilies
    var existingFamilyIds = Set(dynamicFamilies.compactMap { $0.id?.trimmedNonEmpty })
    let declaredGroups = config.predicateGroups.enumerated().compactMap { index, group -> (String, ReportBuilderPredicateGroupDef)? in
        guard let id = group.id?.trimmedNonEmpty else { return nil }
        return (
            id,
            ReportBuilderPredicateGroupDef(
                id: group.id,
                label: group.label,
                description: group.description,
                icon: group.icon,
                order: group.order ?? Double(index)
            )
        )
    }
    let declaredById = Dictionary(uniqueKeysWithValues: declaredGroups)
    let orderedFamilyIds = declaredGroups.map(\.0) + familyMembership.keys.filter { declaredById[$0] == nil }
    for groupId in orderedFamilyIds {
        guard let membership = familyMembership[groupId], !existingFamilyIds.contains(groupId) else {
            continue
        }
        existingFamilyIds.insert(groupId)
        let declared = declaredById[groupId]
        dynamicFamilies.append(
            ReportBuilderDynamicFilterFamilyDef(
                id: groupId,
                label: declared?.label?.trimmedNonEmpty ?? pascalCase(groupId),
                icon: declared?.icon?.trimmedNonEmpty,
                description: declared?.description?.trimmedNonEmpty,
                includeFilterIds: membership.include,
                excludeFilterIds: membership.exclude
            )
        )
    }

    return DashboardReportBuilderDef(
        title: config.title,
        subtitle: config.subtitle,
        hooks: config.hooks,
        filterPresentation: config.filterPresentation,
        showFilterCategoryBar: config.showFilterCategoryBar,
        hiddenDynamicGroupIds: config.hiddenDynamicGroupIds,
        notices: config.notices,
        primaryMeasure: config.primaryMeasure,
        measureSections: config.measureSections,
        measures: config.measures,
        computedMeasures: config.computedMeasures,
        dimensions: config.dimensions,
        staticFilters: staticFilters,
        dynamicFilterGroups: dynamicGroups,
        dynamicFilterFamilies: dynamicFamilies,
        predicateBuckets: config.predicateBuckets,
        predicateGroups: config.predicateGroups,
        predicates: config.predicates,
        resultCategories: config.resultCategories,
        groupBy: config.groupBy,
        unifiedFamilyRows: config.unifiedFamilyRows,
        showResultHeader: config.showResultHeader,
        result: config.result
    )
}

private struct NormalizedReportBuilderPredicate {
    let id: String
    let label: String
    let group: String
    let kind: String
    let pinned: Bool
    let required: Bool
    let multiple: Bool?
    let options: [ReportBuilderStaticFilterOptionDef]
    let defaultValue: JSONValue?
    let paramPath: String
    let startParamPath: String
    let endParamPath: String
    let bucket: String
    let directions: [NormalizedReportBuilderDirection]
}

private struct NormalizedReportBuilderDirection {
    let direction: String
    let groupId: String
    let filter: ReportBuilderDynamicFilterDef
}

private func normalizePredicate(_ entry: ReportBuilderPredicateDef) -> NormalizedReportBuilderPredicate? {
    guard let id = entry.id?.trimmedNonEmpty else { return nil }
    let kind = entry.kind?.trimmedNonEmpty?.caseInsensitiveCompare("dateRange") == .orderedSame ? "dateRange" : "value"
    let pinned = entry.pinned == true || kind == "dateRange"
    let base = NormalizedReportBuilderPredicate(
        id: id,
        label: entry.label?.trimmedNonEmpty ?? id,
        group: entry.group?.trimmedNonEmpty ?? "",
        kind: kind,
        pinned: pinned,
        required: entry.required == true,
        multiple: entry.multiple,
        options: entry.options,
        defaultValue: entry.defaultValue,
        paramPath: entry.paramPath?.trimmedNonEmpty ?? "",
        startParamPath: entry.startParamPath?.trimmedNonEmpty ?? "",
        endParamPath: entry.endParamPath?.trimmedNonEmpty ?? "",
        bucket: entry.bucket?.trimmedNonEmpty ?? "scope",
        directions: []
    )
    if pinned {
        return base
    }
    var directions: [NormalizedReportBuilderDirection] = []
    let hasInclude = directionEnabled(entry.include)
    let hasExclude = directionEnabled(entry.exclude)
    if hasInclude {
        directions.append(buildDirection(entry: entry, predicate: base, direction: "include", spec: entry.include))
    }
    if hasExclude {
        directions.append(buildDirection(entry: entry, predicate: base, direction: "exclude", spec: entry.exclude))
    }
    if !hasInclude && !hasExclude {
        directions.append(buildDirection(entry: entry, predicate: base, direction: "", spec: nil))
    }
    return NormalizedReportBuilderPredicate(
        id: base.id,
        label: base.label,
        group: base.group,
        kind: base.kind,
        pinned: base.pinned,
        required: base.required,
        multiple: base.multiple,
        options: base.options,
        defaultValue: base.defaultValue,
        paramPath: base.paramPath,
        startParamPath: base.startParamPath,
        endParamPath: base.endParamPath,
        bucket: base.bucket,
        directions: directions
    )
}

private func lowerPinnedPredicate(_ predicate: NormalizedReportBuilderPredicate) -> ReportBuilderStaticFilterDef {
    ReportBuilderStaticFilterDef(
        id: predicate.id,
        label: predicate.label,
        type: predicate.kind == "dateRange" ? "dateRange" : nil,
        required: predicate.required ? true : nil,
        multiple: predicate.multiple,
        paramPath: predicate.paramPath.isEmpty ? nil : predicate.paramPath,
        startParamPath: predicate.startParamPath.isEmpty ? nil : predicate.startParamPath,
        endParamPath: predicate.endParamPath.isEmpty ? nil : predicate.endParamPath,
        options: predicate.options,
        defaultValue: predicate.defaultValue
    )
}

private func buildDirection(
    entry: ReportBuilderPredicateDef,
    predicate: NormalizedReportBuilderPredicate,
    direction: String,
    spec: JSONValue?
) -> NormalizedReportBuilderDirection {
    let overrides = spec?.objectValue
    let fallbackId = direction.isEmpty ? predicate.id : direction + pascalCase(predicate.id)
    let filterId = overrides.string("filterId") ?? fallbackId
    let explicitParamPath: String?
    if direction == "include" {
        explicitParamPath = entry.includeParamPath
    } else if direction == "exclude" {
        explicitParamPath = entry.excludeParamPath
    } else {
        explicitParamPath = entry.paramPath
    }
    let paramPath = overrides.string("paramPath") ?? explicitParamPath?.trimmedNonEmpty ?? "filters.\(filterId)"
    let multiple = overrides.bool("multiple") ?? entry.multiple ?? true
    return NormalizedReportBuilderDirection(
        direction: direction,
        groupId: direction.isEmpty ? predicate.bucket : direction,
        filter: ReportBuilderDynamicFilterDef(
            id: filterId,
            label: overrides.string("label") ?? predicate.label,
            paramPath: paramPath,
            multiple: multiple,
            emitArray: overrides.bool("emitArray") ?? entry.emitArray ?? (multiple ? true : nil),
            manualEntry: overrides.bool("manualEntry") ?? entry.manualEntry,
            manualValueType: overrides.string("manualValueType") ?? entry.manualValueType,
            manualPlaceholder: overrides.string("manualPlaceholder") ?? entry.manualPlaceholder ?? entry.placeholder,
            dialogId: overrides.string("dialogId") ?? entry.dialogId,
            valueSelector: overrides.string("valueSelector") ?? entry.valueSelector,
            labelSelector: overrides.string("labelSelector") ?? entry.labelSelector,
            groupSelector: overrides.string("groupSelector") ?? entry.groupSelector,
            recordSelectors: overrides.stringList("recordSelectors") ?? entry.recordSelectors,
            requestMapping: overrides.string("requestMapping") ?? entry.requestMapping,
            targetingFeatureKey: overrides.string("targetingFeatureKey") ?? entry.targetingFeatureKey
        )
    )
}

private func directionEnabled(_ value: JSONValue?) -> Bool {
    guard let value else { return false }
    if case .bool(false) = value {
        return false
    }
    return true
}

private func defaultGroupLabel(_ id: String) -> String {
    switch id {
    case "include":
        return "Include"
    case "exclude":
        return "Exclude"
    default:
        return pascalCase(id)
    }
}

private func pascalCase(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let first = trimmed.first else { return "" }
    return String(first).uppercased() + trimmed.dropFirst()
}

private extension Optional where Wrapped == [String: JSONValue] {
    func string(_ key: String) -> String? {
        self?[key]?.stringValue?.trimmedNonEmpty
    }

    func bool(_ key: String) -> Bool? {
        self?[key]?.boolValue
    }

    func stringList(_ key: String) -> [String]? {
        guard let value = self?[key] else { return nil }
        switch value {
        case .array(let values):
            return values.compactMap { $0.stringValue?.trimmedNonEmpty }
        default:
            return nil
        }
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
