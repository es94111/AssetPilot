"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/i18n/I18nProvider";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeMonth(value: string | null) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : currentMonth();
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function displayMonth(value: string, locale: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-TW", {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, 1));
}

export function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useT();
  const selectedMonth = normalizeMonth(searchParams.get("month"));
  const thisMonth = currentMonth();

  function navigateToMonth(month: string) {
    const params = new URLSearchParams(searchParams);
    if (month === thisMonth) {
      params.delete("month");
    } else {
      params.set("month", month);
    }
    const query = params.toString();
    router.push(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => navigateToMonth(shiftMonth(selectedMonth, -1))}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        title={t("dashboard.filters.previousMonth")}
        aria-label={t("dashboard.filters.previousMonth")}
      >
        <ChevronLeft size={18} />
      </button>
      <div
        className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
      >
        <CalendarDays size={16} />
        <span>{displayMonth(selectedMonth, locale)}</span>
      </div>
      <button
        type="button"
        onClick={() => navigateToMonth(shiftMonth(selectedMonth, 1))}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        title={t("dashboard.filters.nextMonth")}
        aria-label={t("dashboard.filters.nextMonth")}
      >
        <ChevronRight size={18} />
      </button>
      {selectedMonth !== thisMonth && (
        <button
          type="button"
          onClick={() => navigateToMonth(thisMonth)}
          className="h-10 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {t("dashboard.filters.currentMonth")}
        </button>
      )}
    </div>
  );
}
