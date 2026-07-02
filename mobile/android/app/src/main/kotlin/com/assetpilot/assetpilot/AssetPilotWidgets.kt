package com.assetpilot.assetpilot

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

private const val WIDGET_PREFS = "assetpilot_widgets"
private const val KEY_HAS_DASHBOARD = "hasDashboard"
private const val KEY_PERIOD = "period"
private const val KEY_INCOME = "incomeLabel"
private const val KEY_EXPENSE = "expenseLabel"
private const val KEY_NET = "netLabel"
private const val KEY_TODAY_EXPENSE = "todayExpenseLabel"
private const val KEY_EXPENSE_PROGRESS = "expenseProgress"
private const val KEY_PROGRESS_LABEL = "progressLabel"
private const val KEY_UPDATED_AT = "updatedAtLabel"
private const val KEY_NET_POSITIVE = "netPositive"
private const val KEY_BANK_BALANCE = "bankBalanceLabel"
private const val KEY_STOCK_MARKET_VALUE = "stockMarketValueLabel"
private const val KEY_TOTAL_ASSET = "totalAssetLabel"
private const val KEY_HAS_PORTFOLIO = "hasPortfolio"
private const val KEY_PORTFOLIO_PL = "portfolioPlLabel"
private const val KEY_PORTFOLIO_RETURN = "portfolioReturnLabel"
private const val KEY_PORTFOLIO_PL_POSITIVE = "portfolioPlPositive"
private const val KEY_PORTFOLIO_UPDATED_AT = "portfolioUpdatedAtLabel"
private const val KEY_HAS_BUDGET_ALERTS = "hasBudgetAlerts"
private const val KEY_BUDGET_PERIOD = "budgetPeriod"
private const val KEY_BUDGET_UPDATED_AT = "budgetUpdatedAtLabel"
private const val KEY_BUDGET_COUNT = "budgetCount"
private const val KEY_RECENT_COUNT = "recentCount"
private const val KEY_HAS_RECURRING_REMINDERS = "hasRecurringReminders"
private const val KEY_REMINDER_UPDATED_AT = "reminderUpdatedAtLabel"
private const val KEY_REMINDER_COUNT = "reminderCount"
private const val MAX_BUDGET_ALERTS = 3
private const val MAX_RECENT_TRANSACTIONS = 5
private const val MAX_RECURRING_REMINDERS = 5

