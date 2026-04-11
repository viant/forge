import SwiftUI
import ForgeIOSRuntime

public struct EditorRenderer: View {
    private let editor: EditorDef

    public init(editor: EditorDef) {
        self.editor = editor
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let language = editor.language {
                Text(language.uppercased())
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            ScrollView(.horizontal) {
                Text(editor.value ?? "")
                    .font(.system(.body, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}
