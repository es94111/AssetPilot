package com.assetpilot.assetpilot

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.it_nomads.fluttersecurestorage.FlutterSecureStorage
import com.it_nomads.fluttersecurestorage.FlutterSecureStorageConfig
import com.it_nomads.fluttersecurestorage.SecurePreferencesCallback
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.NumberFormat
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

private const val SECURE_PREFS_NAME = "FlutterSecureStorage"
private const val SECURE_PREFS_KEY_PREFIX = "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIHNlY3VyZSBzdG9yYWdlCg"
private const val AUTH_COOKIE_KEY = "authCookie"
private const val DEFAULT_API_BASE_URL = "https://asset.shao.one"
private const val API_CONNECT_TIMEOUT_MILLIS = 10_000
private const val API_READ_TIMEOUT_MILLIS = 15_000
private const val MAX_RECENT_TRANSACTIONS = 5

internal data class WidgetSyncDashboard(
    val yearMonth: String,
    val income: Double,
    val expense: Double,
    val todayExpense: Double,
    val bankBalance: Double,
    val stockMarketValue: Double,
    val recent: List<WidgetSyncTransaction>,
)

internal data class WidgetSyncTransaction(
    val type: String,
    val date: String,
    val title: String,
    val note: String,
    val originalAmount: Double,
    val currency: String,
)

internal object AssetPilotWidgetBackgroundSync {
    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")