object AssetPilotWidgetStore {
    fun writeDashboard(context: Context, args: Map<*, *>) {
        val recentCount = args.int(KEY_RECENT_COUNT).coerceIn(0, MAX_RECENT_TRANSACTIONS)
        val editor = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HAS_DASHBOARD, true)
            .putString(KEY_PERIOD, args.string(KEY_PERIOD, "--"))
            .putString(KEY_INCOME, args.string(KEY_INCOME, "--"))
            .putString(KEY_EXPENSE, args.string(KEY_EXPENSE, "--"))
            .putString(KEY_NET, args.string(KEY_NET, "--"))
            .putString(KEY_TODAY_EXPENSE, args.string(KEY_TODAY_EXPENSE, "--"))
            .putInt(KEY_EXPENSE_PROGRESS, args.int(KEY_EXPENSE_PROGRESS).coerceIn(0, 100))
            .putString(KEY_PROGRESS_LABEL, args.string(KEY_PROGRESS_LABEL, "開啟 App 更新"))
            .putString(KEY_UPDATED_AT, args.string(KEY_UPDATED_AT, ""))
            .putBoolean(KEY_NET_POSITIVE, args.boolean(KEY_NET_POSITIVE, true))
            .putString(KEY_BANK_BALANCE, args.string(KEY_BANK_BALANCE, "--"))
            .putString(KEY_STOCK_MARKET_VALUE, args.string(KEY_STOCK_MARKET_VALUE, "--"))
            .putString(KEY_TOTAL_ASSET, args.string(KEY_TOTAL_ASSET, "--"))
            .putInt(KEY_RECENT_COUNT, recentCount)
        for (index in 0 until MAX_RECENT_TRANSACTIONS) {
            editor
                .putString(recentTitleKey(index), args.string(recentTitleKey(index), ""))
                .putString(recentSubtitleKey(index), args.string(recentSubtitleKey(index), ""))
                .putString(recentAmountKey(index), args.string(recentAmountKey(index), ""))
                .putInt(recentToneKey(index), args.int(recentToneKey(index)).coerceIn(0, 2))
        }
        editor.apply()
    }

    fun writePortfolio(context: Context, args: Map<*, *>) {
        context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HAS_PORTFOLIO, true)
            .putString(KEY_PORTFOLIO_PL, args.string(KEY_PORTFOLIO_PL, "--"))
            .putString(KEY_PORTFOLIO_RETURN, args.string(KEY_PORTFOLIO_RETURN, "--"))
            .putBoolean(KEY_PORTFOLIO_PL_POSITIVE, args.boolean(KEY_PORTFOLIO_PL_POSITIVE, true))
            .putString(KEY_PORTFOLIO_UPDATED_AT, args.string(KEY_PORTFOLIO_UPDATED_AT, ""))
            .apply()
    }

    fun writeBudgetAlerts(context: Context, args: Map<*, *>) {
        val count = args.int(KEY_BUDGET_COUNT).coerceIn(0, MAX_BUDGET_ALERTS)
        val editor = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HAS_BUDGET_ALERTS, true)
            .putString(KEY_BUDGET_PERIOD, args.string(KEY_BUDGET_PERIOD, "--"))
            .putString(KEY_BUDGET_UPDATED_AT, args.string(KEY_BUDGET_UPDATED_AT, ""))
            .putInt(KEY_BUDGET_COUNT, count)
        for (index in 0 until MAX_BUDGET_ALERTS) {
            editor
                .putString(budgetNameKey(index), args.string(budgetNameKey(index), ""))
                .putString(budgetDetailKey(index), args.string(budgetDetailKey(index), ""))
                .putString(budgetPercentKey(index), args.string(budgetPercentKey(index), ""))
                .putInt(budgetProgressKey(index), args.int(budgetProgressKey(index)).coerceIn(0, 100))
                .putInt(budgetStatusKey(index), args.int(budgetStatusKey(index)).coerceIn(0, 2))
        }
        editor.apply()
    }

    fun writeRecurringReminders(context: Context, args: Map<*, *>) {
        val count = args.int(KEY_REMINDER_COUNT).coerceIn(0, MAX_RECURRING_REMINDERS)
        val editor = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HAS_RECURRING_REMINDERS, true)
            .putString(KEY_REMINDER_UPDATED_AT, args.string(KEY_REMINDER_UPDATED_AT, ""))
            .putInt(KEY_REMINDER_COUNT, count)
        for (index in 0 until MAX_RECURRING_REMINDERS) {
            editor
                .putString(reminderTitleKey(index), args.string(reminderTitleKey(index), ""))
                .putString(reminderDetailKey(index), args.string(reminderDetailKey(index), ""))
                .putString(reminderAmountKey(index), args.string(reminderAmountKey(index), ""))
                .putString(reminderDateKey(index), args.string(reminderDateKey(index), ""))
                .putInt(reminderStatusKey(index), args.int(reminderStatusKey(index)).coerceIn(0, 2))
        }
        editor.apply()
    }

    fun clearDashboard(context: Context) {
        context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply()
    }

    fun readDashboard(context: Context): WidgetDashboardData {
        val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        val hasDashboard = prefs.getBoolean(KEY_HAS_DASHBOARD, false)
        return WidgetDashboardData(
            hasDashboard = hasDashboard,
            period = prefs.getString(KEY_PERIOD, "--") ?: "--",
            income = prefs.getString(KEY_INCOME, "--") ?: "--",
            expense = prefs.getString(KEY_EXPENSE, "--") ?: "--",
            net = prefs.getString(KEY_NET, "--") ?: "--",
            todayExpense = prefs.getString(KEY_TODAY_EXPENSE, "--") ?: "--",
            expenseProgress = prefs.getInt(KEY_EXPENSE_PROGRESS, 0).coerceIn(0, 100),
            progressLabel = prefs.getString(KEY_PROGRESS_LABEL, "開啟 App 更新") ?: "開啟 App 更新",
            updatedAt = prefs.getString(KEY_UPDATED_AT, "") ?: "",
            netPositive = prefs.getBoolean(KEY_NET_POSITIVE, true),
            bankBalance = prefs.getString(KEY_BANK_BALANCE, "--") ?: "--",
            stockMarketValue = prefs.getString(KEY_STOCK_MARKET_VALUE, "--") ?: "--",
            totalAsset = prefs.getString(KEY_TOTAL_ASSET, "--") ?: "--",
            hasPortfolio = prefs.getBoolean(KEY_HAS_PORTFOLIO, false),
            portfolioPl = prefs.getString(KEY_PORTFOLIO_PL, "--") ?: "--",
            portfolioReturn = prefs.getString(KEY_PORTFOLIO_RETURN, "--") ?: "--",
            portfolioPlPositive = prefs.getBoolean(KEY_PORTFOLIO_PL_POSITIVE, true),
            portfolioUpdatedAt = prefs.getString(KEY_PORTFOLIO_UPDATED_AT, "") ?: "",
        )
    }

    fun readRecentTransactions(context: Context): WidgetRecentTransactionsData {
        val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        val count = prefs.getInt(KEY_RECENT_COUNT, 0).coerceIn(0, MAX_RECENT_TRANSACTIONS)
        return WidgetRecentTransactionsData(
            hasDashboard = prefs.getBoolean(KEY_HAS_DASHBOARD, false),
            period = prefs.getString(KEY_PERIOD, "--") ?: "--",
            updatedAt = prefs.getString(KEY_UPDATED_AT, "") ?: "",
            items = (0 until count).map { index ->
                WidgetRecentTransaction(
                    title = prefs.getString(recentTitleKey(index), "") ?: "",
                    subtitle = prefs.getString(recentSubtitleKey(index), "") ?: "",
                    amount = prefs.getString(recentAmountKey(index), "") ?: "",
                    tone = prefs.getInt(recentToneKey(index), 0).coerceIn(0, 2),
                )
            },
        )
    }

    fun readBudgetAlerts(context: Context): WidgetBudgetAlertsData {
        val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        val count = prefs.getInt(KEY_BUDGET_COUNT, 0).coerceIn(0, MAX_BUDGET_ALERTS)
        return WidgetBudgetAlertsData(
            hasAlerts = prefs.getBoolean(KEY_HAS_BUDGET_ALERTS, false),
            period = prefs.getString(KEY_BUDGET_PERIOD, "--") ?: "--",
            updatedAt = prefs.getString(KEY_BUDGET_UPDATED_AT, "") ?: "",
            items = (0 until count).map { index ->
                WidgetBudgetAlert(
                    name = prefs.getString(budgetNameKey(index), "") ?: "",
                    detail = prefs.getString(budgetDetailKey(index), "") ?: "",
                    percent = prefs.getString(budgetPercentKey(index), "") ?: "",
                    progress = prefs.getInt(budgetProgressKey(index), 0).coerceIn(0, 100),
                    status = prefs.getInt(budgetStatusKey(index), 0).coerceIn(0, 2),
                )
            },
        )
    }

    fun readRecurringReminders(context: Context): WidgetRecurringReminderData {
        val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        val count = prefs.getInt(KEY_REMINDER_COUNT, 0).coerceIn(0, MAX_RECURRING_REMINDERS)
        return WidgetRecurringReminderData(
            hasReminders = prefs.getBoolean(KEY_HAS_RECURRING_REMINDERS, false),
            updatedAt = prefs.getString(KEY_REMINDER_UPDATED_AT, "") ?: "",
            items = (0 until count).map { index ->
                WidgetRecurringReminder(
                    title = prefs.getString(reminderTitleKey(index), "") ?: "",
                    detail = prefs.getString(reminderDetailKey(index), "") ?: "",
                    amount = prefs.getString(reminderAmountKey(index), "") ?: "",
                    date = prefs.getString(reminderDateKey(index), "") ?: "",
                    status = prefs.getInt(reminderStatusKey(index), 0).coerceIn(0, 2),
                )
            },
        )
    }

    fun updateAllWidgets(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        MonthlyOverviewWidgetProvider.updateAll(context, manager)
        TodayExpenseWidgetProvider.updateAll(context, manager)
        TodayExpenseLargeWidgetProvider.updateAll(context, manager)
        QuickTransactionWidgetProvider.updateAll(context, manager)
        PortfolioWidgetProvider.updateAll(context, manager)
        BudgetAlertWidgetProvider.updateAll(context, manager)
        RecentTransactionsWidgetProvider.updateAll(context, manager)
        RecurringBillReminderWidgetProvider.updateAll(context, manager)
    }
}

