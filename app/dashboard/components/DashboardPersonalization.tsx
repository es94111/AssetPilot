"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, LayoutDashboard, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  type DashboardLayoutPreference,
  type DashboardModuleId,
} from "@/lib/dashboardPreferences";

const labelKeys: Record<DashboardModuleId, string> = {
  assets: "dashboard.personalize.modules.assets",
  attention: "dashboard.personalize.modules.attention",
  cashOutlook: "dashboard.personalize.modules.cashOutlook",
  whyChanged: "dashboard.personalize.modules.whyChanged",
  savingsScenario: "dashboard.personalize.modules.savingsScenario",
  spending: "dashboard.personalize.modules.spending",
  portfolioHealth: "dashboard.personalize.modules.portfolioHealth",
  incomeRecent: "dashboard.personalize.modules.incomeRecent",
};

export function DashboardPersonalization({
  initialLayout,
  updatedAt,
}: {
  initialLayout: DashboardLayoutPreference;
  updatedAt: number;
}) {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function resetDraft() {
    setLayout(initialLayout);
    setMessage(null);
  }

  function onOpenChange(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (next) resetDraft();
  }

  function move(id: DashboardModuleId, delta: -1 | 1) {
    setLayout(current => {
      const order = [...current.moduleOrder];
      const index = order.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, moduleOrder: order };
    });
  }

  function toggle(id: DashboardModuleId) {
    setLayout(current => ({
      ...current,
      hiddenModules: current.hiddenModules.includes(id)
        ? current.hiddenModules.filter(item => item !== id)
        : [...current.hiddenModules, id],
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/user/settings/dashboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, expectedUpdatedAt: updatedAt }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || t("dashboard.personalize.saveError"));
      }
      setMessage({ kind: "success", text: t("dashboard.personalize.saved") });
      router.refresh();
      setOpen(false);
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : t("dashboard.personalize.saveError"),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <span className="sr-only" role="status" aria-live="polite">
      {message?.kind === "success" ? message.text : ""}
    </span>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LayoutDashboard size={17} aria-hidden="true" />
          {t("dashboard.personalize.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg" closeLabel={t("common.close")} showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t("dashboard.personalize.title")}</DialogTitle>
          <DialogDescription>{t("dashboard.personalize.description")}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-2">
          {layout.moduleOrder.map((id, index) => {
            const label = t(labelKeys[id]);
            const visible = !layout.hiddenModules.includes(id);
            return (
              <li key={id} aria-posinset={index + 1} aria-setsize={layout.moduleOrder.length} className="flex min-h-14 items-center gap-2 rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-1">
                  <input
                    type="checkbox"
                    checked={visible}
                    disabled={saving}
                    onChange={() => toggle(id)}
                    className="h-5 w-5 rounded"
                  />
                  <span className="truncate font-medium" style={{ color: "var(--text)" }}>{label}</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(id, -1)}
                  aria-disabled={saving || index === 0}
                  disabled={saving || index === 0}
                  aria-label={t("dashboard.personalize.moveUp", { module: label })}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={saving || index === layout.moduleOrder.length - 1}
                  onClick={() => move(id, 1)}
                  aria-label={t("dashboard.personalize.moveDown", { module: label })}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ol>

        {message?.kind === "error" && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            {message.text}
          </p>
        )}

        <DialogFooter className="sticky bottom-0 flex-col sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
          <Button type="button" variant="ghost" onClick={() => setLayout(DEFAULT_DASHBOARD_LAYOUT)} disabled={saving}>
            <RotateCcw aria-hidden="true" /> {t("dashboard.personalize.reset")}
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? t("common.saving") : t("dashboard.personalize.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