    fun fetchDashboard(cookie: String): WidgetSyncDashboard {
        val yearMonth = YearMonth.now().toString()
        val connection = URL("$DEFAULT_API_BASE_URL/api/dashboard?ym=$yearMonth")
            .openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = API_CONNECT_TIMEOUT_MILLIS
            connection.readTimeout = API_READ_TIMEOUT_MILLIS
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cookie", cookie)
            connection.setRequestProperty("User-Agent", "AssetPilotApp (Android Widget)")
            val status = connection.responseCode
            if (status !in 200..299) throw WidgetSyncHttpException(status)
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            return parseDashboard(body)
        } finally {
            connection.disconnect()
        }
    }

    fun parseDashboard(body: String): WidgetSyncDashboard {
        val json = JSONObject(body)
        val recentJson = json.optJSONArray("recent") ?: JSONArray()
        val recent = buildList {
            for (index in 0 until minOf(recentJson.length(), MAX_RECENT_TRANSACTIONS)) {
                val item = recentJson.optJSONObject(index) ?: continue
                val amount = item.number("amount")
                val originalAmount = item.number("originalAmount", "original_amount")
                    .takeIf { it > 0 }
                    ?: amount
                add(
                    WidgetSyncTransaction(
                        type = item.optString("type"),
                        date = item.optString("date"),
                        title = item.firstText("cat_name", "catName", "category_name", "categoryName"),
                        note = item.optString("note"),
                        originalAmount = originalAmount,
                        currency = item.optString("currency").ifBlank { "TWD" },
                    ),
                )
            }
        }
        return WidgetSyncDashboard(
            yearMonth = json.optString("yearMonth").ifBlank { YearMonth.now().toString() },
            income = json.number("income"),
            expense = json.number("expense"),
            todayExpense = json.number("todayExpense"),
            bankBalance = json.number("bankBalance"),
            stockMarketValue = json.number("stockMarketValue"),
            recent = recent,
        )
    }

    fun toWidgetArgs(
        dashboard: WidgetSyncDashboard,
        updatedAt: LocalDateTime = LocalDateTime.now(),
    ): Map<String, Any> {
        val net = dashboard.income - dashboard.expense
        val progress = when {
            dashboard.income <= 0 && dashboard.expense > 0 -> 100
            dashboard.income <= 0 -> 0
            else -> (dashboard.expense / dashboard.income * 100).roundToInt().coerceIn(0, 100)
        }
        val args = mutableMapOf<String, Any>(
            "period" to dashboard.yearMonth,
            "incomeLabel" to formatTwd(dashboard.income),
            "expenseLabel" to formatTwd(dashboard.expense),
            "netLabel" to signedTwd(net),
            "todayExpenseLabel" to formatTwd(dashboard.todayExpense),
            "bankBalanceLabel" to formatTwd(dashboard.bankBalance),
            "stockMarketValueLabel" to formatTwd(dashboard.stockMarketValue),
            "totalAssetLabel" to formatTwd(dashboard.bankBalance + dashboard.stockMarketValue),
            "expenseProgress" to progress,
            "progressLabel" to when {
                dashboard.income > 0 -> "支出為收入的 $progress%"
                dashboard.expense > 0 -> "本月已有支出"
                else -> "本月尚無支出"
            },
            "updatedAtLabel" to "${updatedAt.format(timeFormatter)} 更新",
            "netPositive" to (net >= 0),
            "recentCount" to dashboard.recent.size,
        )
        dashboard.recent.forEachIndexed { index, transaction ->
            val title = transaction.title.ifBlank {
                transaction.note.ifBlank { transaction.type.defaultTitle() }
            }
            val date = transaction.date.toMonthDayLabel()
            args["recentTitle$index"] = title
            args["recentSubtitle$index"] = if (
                transaction.note.isBlank() || transaction.note == title
            ) {
                date
            } else {
                "$date・${transaction.note}"
            }
            val sign = when (transaction.type) {
                "income", "transfer_in" -> "+"
                "expense", "transfer_out" -> "-"
                else -> ""
            }
            args["recentAmount$index"] =
                "$sign${formatMoney(transaction.originalAmount, transaction.currency)}"
            args["recentTone$index"] = when (transaction.type) {
                "income", "transfer_in" -> 1
                "expense", "transfer_out" -> 2
                else -> 0
            }
        }
        return args
    }

    fun readAuthCookie(context: Context): String? {
        return try {
            val config = FlutterSecureStorageConfig(
                mapOf(
                    "sharedPreferencesName" to SECURE_PREFS_NAME,
                    "preferencesKeyPrefix" to SECURE_PREFS_KEY_PREFIX,
                    "encryptedSharedPreferences" to "true",
                    "resetOnError" to "true",
                    "migrateOnAlgorithmChange" to "true",
                    "migrateWithBackup" to "false",
                    "enforceBiometrics" to "false",
                    "keyCipherAlgorithm" to "RSA_ECB_OAEPwithSHA_256andMGF1Padding",
                    "storageCipherAlgorithm" to "AES_GCM_NoPadding",
                    "biometricType" to "biometricOrDeviceCredential",
                ),
            )
            val storage = FlutterSecureStorage(context)
            var cookie: String? = null
            val initialized = CountDownLatch(1)
            storage.initialize(
                config,
                object : SecurePreferencesCallback<Void> {
                    override fun onSuccess(result: Void?) {
                        cookie = storage.read(storage.addPrefixToKey(AUTH_COOKIE_KEY))
                        initialized.countDown()
                    }

                    override fun onError(error: Exception) {
                        initialized.countDown()
                    }
                },
            )
            if (initialized.await(5, TimeUnit.SECONDS)) {
                cookie?.takeIf { it.isNotBlank() }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun formatTwd(value: Double): String {
        val label = NumberFormat.getNumberInstance(Locale.TAIWAN).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }.format(value)
        return "NT$ $label"
    }

    private fun signedTwd(value: Double): String = if (value < 0) {
        "-${formatTwd(-value)}"
    } else {
        "+${formatTwd(value)}"
    }

    private fun formatMoney(value: Double, currency: String): String {
        val digits = if (currency == "TWD") 0 else 2
        val label = NumberFormat.getNumberInstance(Locale.TAIWAN).apply {
            maximumFractionDigits = digits
            minimumFractionDigits = digits
        }.format(value)
        return "$currency $label"
    }
}

internal class WidgetSyncHttpException(val statusCode: Int) : Exception()

class AssetPilotWidgetSyncWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {
    override fun doWork(): Result {
        val generation = AssetPilotWidgetStore.syncGeneration(applicationContext)
        val cookie = AssetPilotWidgetBackgroundSync.readAuthCookie(applicationContext)
            ?: return Result.success()
        return try {
            val dashboard = AssetPilotWidgetBackgroundSync.fetchDashboard(cookie)
            if (AssetPilotWidgetStore.syncGeneration(applicationContext) != generation) {
                return Result.success()
            }
            AssetPilotWidgetStore.writeDashboard(
                applicationContext,
                AssetPilotWidgetBackgroundSync.toWidgetArgs(dashboard),
            )
            AssetPilotWidgetStore.updateAllWidgets(applicationContext)
            Result.success()
        } catch (error: WidgetSyncHttpException) {
            if (error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED ||
                error.statusCode == HttpURLConnection.HTTP_FORBIDDEN
            ) {
                AssetPilotWidgetStore.cancelBackgroundSync(applicationContext)
                AssetPilotWidgetStore.clearDashboard(applicationContext)
                AssetPilotWidgetStore.updateAllWidgets(applicationContext)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

private fun JSONObject.number(vararg keys: String): Double {
    for (key in keys) {
        if (!has(key) || isNull(key)) continue
        val value = opt(key)
        when (value) {
            is Number -> return value.toDouble()
            is String -> value.toDoubleOrNull()?.let { return it }
        }
    }
    return 0.0
}

private fun JSONObject.firstText(vararg keys: String): String {
    for (key in keys) {
        val value = optString(key).trim()
        if (value.isNotEmpty()) return value
    }
    return ""
}

private fun String.defaultTitle(): String = when (this) {
    "income" -> "收入"
    "expense" -> "支出"
    "transfer", "transfer_in", "transfer_out" -> "轉帳"
    else -> "未分類"
}

private fun String.toMonthDayLabel(): String {
    val parts = split('-')
    if (parts.size < 3) return this
    val month = parts[1].toIntOrNull() ?: return this
    val day = parts[2].take(2).toIntOrNull() ?: return this
    return "$month/$day"
}
