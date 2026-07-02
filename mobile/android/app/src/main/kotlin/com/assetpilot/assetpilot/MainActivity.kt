package com.assetpilot.assetpilot

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private val channelName = "assetpilot/play_integrity"
    private val localeChannelName = "assetpilot/locale"
    private val widgetChannelName = "assetpilot/widgets"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "requestToken" -> {
                    val nonce = call.argument<String>("nonce")
                    if (nonce.isNullOrEmpty()) {
                        result.error("INVALID_NONCE", "nonce 為必填", null)
                    } else {
                        requestIntegrityToken(nonce, result)
                    }
                }
                else -> result.notImplemented()
            }
        }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, localeChannelName).setMethodCallHandler { call, result ->
            when (call.method) {
                // Single source of truth for the app's language. Writes to the
                // per-app locale store shared with the system "App info →
                // Language" screen (framework LocaleManager on API 33+,
                // AppCompat-backed storage below that).
                "setLocale" -> {
                    val tag = call.argument<String>("tag")
                    val locales = if (tag.isNullOrEmpty()) {
                        LocaleListCompat.getEmptyLocaleList()
                    } else {
                        LocaleListCompat.forLanguageTags(tag)
                    }
                    AppCompatDelegate.setApplicationLocales(locales)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, widgetChannelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "updateDashboard" -> {
                    val args = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                    AssetPilotWidgetStore.writeDashboard(applicationContext, args)
                    AssetPilotWidgetStore.updateAllWidgets(applicationContext)
                    result.success(null)
                }
                "updatePortfolio" -> {
                    val args = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                    AssetPilotWidgetStore.writePortfolio(applicationContext, args)
                    AssetPilotWidgetStore.updateAllWidgets(applicationContext)
                    result.success(null)
                }
                "updateBudgetAlerts" -> {
                    val args = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                    AssetPilotWidgetStore.writeBudgetAlerts(applicationContext, args)
                    AssetPilotWidgetStore.updateAllWidgets(applicationContext)
                    result.success(null)
                }
                "clearDashboard" -> {
                    AssetPilotWidgetStore.clearDashboard(applicationContext)
                    AssetPilotWidgetStore.updateAllWidgets(applicationContext)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun requestIntegrityToken(nonce: String, result: MethodChannel.Result) {
        try {
            val manager = IntegrityManagerFactory.create(applicationContext)
            // Classic 請求：以 nonce 綁定本次挑戰。本 App 透過 Play 發佈並已連結
            // Google Cloud 專案，故可省略 cloud project number；若改為 sideload 發佈，
            // 需在此呼叫 .setCloudProjectNumber(<PROJECT_NUMBER>)。
            val request = IntegrityTokenRequest.builder()
                .setNonce(nonce)
                .build()
            manager.requestIntegrityToken(request)
                .addOnSuccessListener { response ->
                    result.success(response.token())
                }
                .addOnFailureListener { e ->
                    result.error("INTEGRITY_FAILED", e.message, null)
                }
        } catch (e: Exception) {
            result.error("INTEGRITY_EXCEPTION", e.message, null)
        }
    }
}
