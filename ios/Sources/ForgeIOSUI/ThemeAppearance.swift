import SwiftUI

/// Platform-native projection of portable workspace tokens. The host owns
/// catalogs and selection; Forge owns their use by native controls.
public struct ForgeThemeAppearance {
    public var lookupBackground: Color = Color(red: 241/255, green: 248/255, blue: 242/255)
    public var lookupBorder: Color = Color(red: 191/255, green: 215/255, blue: 196/255)
    public var requiredBackground: Color = Color(red: 255/255, green: 243/255, blue: 244/255)
    public var requiredBorder: Color = Color(red: 213/255, green: 143/255, blue: 152/255)
    public var surface, text, controlBackground, controlForeground, controlBorder: Color
    public var focus, buttonBackground, buttonForeground, disabledBackground, disabledForeground, validationBorder: Color
    public var fontSize, controlHeight, radius, paddingInline: CGFloat
    public init(surface: Color, text: Color, controlBackground: Color, controlForeground: Color, controlBorder: Color,
                focus: Color, buttonBackground: Color, buttonForeground: Color, disabledBackground: Color,
                disabledForeground: Color, validationBorder: Color, fontSize: CGFloat, controlHeight: CGFloat,
                radius: CGFloat, paddingInline: CGFloat) {
        self.surface = surface; self.text = text; self.controlBackground = controlBackground
        self.controlForeground = controlForeground; self.controlBorder = controlBorder; self.focus = focus
        self.buttonBackground = buttonBackground; self.buttonForeground = buttonForeground
        self.disabledBackground = disabledBackground; self.disabledForeground = disabledForeground
        self.validationBorder = validationBorder; self.fontSize = fontSize; self.controlHeight = controlHeight
        self.radius = radius; self.paddingInline = paddingInline
    }
}
private struct ForgeThemeAppearanceKey: EnvironmentKey { static let defaultValue: ForgeThemeAppearance? = nil }
extension EnvironmentValues {
    public var forgeThemeAppearance: ForgeThemeAppearance? {
        get { self[ForgeThemeAppearanceKey.self] }
        set { self[ForgeThemeAppearanceKey.self] = newValue }
    }
}

struct ForgeThemeSurfaceModifier: ViewModifier {
    @Environment(\.forgeThemeAppearance) private var appearance
    @ViewBuilder func body(content: Content) -> some View {
        if let appearance { content.background(appearance.surface).foregroundStyle(appearance.text).tint(appearance.focus) }
        else { content }
    }
}
struct ForgeThemeInputModifier: ViewModifier {
    var invalid = false
    var multiline = false
    var required = false
    var lookup = false
    @FocusState private var focused: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.forgeThemeAppearance) private var appearance
    @Environment(\.isEnabled) private var enabled
    @ScaledMetric(relativeTo: .body) private var fontScale = 1.0
    @ViewBuilder func body(content: Content) -> some View {
        if let appearance {
            content.focused($focused).textFieldStyle(.plain).scrollContentBackground(.hidden)
                .font(.system(size: appearance.fontSize * fontScale))
                .padding(.horizontal, appearance.paddingInline)
                .frame(minHeight: max(multiline ? 96 : 44, appearance.controlHeight))
                .foregroundStyle(enabled ? appearance.controlForeground : appearance.disabledForeground)
                .background(enabled ? semanticBackground(appearance) : appearance.disabledBackground)
                .clipShape(RoundedRectangle(cornerRadius: appearance.radius))
                .overlay(RoundedRectangle(cornerRadius: appearance.radius).stroke(!enabled ? appearance.controlBorder.opacity(0.5) : invalid ? appearance.validationBorder : required ? appearance.requiredBorder : lookup ? appearance.lookupBorder : appearance.controlBorder).allowsHitTesting(false))
                .overlay(RoundedRectangle(cornerRadius: appearance.radius + 2).stroke(focused && enabled ? appearance.focus : .clear, lineWidth: 2).padding(-3).allowsHitTesting(false))
                .tint(appearance.focus)
        } else {
            content.focused($focused).textFieldStyle(.plain)
                .padding(.horizontal, 11)
                .frame(minHeight: multiline ? 96 : 44)
                .background(enabled ? (lookup ? Color.green.opacity(colorScheme == .dark ? 0.16 : 0.06) : required ? Color.red.opacity(colorScheme == .dark ? 0.16 : 0.05) : Color.forgeSecondarySystemBackground) : Color.forgeSecondarySystemBackground)
                .foregroundStyle(enabled ? Color.primary : Color.secondary)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(!enabled ? Color.secondary.opacity(0.15) : invalid ? Color.red : required ? Color(red: 213/255, green: 143/255, blue: 152/255) : lookup ? Color.green.opacity(0.35) : Color.secondary.opacity(0.25)).allowsHitTesting(false))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused && enabled ? Color.blue : .clear, lineWidth: 2).padding(-3).allowsHitTesting(false))
        }
    }

    private func semanticBackground(_ appearance: ForgeThemeAppearance) -> Color {
        if lookup { return colorScheme == .dark ? appearance.lookupBorder.opacity(0.16) : appearance.lookupBackground }
        if required { return colorScheme == .dark ? appearance.requiredBorder.opacity(0.16) : appearance.requiredBackground }
        return appearance.controlBackground
    }
}
struct ForgeThemeButtonModifier: ViewModifier {
    @Environment(\.forgeThemeAppearance) private var appearance
    @ViewBuilder func body(content: Content) -> some View {
        if let appearance { content.buttonStyle(WorkspaceButtonStyle(appearance: appearance)) }
        else { content }
    }
}
private struct WorkspaceButtonStyle: ButtonStyle {
    var appearance: ForgeThemeAppearance
    @Environment(\.isEnabled) private var enabled
    @ScaledMetric(relativeTo: .body) private var fontScale = 1.0
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: appearance.fontSize * fontScale))
            .padding(.horizontal, appearance.paddingInline).padding(.vertical, 6)
            .frame(minHeight: max(44, appearance.controlHeight))
            .foregroundStyle(enabled ? appearance.buttonForeground : appearance.disabledForeground)
            .background(enabled ? appearance.buttonBackground : appearance.disabledBackground)
            .clipShape(RoundedRectangle(cornerRadius: appearance.radius))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}
