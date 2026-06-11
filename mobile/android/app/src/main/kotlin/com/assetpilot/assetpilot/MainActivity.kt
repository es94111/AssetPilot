package com.assetpilot.assetpilot

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "assetpilot/play_integrity"

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
