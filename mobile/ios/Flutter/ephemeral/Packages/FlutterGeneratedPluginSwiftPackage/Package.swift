// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.
//
// Generated file. Do not edit.
//

import PackageDescription

let package = Package(
    name: "FlutterGeneratedPluginSwiftPackage",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .library(name: "FlutterGeneratedPluginSwiftPackage", type: .static, targets: ["FlutterGeneratedPluginSwiftPackage"])
    ],
    dependencies: [
        .package(name: "app_links", path: "../.packages/app_links-7.2.1"),
        .package(name: "connectivity_plus", path: "../.packages/connectivity_plus-6.1.5"),
        .package(name: "flutter_secure_storage_darwin", path: "../.packages/flutter_secure_storage_darwin-0.4.0"),
        .package(name: "image_picker_ios", path: "../.packages/image_picker_ios-0.8.13+6"),
        .package(name: "integration_test", path: "../.packages/integration_test"),
        .package(name: "package_info_plus", path: "../.packages/package_info_plus-10.2.1"),
        .package(name: "sentry_flutter", path: "../.packages/sentry_flutter-9.27.0"),
        .package(name: "shared_preferences_foundation", path: "../.packages/shared_preferences_foundation-2.5.6"),
        .package(name: "url_launcher_ios", path: "../.packages/url_launcher_ios-6.4.1"),
        .package(name: "webview_flutter_wkwebview", path: "../.packages/webview_flutter_wkwebview-3.26.0"),
        .package(name: "FlutterFramework", path: "../.packages/FlutterFramework")
    ],
    targets: [
        .target(
            name: "FlutterGeneratedPluginSwiftPackage",
            dependencies: [
                .product(name: "app-links", package: "app_links"),
                .product(name: "connectivity-plus", package: "connectivity_plus"),
                .product(name: "flutter-secure-storage-darwin", package: "flutter_secure_storage_darwin"),
                .product(name: "image-picker-ios", package: "image_picker_ios"),
                .product(name: "integration-test", package: "integration_test"),
                .product(name: "package-info-plus", package: "package_info_plus"),
                .product(name: "sentry-flutter", package: "sentry_flutter"),
                .product(name: "shared-preferences-foundation", package: "shared_preferences_foundation"),
                .product(name: "url-launcher-ios", package: "url_launcher_ios"),
                .product(name: "webview-flutter-wkwebview", package: "webview_flutter_wkwebview"),
                .product(name: "FlutterFramework", package: "FlutterFramework")
            ]
        )
    ]
)
