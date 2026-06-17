import SwiftUI

struct ReportBuilderLayoutView: View {
    let measuresSection: AnyView
    let dimensionsSection: AnyView
    let filterSummarySection: AnyView
    let staticFiltersSection: AnyView
    let dynamicFiltersSection: AnyView
    let chartCreationSection: AnyView
    let chartModeSection: AnyView
    let resultSection: AnyView

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            measuresSection
            dimensionsSection
            filterSummarySection
            staticFiltersSection
            dynamicFiltersSection
            chartCreationSection
            chartModeSection
            resultSection
        }
    }
}
