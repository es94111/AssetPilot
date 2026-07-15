package com.assetpilot.assetpilot

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class AssetPilotWidgetSyncWorkerTest {
    @Test
    fun parseDashboardAndFormatWidgetSnapshot() {
        val dashboard = AssetPilotWidgetBackgroundSync.parseDashboard(
            """
            {
              "yearMonth": "2026-07",
              "income": "50000",
              "expense": 12500,
              "todayExpense": 350,
              "bankBalance": 100000,
              "stockMarketValue": 25000,
              "recent": [
                {
                  "type": "expense",
                  "date": "2026-07-15",
                  "cat_name": "餐飲",
                  "note": "午餐",
                  "amount": 120,
                  "original_amount": 4,
                  "currency": "USD"
                },
                {
                  "type": "income",
                  "date": "2026-07-14",
                  "catName": "薪資",
                  "note": "",
                  "amount": 50000,
                  "currency": "TWD"
                }
              ]
            }
            """.trimIndent(),
        )

        val args = AssetPilotWidgetBackgroundSync.toWidgetArgs(
            dashboard,
            LocalDateTime.of(2026, 7, 15, 9, 5),
        )

        assertEquals("2026-07", args["period"])
        assertEquals("NT$ 50,000", args["incomeLabel"])
        assertEquals("NT$ 12,500", args["expenseLabel"])
        assertEquals("+NT$ 37,500", args["netLabel"])
        assertEquals("NT$ 350", args["todayExpenseLabel"])
        assertEquals("NT$ 125,000", args["totalAssetLabel"])
        assertEquals("支出為收入的 25%", args["progressLabel"])
        assertEquals(25, args["expenseProgress"])
        assertEquals("09:05 更新", args["updatedAtLabel"])
        assertEquals(2, args["recentCount"])
        assertEquals("餐飲", args["recentTitle0"])
        assertEquals("7/15・午餐", args["recentSubtitle0"])
        assertEquals("-USD 4.00", args["recentAmount0"])
        assertEquals(2, args["recentTone0"])
        assertEquals("+TWD 50,000", args["recentAmount1"])
        assertEquals(1, args["recentTone1"])
        assertTrue(args["netPositive"] as Boolean)
    }

    @Test
    fun formatNegativeNetAndClampProgress() {
        val args = AssetPilotWidgetBackgroundSync.toWidgetArgs(
            WidgetSyncDashboard(
                yearMonth = "2026-07",
                income = 0.0,
                expense = 800.0,
                todayExpense = 800.0,
                bankBalance = 0.0,
                stockMarketValue = 0.0,
                recent = emptyList(),
            ),
            LocalDateTime.of(2026, 7, 15, 23, 59),
        )

        assertEquals(100, args["expenseProgress"])
        assertEquals("本月已有支出", args["progressLabel"])
        assertFalse(args["netPositive"] as Boolean)
        assertEquals(0, args["recentCount"])
    }
}
