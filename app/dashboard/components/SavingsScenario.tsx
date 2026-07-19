"use client";

import { useMemo, useState } from "react";
import { Calculator, Minus, Plus } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { localeTag } from "@/lib/i18n/localeTag";

const horizons = [6, 12, 24] as const;

function clampAdjustment(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1_000_000, Math.min(1_000_000, Math.round(value)));
}

export function SavingsScenario() {
  const { locale, t } = useT();
  const [monthlyAdjustment, setMonthlyAdjustment] = useState(5_000);
  const [months, setMonths] = useState<number>(12);
  const difference = useMemo(() => monthlyAdjustment * months, [monthlyAdjustment, months]);
  const money = (value: number) => `NT$ ${Math.abs(value).toLocaleString(localeTag(locale), { maximumFractionDigits: 0 })}`;
  const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${money(value)}`;

  return (
    <section className="section-card" aria-labelledby="dashboard-scenario-title">
      <div className="section-card-header">
        <div>
          <h2 id="dashboard-scenario-title" className="section-card-title">{t("dashboard.scenario.title")}</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{t("dashboard.scenario.subtitle")}</p>
        </div>
        <Calculator size={22} style={{ color: "var(--primary)" }} aria-hidden="true" />
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor="scenario-monthly-adjustment" className="mb-2 block text-sm font-semibold" style={{ color: "var(--text)" }}>
            {t("dashboard.scenario.monthlyAdjustment")}
          </label>
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setMonthlyAdjustment(value => clampAdjustment(value - 500))} aria-label={t("dashboard.scenario.decrease")}>
              <Minus aria-hidden="true" />
            </Button>
            <input
              id="scenario-monthly-adjustment"
              type="number"
              inputMode="numeric"
              step="500"
              min="-1000000"
              max="1000000"
              value={monthlyAdjustment}
              onChange={event => setMonthlyAdjustment(clampAdjustment(Number(event.target.value)))}
              className="h-11 min-w-0 rounded-xl border bg-transparent px-3 text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setMonthlyAdjustment(value => clampAdjustment(value + 500))} aria-label={t("dashboard.scenario.increase")}>
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold" style={{ color: "var(--text)" }}>{t("dashboard.scenario.horizon")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {horizons.map(value => (
              <Button
                key={value}
                type="button"
                variant={months === value ? "default" : "outline"}
                aria-pressed={months === value}
                onClick={() => setMonths(value)}
              >
                {t("dashboard.scenario.months", { count: value })}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="rounded-2xl p-4" style={{ background: "var(--surface-hover)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("dashboard.scenario.difference")}</p>
          <p className="mt-1 break-all text-2xl font-bold tabular-nums" style={{ color: difference >= 0 ? "var(--net)" : "var(--danger)" }} aria-live="polite" aria-atomic="true">
            {difference >= 0 ? "+" : "−"}{money(difference)}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("dashboard.scenario.summary", { monthly: signedMoney(monthlyAdjustment), months, difference: signedMoney(difference) })}
          </p>
        </div>

        <p className="rounded-xl border border-dashed p-3 text-xs leading-relaxed" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {t("dashboard.scenario.disclaimer")}
        </p>
      </div>
    </section>
  );
}
