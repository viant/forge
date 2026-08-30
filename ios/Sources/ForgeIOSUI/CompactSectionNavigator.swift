import SwiftUI

struct CompactSectionNavigator: View {
    let entries: [(id: String, title: String)]
    let selectedID: String
    let onSelect: (String) -> Void

    var body: some View {
        let selectedIndex = entries.firstIndex(where: { $0.id == selectedID }) ?? 0
        HStack(spacing: 6) {
            Button {
                guard selectedIndex > 0 else { return }
                onSelect(entries[selectedIndex - 1].id)
            } label: {
                Image(systemName: "chevron.left").frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            .disabled(selectedIndex == 0)

            Menu {
                ForEach(entries, id: \.id) { entry in
                    Button(entry.title) { onSelect(entry.id) }
                }
            } label: {
                VStack(alignment: .leading, spacing: 1) {
                    Text(entries.indices.contains(selectedIndex) ? entries[selectedIndex].title : "Section")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("\(selectedIndex + 1) of \(entries.count) · tap to choose")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Image(systemName: "chevron.down").font(.caption.weight(.semibold))

            Button {
                guard selectedIndex + 1 < entries.count else { return }
                onSelect(entries[selectedIndex + 1].id)
            } label: {
                Image(systemName: "chevron.right").frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            .disabled(selectedIndex + 1 >= entries.count)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.secondary.opacity(0.14), lineWidth: 1))
        .accessibilityIdentifier("forge-compact-section-navigator")
    }
}
