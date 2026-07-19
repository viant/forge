import SwiftUI
import ForgeIOSRuntime

public struct TranscriptInlinePresentation: Equatable, Sendable {
    public let maximumHeight: CGFloat

    public init(maximumHeight: CGFloat) {
        self.maximumHeight = maximumHeight
    }
}

/// Stable transcript sizing belongs to Forge. It uses only the supplied window
/// metadata and platform form factor, never response titles or content length.
public enum TranscriptInlinePresentationPolicy {
    public static func resolve(
        metadata: WindowMetadata,
        horizontalSizeClass: UserInterfaceSizeClass?
    ) -> TranscriptInlinePresentation {
        // Keep metadata in the contract so declared presentation fields can be
        // added without moving this policy back into a host app.
        _ = metadata
        return TranscriptInlinePresentation(
            maximumHeight: horizontalSizeClass == .regular ? 420 : 340
        )
    }
}