data class WidgetDashboardData(
    val hasDashboard: Boolean,
    val period: String,
    val income: String,
    val expense: String,
    val net: String,
    val todayExpense: String,
    val expenseProgress: Int,
    val progressLabel: String,
    val updatedAt: String,
    val netPositive: Boolean,
    val bankBalance: String,
    val stockMarketValue: String,
    val totalAsset: String,
    val hasPortfolio: Boolean,
    val portfolioPl: String,
    val portfolioReturn: String,
    val portfolioPlPositive: Boolean,
    val portfolioUpdatedAt: String,
)

data class WidgetRecentTransactionsData(
    val hasDashboard: Boolean,
    val period: String,
    val updatedAt: String,
    val items: List<WidgetRecentTransaction>,
)

data class WidgetRecentTransaction(
    val title: String,
    val subtitle: String,
    val amount: String,
    val tone: Int,
)

data class WidgetBudgetAlertsData(
    val hasAlerts: Boolean,
    val period: String,
    val updatedAt: String,
    val items: List<WidgetBudgetAlert>,
)

data class WidgetBudgetAlert(
    val name: String,
    val detail: String,
    val percent: String,
    val progress: Int,
    val status: Int,
)

data class WidgetRecurringReminderData(
    val hasReminders: Boolean,
    val updatedAt: String,
    val items: List<WidgetRecurringReminder>,
)

