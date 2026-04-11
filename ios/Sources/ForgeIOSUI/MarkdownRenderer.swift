import SwiftUI

public struct MarkdownRenderer: View {
    private let markdown: String

    public init(markdown: String) {
        self.markdown = markdown
    }

    public var body: some View {
        Text(.init(markdown.isEmpty ? "(empty response)" : markdown))
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
