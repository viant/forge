// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "ForgeIOS",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "ForgeIOSRuntime",
            targets: ["ForgeIOSRuntime"]
        ),
        .library(
            name: "ForgeIOSUI",
            targets: ["ForgeIOSUI"]
        )
    ],
    targets: [
        .target(
            name: "ForgeIOSRuntime"
        ),
        .target(
            name: "ForgeIOSUI",
            dependencies: ["ForgeIOSRuntime"]
        ),
        .testTarget(
            name: "ForgeIOSTests",
            dependencies: ["ForgeIOSRuntime", "ForgeIOSUI"]
        )
    ]
)
