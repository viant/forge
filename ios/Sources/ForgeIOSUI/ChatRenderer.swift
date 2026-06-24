import SwiftUI
import ForgeIOSRuntime

public struct ChatRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
    }

    public var body: some View {
        let chat = container.chat ?? ChatDef()
        VStack(alignment: .leading, spacing: 12) {
            header(chat)
            VStack(alignment: .leading, spacing: 8) {
                Text("Chat renderer scaffold")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    if chat.showUpload != false {
                        Label("Attach", systemImage: "paperclip")
                    }
                    if chat.showMic != false {
                        Label("Voice", systemImage: "waveform")
                    }
                    if chat.showSettings == true {
                        Label("Settings", systemImage: "slider.horizontal.3")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    @ViewBuilder
    private func header(_ chat: ChatDef) -> some View {
        HStack(spacing: 8) {
            headerButtons(chat.header?.left ?? [ChatHeaderButtonDef(icon: "back")])
            Spacer(minLength: 8)
            Text(chat.header?.title ?? container.title ?? "Chat")
                .font(.headline)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 8)
            headerButtons(chat.header?.right ?? defaultRightButtons)
        }
    }

    private var defaultRightButtons: [ChatHeaderButtonDef] {
        [ChatHeaderButtonDef(icon: "edit"), ChatHeaderButtonDef(icon: "plus")]
    }

    @ViewBuilder
    private func headerButtons(_ buttons: [ChatHeaderButtonDef]) -> some View {
        HStack(spacing: 4) {
            ForEach(Array(buttons.enumerated()), id: \.offset) { _, button in
                Button {
                    execute(button)
                } label: {
                    Label(button.label ?? button.icon ?? "Action", systemImage: systemImage(for: button.icon))
                        .labelStyle(.iconOnly)
                }
                .buttonStyle(.borderless)
                .disabled(button.on.isEmpty)
                .accessibilityLabel(button.label ?? button.icon ?? "Action")
            }
        }
    }

    private func execute(_ button: ChatHeaderButtonDef) {
        guard let runtime, let window else { return }
        for execution in button.on {
            Task {
                _ = await runtime.execute(
                    execution,
                    context: ExecutionContext(windowID: window.windowID, dataSourceRef: container.dataSourceRef ?? ""),
                    args: ["windowId": .string(window.windowID)]
                )
            }
        }
    }

    private func systemImage(for icon: String?) -> String {
        switch icon?.lowercased() {
        case "back":
            return "chevron.left"
        case "edit":
            return "square.and.pencil"
        case "plus", "add":
            return "plus"
        case "settings":
            return "slider.horizontal.3"
        default:
            return "circle"
        }
    }
}
