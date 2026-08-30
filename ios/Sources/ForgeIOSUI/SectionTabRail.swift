import SwiftUI

struct SectionTabItem: Identifiable, Equatable {
    let id: String
    let label: String
}

/** Native counterpart of Forge web's shared SectionTabRail. */
struct SectionTabRail: View {
    let items: [SectionTabItem]
    let selectedID: String
    let onSelect: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items) { item in
                    let selected = item.id == selectedID
                    Button(item.label) { onSelect(item.id) }
                        .font(.caption.weight(.bold))
                        .foregroundStyle(selected ? Color(red: 0.11, green: 0.31, blue: 0.85) : Color(red: 0.28, green: 0.40, blue: 0.48))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 38)
                        .background(selected ? Color.white : Color.clear, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(selected ? Color(red: 0.44, green: 0.62, blue: 0.91) : Color.clear, lineWidth: 1)
                        )
                        .shadow(color: selected ? Color.blue.opacity(0.22) : .clear, radius: 3, y: 1)
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(4)
        }
        .background(Color(red: 0.96, green: 0.97, blue: 0.98), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(red: 0.86, green: 0.90, blue: 0.93), lineWidth: 1))
    }
}
