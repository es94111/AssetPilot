import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing config is read from android/key.properties when present
// (created by CI from secrets, or locally for a real release build). When it's
// absent the release build falls back to the debug key so `flutter run
// --release` and local dev keep working without a keystore.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.assetpilot.assetpilot"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.assetpilot.assetpilot"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Use the fixed release keystore when configured (CI writes
            // key.properties from secrets), else the debug key so local release
            // builds still work without a keystore.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            // Explicit so proguard-rules.pro (WorkManager/Room keep rule) is
            // guaranteed to apply regardless of Flutter's own default shrink config.
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Play Integrity API：登入／註冊時取得裝置/App 完整性 token（classic / nonce 流程）
    implementation("com.google.android.play:integrity:1.4.0")
    // Per-app language：AppCompatDelegate.setApplicationLocales 統一 App 內語言選單
    // 與系統「應用程式資訊 → 語言」的設定來源（API 33+ 走框架 LocaleManager，
    // 以下版本由 AppCompat 儲存並套用）。需 1.6.0+。
    implementation("androidx.appcompat:appcompat:1.7.0")
    // 桌面小工具需在 App 關閉後仍定期抓取最新金額；WorkManager 由 Android
    // 依電量與網路狀態批次執行，避免自建常駐服務。
    implementation("androidx.work:work-runtime-ktx:2.10.2")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20180813")
}
