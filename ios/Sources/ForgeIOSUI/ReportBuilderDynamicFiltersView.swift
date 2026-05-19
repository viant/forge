import SwiftUI
import ForgeIOSRuntime

struct ReportBuilderDynamicFiltersView: View {
    let groups: [ReportBuilderDynamicFilterGroupDef]
    let families: [ReportBuilderDynamicFilterFamilyDef]

    var body: some View {
        if !groups.isEmpty || !families.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Advanced filters")
                    .font(.subheadline.weight(.semibold))
                Text("This builder includes dynamic filter groups and families. The native SDK now decodes this contract, but interactive row-based filter editing is still being bridged.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !families.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(families, id: \.identityKey) { family in
                                Text(family.label ?? family.identityKey)
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.secondary.opacity(0.08), in: Capsule())
                            }
                        }
                    }
                }
                if !groups.isEmpty {
                    Text(groups.map { $0.label ?? $0.identityKey }.joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
        }
    }
}
