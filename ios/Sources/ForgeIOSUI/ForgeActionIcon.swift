import SwiftUI

struct ForgeLayeredActionIcon: View {
    let systemImage: String
    let color: Color
    var isLoading = false
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.22), color.opacity(0.08)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Circle()
                .stroke(Color.white.opacity(0.86), lineWidth: 1)
            if isLoading {
                ProgressView()
                    .controlSize(.mini)
                    .tint(color)
            } else {
                Image(systemName: systemImage)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(color)
            }
        }
        .frame(width: size, height: size)
        .shadow(color: color.opacity(0.18), radius: 4, x: 0, y: 2)
    }
}

struct ForgePillActionLabel: View {
    let title: String
    let systemImage: String
    let color: Color
    var isLoading = false

    var body: some View {
        HStack(spacing: 7) {
            ForgeLayeredActionIcon(
                systemImage: systemImage,
                color: color,
                isLoading: isLoading
            )
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.trailing, 10)
        .background(color.opacity(0.07), in: Capsule())
    }
}
