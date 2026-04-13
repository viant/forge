import SwiftUI
import ForgeIOSRuntime

public struct ChartRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let chart: ChartDef

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, chart: ChartDef) {
        self.runtime = runtime
        self.window = window
        self.chart = chart
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = chart.title {
                Text(title).font(.headline)
            }
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.secondary.opacity(0.08))
                .frame(height: 160)
                .overlay(
                    Text(chart.kind ?? "chart")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                )
        }
    }
}