data class WidgetRecurringReminder(
    val title: String,
    val detail: String,
    val amount: String,
    val date: String,
    val status: Int,
)

class MonthlyOverviewWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, MonthlyOverviewWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readDashboard(context)
            val views = RemoteViews(context.packageName, R.layout.widget_monthly_overview)
            views.setTextViewText(
                R.id.widget_monthly_period,
                if (data.hasDashboard) data.period else "尚無資料",
            )
            views.setTextViewText(R.id.widget_monthly_income_value, data.income)
            views.setTextViewText(R.id.widget_monthly_expense_value, data.expense)
            views.setTextViewText(R.id.widget_monthly_net_value, data.net)
            views.setTextViewText(
                R.id.widget_monthly_hint,
                if (data.hasDashboard) data.progressLabel else "開啟 App 更新 Dashboard",
            )
            views.setTextViewText(R.id.widget_monthly_updated_at, data.updatedAt)
            views.setProgressBar(R.id.widget_monthly_progress, 100, data.expenseProgress, false)
            views.setTextColor(
                R.id.widget_monthly_net_value,
                if (data.netPositive) Color.rgb(37, 99, 235) else Color.rgb(220, 38, 38),
            )
            views.setOnClickPendingIntent(
                R.id.widget_monthly_root,
                AssetPilotWidgetIntents.openApp(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

class TodayExpenseWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, TodayExpenseWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readDashboard(context)
            val views = RemoteViews(context.packageName, R.layout.widget_today_expense)
            views.setTextViewText(R.id.widget_today_value, data.todayExpense)
            views.setTextViewText(
                R.id.widget_today_subtitle,
                if (data.hasDashboard) "點一下記一筆" else "開啟 App 更新",
            )
            views.setOnClickPendingIntent(
                R.id.widget_today_root,
                AssetPilotWidgetIntents.newTransaction(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

class TodayExpenseLargeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, TodayExpenseLargeWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readDashboard(context)
            val views = RemoteViews(context.packageName, R.layout.widget_today_expense_large)
            views.setTextViewText(
                R.id.widget_today_large_period,
                if (data.hasDashboard) data.period else "尚無資料",
            )
            views.setTextViewText(R.id.widget_today_large_value, data.todayExpense)
            views.setTextViewText(
                R.id.widget_today_large_subtitle,
                if (data.hasDashboard) "點一下記一筆" else "開啟 App 更新 Dashboard",
            )
            views.setTextViewText(R.id.widget_today_large_updated_at, data.updatedAt)
            views.setOnClickPendingIntent(
                R.id.widget_today_large_root,
                AssetPilotWidgetIntents.newTransaction(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

class QuickTransactionWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, QuickTransactionWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_quick_transaction)
            views.setOnClickPendingIntent(
                R.id.widget_quick_add,
                AssetPilotWidgetIntents.newTransaction(context),
            )
            views.setOnClickPendingIntent(
                R.id.widget_quick_food,
                AssetPilotWidgetIntents.newTransaction(context, "food"),
            )
            views.setOnClickPendingIntent(
                R.id.widget_quick_transport,
                AssetPilotWidgetIntents.newTransaction(context, "transport"),
            )
            views.setOnClickPendingIntent(
                R.id.widget_quick_shopping,
                AssetPilotWidgetIntents.newTransaction(context, "shopping"),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

class PortfolioWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, PortfolioWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readDashboard(context)
            val views = RemoteViews(context.packageName, R.layout.widget_portfolio)
            views.setTextViewText(
                R.id.widget_portfolio_period,
                if (data.hasDashboard) data.period else "尚無資料",
            )
            views.setTextViewText(R.id.widget_portfolio_total_value, data.totalAsset)
            views.setTextViewText(R.id.widget_portfolio_bank_value, data.bankBalance)
            views.setTextViewText(R.id.widget_portfolio_stock_value, data.stockMarketValue)
            views.setTextViewText(
                R.id.widget_portfolio_pl_value,
                if (data.hasPortfolio) data.portfolioPl else "--",
            )
            views.setTextViewText(
                R.id.widget_portfolio_return_value,
                if (data.hasPortfolio) data.portfolioReturn else "開啟股票頁更新",
            )
            views.setTextViewText(
                R.id.widget_portfolio_updated_at,
                data.portfolioUpdatedAt.ifBlank { data.updatedAt },
            )
            views.setTextColor(
                R.id.widget_portfolio_pl_value,
                if (data.portfolioPlPositive) Color.rgb(220, 38, 38) else Color.rgb(22, 163, 74),
            )
            views.setOnClickPendingIntent(
                R.id.widget_portfolio_root,
                AssetPilotWidgetIntents.openApp(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

class BudgetAlertWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        private val rowIds = intArrayOf(
            R.id.widget_budget_row_0,
            R.id.widget_budget_row_1,
            R.id.widget_budget_row_2,
        )
        private val nameIds = intArrayOf(
            R.id.widget_budget_name_0,
            R.id.widget_budget_name_1,
            R.id.widget_budget_name_2,
        )
        private val detailIds = intArrayOf(
            R.id.widget_budget_detail_0,
            R.id.widget_budget_detail_1,
            R.id.widget_budget_detail_2,
        )
        private val percentIds = intArrayOf(
            R.id.widget_budget_percent_0,
            R.id.widget_budget_percent_1,
            R.id.widget_budget_percent_2,
        )
        private val progressIds = intArrayOf(
            R.id.widget_budget_progress_0,
            R.id.widget_budget_progress_1,
            R.id.widget_budget_progress_2,
        )
        private val statusIds = intArrayOf(
            R.id.widget_budget_status_0,
            R.id.widget_budget_status_1,
            R.id.widget_budget_status_2,
        )

        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, BudgetAlertWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readBudgetAlerts(context)
            val views = RemoteViews(context.packageName, R.layout.widget_budget_alert)
            views.setTextViewText(R.id.widget_budget_period, data.period)
            views.setTextViewText(
                R.id.widget_budget_empty,
                if (data.hasAlerts) "目前沒有預算警戒" else "開啟 App 更新預算",
            )
            views.setTextViewText(R.id.widget_budget_updated_at, data.updatedAt)

            val hasRows = data.items.isNotEmpty()
            views.setViewVisibility(R.id.widget_budget_empty, if (hasRows) View.GONE else View.VISIBLE)
            for (index in 0 until MAX_BUDGET_ALERTS) {
                val item = data.items.getOrNull(index)
                views.setViewVisibility(rowIds[index], if (item == null) View.GONE else View.VISIBLE)
                if (item != null) {
                    val color = budgetStatusColor(item.status)
                    views.setTextViewText(nameIds[index], item.name)
                    views.setTextViewText(detailIds[index], item.detail)
                    views.setTextViewText(percentIds[index], item.percent)
                    views.setTextColor(percentIds[index], color)
                    views.setProgressBar(progressIds[index], 100, item.progress, false)
                    views.setTextViewText(statusIds[index], budgetStatusLabel(item.status))
                    views.setTextColor(statusIds[index], color)
                }
            }
            views.setOnClickPendingIntent(
                R.id.widget_budget_root,
                AssetPilotWidgetIntents.openApp(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun budgetStatusLabel(status: Int): String = when (status) {
            2 -> "超支"
            1 -> "接近"
            else -> "正常"
        }

        private fun budgetStatusColor(status: Int): Int = when (status) {
            2 -> Color.rgb(220, 38, 38)
            1 -> Color.rgb(217, 119, 6)
            else -> Color.rgb(22, 163, 74)
        }
    }
}

class RecentTransactionsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        private val rowIds = intArrayOf(
            R.id.widget_recent_row_0,
            R.id.widget_recent_row_1,
            R.id.widget_recent_row_2,
            R.id.widget_recent_row_3,
            R.id.widget_recent_row_4,
        )
        private val titleIds = intArrayOf(
            R.id.widget_recent_title_0,
            R.id.widget_recent_title_1,
            R.id.widget_recent_title_2,
            R.id.widget_recent_title_3,
            R.id.widget_recent_title_4,
        )
        private val subtitleIds = intArrayOf(
            R.id.widget_recent_subtitle_0,
            R.id.widget_recent_subtitle_1,
            R.id.widget_recent_subtitle_2,
            R.id.widget_recent_subtitle_3,
            R.id.widget_recent_subtitle_4,
        )
        private val amountIds = intArrayOf(
            R.id.widget_recent_amount_0,
            R.id.widget_recent_amount_1,
            R.id.widget_recent_amount_2,
            R.id.widget_recent_amount_3,
            R.id.widget_recent_amount_4,
        )

        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, RecentTransactionsWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readRecentTransactions(context)
            val views = RemoteViews(context.packageName, R.layout.widget_recent_transactions)
            views.setTextViewText(
                R.id.widget_recent_period,
                if (data.hasDashboard) data.period else "尚無資料",
            )
            views.setTextViewText(
                R.id.widget_recent_empty,
                if (data.hasDashboard) "目前沒有近期交易" else "開啟 App 更新 Dashboard",
            )
            views.setTextViewText(R.id.widget_recent_updated_at, data.updatedAt)

            val hasRows = data.items.isNotEmpty()
            views.setViewVisibility(R.id.widget_recent_empty, if (hasRows) View.GONE else View.VISIBLE)
            for (index in 0 until MAX_RECENT_TRANSACTIONS) {
                val item = data.items.getOrNull(index)
                views.setViewVisibility(rowIds[index], if (item == null) View.GONE else View.VISIBLE)
                if (item != null) {
                    views.setTextViewText(titleIds[index], item.title)
                    views.setTextViewText(subtitleIds[index], item.subtitle)
                    views.setTextViewText(amountIds[index], item.amount)
                    views.setTextColor(amountIds[index], toneColor(item.tone))
                }
            }
            views.setOnClickPendingIntent(
                R.id.widget_recent_root,
                AssetPilotWidgetIntents.openApp(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun toneColor(tone: Int): Int = when (tone) {
            1 -> Color.rgb(22, 163, 74)
            2 -> Color.rgb(220, 38, 38)
            else -> Color.rgb(75, 85, 99)
        }
    }
}

class RecurringBillReminderWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { update(context, appWidgetManager, it) }
    }

    companion object {
        private val rowIds = intArrayOf(
            R.id.widget_reminder_row_0,
            R.id.widget_reminder_row_1,
            R.id.widget_reminder_row_2,
            R.id.widget_reminder_row_3,
            R.id.widget_reminder_row_4,
        )
        private val titleIds = intArrayOf(
            R.id.widget_reminder_title_0,
            R.id.widget_reminder_title_1,
            R.id.widget_reminder_title_2,
            R.id.widget_reminder_title_3,
            R.id.widget_reminder_title_4,
        )
        private val detailIds = intArrayOf(
            R.id.widget_reminder_detail_0,
            R.id.widget_reminder_detail_1,
            R.id.widget_reminder_detail_2,
            R.id.widget_reminder_detail_3,
            R.id.widget_reminder_detail_4,
        )
        private val amountIds = intArrayOf(
            R.id.widget_reminder_amount_0,
            R.id.widget_reminder_amount_1,
            R.id.widget_reminder_amount_2,
            R.id.widget_reminder_amount_3,
            R.id.widget_reminder_amount_4,
        )
        private val dateIds = intArrayOf(
            R.id.widget_reminder_date_0,
            R.id.widget_reminder_date_1,
            R.id.widget_reminder_date_2,
            R.id.widget_reminder_date_3,
            R.id.widget_reminder_date_4,
        )

        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager = AppWidgetManager.getInstance(context),
        ) {
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, RecurringBillReminderWidgetProvider::class.java),
            )
            ids.forEach { update(context, appWidgetManager, it) }
        }

        private fun update(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val data = AssetPilotWidgetStore.readRecurringReminders(context)
            val views = RemoteViews(context.packageName, R.layout.widget_recurring_bill_reminder)
            views.setTextViewText(
                R.id.widget_reminder_empty,
                if (data.hasReminders) "目前沒有即將扣款" else "開啟 App 更新提醒",
            )
            views.setTextViewText(R.id.widget_reminder_updated_at, data.updatedAt)

            val hasRows = data.items.isNotEmpty()
            views.setViewVisibility(R.id.widget_reminder_empty, if (hasRows) View.GONE else View.VISIBLE)
            for (index in 0 until MAX_RECURRING_REMINDERS) {
                val item = data.items.getOrNull(index)
                views.setViewVisibility(rowIds[index], if (item == null) View.GONE else View.VISIBLE)
                if (item != null) {
                    val color = reminderStatusColor(item.status)
                    views.setTextViewText(titleIds[index], item.title)
                    views.setTextViewText(detailIds[index], item.detail)
                    views.setTextViewText(amountIds[index], item.amount)
                    views.setTextViewText(dateIds[index], item.date)
                    views.setTextColor(amountIds[index], Color.rgb(220, 38, 38))
                    views.setTextColor(dateIds[index], color)
                }
            }
            views.setOnClickPendingIntent(
                R.id.widget_reminder_root,
                AssetPilotWidgetIntents.openApp(context),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun reminderStatusColor(status: Int): Int = when (status) {
            2 -> Color.rgb(220, 38, 38)
            1 -> Color.rgb(217, 119, 6)
            else -> Color.rgb(37, 99, 235)
        }
    }
}

object AssetPilotWidgetIntents {
    fun openApp(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            context,
            requestCode("open"),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun newTransaction(context: Context, category: String? = null): PendingIntent {
        val uriBuilder = Uri.Builder()
            .scheme("assetpilot")
            .authority("transaction")
            .path("/new")
            .appendQueryParameter("source", "widget")
            .appendQueryParameter("tap", System.currentTimeMillis().toString())
        if (!category.isNullOrBlank()) {
            uriBuilder.appendQueryParameter("category", category)
        }
        val intent = Intent(Intent.ACTION_VIEW, uriBuilder.build(), context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            context,
            requestCode("transaction-${category ?: "new"}"),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun requestCode(seed: String): Int = 1000 + ((seed.hashCode() and Int.MAX_VALUE) % 10000)
}

private fun Map<*, *>.string(key: String, fallback: String): String =
    this[key]?.toString()?.takeIf { it.isNotBlank() } ?: fallback

private fun Map<*, *>.int(key: String): Int =
    when (val value = this[key]) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull() ?: 0
        else -> 0
    }

private fun Map<*, *>.boolean(key: String, fallback: Boolean): Boolean =
    when (val value = this[key]) {
        is Boolean -> value
        is String -> value == "true" || value == "1"
        is Number -> value.toInt() != 0
        else -> fallback
    }

private fun budgetNameKey(index: Int) = "budgetName$index"
private fun budgetDetailKey(index: Int) = "budgetDetail$index"
private fun budgetPercentKey(index: Int) = "budgetPercent$index"
private fun budgetProgressKey(index: Int) = "budgetProgress$index"
private fun budgetStatusKey(index: Int) = "budgetStatus$index"
private fun recentTitleKey(index: Int) = "recentTitle$index"
private fun recentSubtitleKey(index: Int) = "recentSubtitle$index"
private fun recentAmountKey(index: Int) = "recentAmount$index"
private fun recentToneKey(index: Int) = "recentTone$index"
private fun reminderTitleKey(index: Int) = "reminderTitle$index"
private fun reminderDetailKey(index: Int) = "reminderDetail$index"
private fun reminderAmountKey(index: Int) = "reminderAmount$index"
private fun reminderDateKey(index: Int) = "reminderDate$index"
private fun reminderStatusKey(index: Int) = "reminderStatus$index"
