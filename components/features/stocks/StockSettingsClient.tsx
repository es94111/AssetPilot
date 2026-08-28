"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPut, apiPost, apiPatch, apiDelete } from "@/lib/clientApi";
import StocksTabNav from "./StocksTabNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/components/i18n/I18nProvider";
import { localeTag } from "@/lib/i18n/localeTag";
import { Plus, Edit3, Trash2, Pause, Play } from "lucide-react";

const FREQUENCY_VALUES = ["daily", "weekly", "monthly", "yearly"] as const;
const DEFAULT_SETTINGS = {
  feeRate: 0.001425,
  feeDiscount: 0.6,
  feeMinLot: 20,
  feeMinOdd: 1,
  sellTaxRateStock: 0.003,
  sellTaxRateEtf: 0.001,
  sellTaxRateWarrant: 0.001,
  sellTaxMin: 1,
};
const EMPTY_REC_FORM = {
  stockId: "",
  amount: "",
  frequency: "monthly",
  startDate: "",
  accountId: "",
  note: "",
};

function fmtCurrency(n: number | string, currency: string, locale: string) {
  const code = String(currency || "TWD").toUpperCase();
  const digits = code === "TWD" ? 0 : 2;
  return `${code === "TWD" ? "NT$" : "$"} ${(Number(n) || 0).toLocaleString(localeTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function StockSettingsClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [stocks, setStocks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [recForm, setRecForm] = useState(EMPTY_REC_FORM);
  const [recEditId, setRecEditId] = useState<string | null>(null);
  const [recSaving, setRecSaving] = useState(false);
  const [recFormError, setRecFormError] = useState("");
  const [stockStatusMsg, setStockStatusMsg] = useState("");
  const [recDialogOpen, setRecDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, stockResp, accts, recList] = await Promise.all([
        apiGet("/api/stock-settings").catch(() => DEFAULT_SETTINGS),
        apiGet("/api/stocks").catch(() => []),
        apiGet("/api/accounts").catch(() => []),
        apiGet("/api/stock-recurring").catch(() => []),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...(s || {}) });
      const stockList = Array.isArray(stockResp)
        ? stockResp
        : stockResp?.stocks || [];
      setStocks(stockList);
      setAccounts(accts);
      setRecs(recList || []);
    } catch (error) {
      if (process.env.NODE_ENV === "development")
        console.warn("[stock-settings] load failed", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      await apiPut("/api/stock-settings", {
        feeRate: Number(settings.feeRate),
        feeDiscount: Number(settings.feeDiscount),
        feeMinLot: Number(settings.feeMinLot),
        feeMinOdd: Number(settings.feeMinOdd),
        sellTaxRateStock: Number(settings.sellTaxRateStock),
        sellTaxRateEtf: Number(settings.sellTaxRateEtf),
        sellTaxRateWarrant: Number(settings.sellTaxRateWarrant),
        sellTaxMin: Number(settings.sellTaxMin),
      });
      setSaveMsg(t("features.stocks.settings.messages.saved"));
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e: any) {
      setSaveMsg(
        t("features.stocks.settings.messages.saveFailed", {
          message: e.message,
        }),
      );
    }
    setSaving(false);
  }

  async function handleRecSave(e: React.FormEvent) {
    e.preventDefault();
    if (!recForm.stockId) {
      setRecFormError(t("features.stocks.settings.messages.stockRequired"));
      return;
    }
    if (!recForm.amount || Number(recForm.amount) <= 0) {
      setRecFormError(t("features.stocks.settings.messages.amountRequired"));
      return;
    }
    setRecSaving(true);
    setRecFormError("");
    const body = {
      stockId: recForm.stockId,
      amount: Number(recForm.amount),
      frequency: recForm.frequency,
      startDate: recForm.startDate,
      accountId: recForm.accountId || null,
      note: recForm.note,
    };
    try {
      if (recEditId) {
        await apiPut(`/api/stock-recurring/${recEditId}`, body);
      } else {
        await apiPost("/api/stock-recurring", body);
      }
      const recList = await apiGet("/api/stock-recurring").catch(() => []);
      setRecs(recList || []);
      setRecDialogOpen(false);
    } catch (e: any) {
      setRecFormError(e.message);
    }
    setRecSaving(false);
  }

  function openRecCreate() {
    setRecForm({
      ...EMPTY_REC_FORM,
      startDate: new Date().toISOString().slice(0, 10),
      stockId: stocks[0]?.id || "",
    });
    setRecEditId(null);
    setRecFormError("");
    setRecDialogOpen(true);
  }

  function openRecEdit(rec: any) {
    setRecForm({
      stockId: rec.stockId || rec.stock_id,
      amount: rec.amount,
      frequency: rec.frequency,
      startDate: rec.startDate || rec.start_date,
      accountId: rec.accountId || rec.account_id || "",
      note: rec.note || "",
    });
    setRecEditId(rec.id);
    setRecFormError("");
    setRecDialogOpen(true);
  }

  async function handleToggleRec(id: string) {
    try {
      await apiPatch(`/api/stock-recurring/${id}/toggle`);
      const recList = await apiGet("/api/stock-recurring").catch(() => []);
      setRecs(recList || []);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDeleteRec(id: string) {
    if (!confirm(t("features.stocks.settings.deleteRecurringConfirm"))) return;
    try {
      await apiDelete(`/api/stock-recurring/${id}`);
      const recList = await apiGet("/api/stock-recurring").catch(() => []);
      setRecs(recList || []);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleToggleDelisted(stock: any) {
    setStockStatusMsg("");
    try {
      await apiPost("/api/stocks/batch-price", {
        updates: [
          {
            stockId: stock.id,
            currentPrice: stock.currentPrice || 0,
            delisted: !stock.delisted,
          },
        ],
      });
      setStockStatusMsg(
        t("features.stocks.settings.messages.stockStatusUpdated", {
          symbol: stock.symbol,
          status: stock.delisted
            ? t("features.stocks.settings.messages.restoredStatus")
            : t("features.stocks.settings.messages.delistedStatus"),
        }),
      );
      await load();
    } catch (e: any) {
      setStockStatusMsg(
        e.message ||
          t("features.stocks.settings.messages.delistedUpdateFailed"),
      );
    }
  }

  if (loading)
    return <div className="p-8 space-y-4" aria-busy="true"><div className="ui-skeleton h-10 w-full" /><div className="ui-skeleton h-48 w-full" /></div>;
  const frequencyOptions = FREQUENCY_VALUES.map((value) => ({
    label: t(`features.stocks.settings.frequencyLabels.${value}`),
    value,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {t("features.stocks.settings.title")}
      </h2>
      <StocksTabNav />

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">
          {t("features.stocks.settings.feeTitle")}
        </h3>
        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Input
            label={t("features.stocks.settings.feeRate")}
            type="number"
            step="0.000001"
            value={settings.feeRate}
            onChange={(e) =>
              setSettings((s) => ({ ...s, feeRate: Number(e.target.value) }))
            }
          />
          <Input
            label={t("features.stocks.settings.feeDiscount")}
            type="number"
            step="0.01"
            value={settings.feeDiscount}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                feeDiscount: Number(e.target.value),
              }))
            }
          />
          <Input
            label={t("features.stocks.settings.feeMinLot")}
            type="number"
            value={settings.feeMinLot}
            onChange={(e) =>
              setSettings((s) => ({ ...s, feeMinLot: Number(e.target.value) }))
            }
          />
          <Input
            label={t("features.stocks.settings.feeMinOdd")}
            type="number"
            value={settings.feeMinOdd}
            onChange={(e) =>
              setSettings((s) => ({ ...s, feeMinOdd: Number(e.target.value) }))
            }
          />
          <Input
            label={t("features.stocks.settings.sellTaxRateStock")}
            type="number"
            step="0.0001"
            value={settings.sellTaxRateStock}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                sellTaxRateStock: Number(e.target.value),
              }))
            }
          />
          <Input
            label={t("features.stocks.settings.sellTaxRateEtf")}
            type="number"
            step="0.0001"
            value={settings.sellTaxRateEtf}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                sellTaxRateEtf: Number(e.target.value),
              }))
            }
          />
          <Input
            label={t("features.stocks.settings.sellTaxRateWarrant")}
            type="number"
            step="0.0001"
            value={settings.sellTaxRateWarrant}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                sellTaxRateWarrant: Number(e.target.value),
              }))
            }
          />
          <Input
            label={t("features.stocks.settings.sellTaxMin")}
            type="number"
            value={settings.sellTaxMin}
            onChange={(e) =>
              setSettings((s) => ({ ...s, sellTaxMin: Number(e.target.value) }))
            }
          />
          <div className="col-span-full">
            {saveMsg && (
              <p
                className={`text-sm mb-2 ${saveMsg === t("features.stocks.settings.messages.saved") ? "text-green-600" : "text-red-500"}`}
              >
                {saveMsg}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving
                ? t("common.saving")
                : t("features.stocks.settings.saveSettings")}
            </Button>
          </div>
        </form>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {t("features.stocks.settings.stockStatusTitle")}
          </h3>
          {stockStatusMsg && (
            <span className="text-sm text-slate-600">{stockStatusMsg}</span>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("features.common.stock")}</TableHead>
              <TableHead>
                {t("features.stocks.settings.currentPrice")}
              </TableHead>
              <TableHead>{t("features.common.status")}</TableHead>
              <TableHead>{t("features.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock) => (
              <TableRow key={stock.id}>
                <TableCell>
                  {String(stock.market || "TW").toUpperCase() === "US"
                    ? t("features.stocks.common.marketUs")
                    : t("features.stocks.common.marketTaiwan")}{" "}
                  · {stock.symbol} {stock.name}
                </TableCell>
                <TableCell>
                  {fmtCurrency(
                    stock.currentPrice || stock.current_price || 0,
                    stock.currency,
                    locale,
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${stock.delisted ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
                  >
                    {stock.delisted
                      ? t("features.stocks.settings.delisted")
                      : t("features.stocks.settings.normalTracking")}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleDelisted(stock)}
                  >
                    {stock.delisted
                      ? t("features.stocks.settings.restoreTracking")
                      : t("features.stocks.settings.markDelisted")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {t("features.stocks.settings.recurringTitle")}
          </h3>
          <Dialog open={recDialogOpen} onOpenChange={setRecDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openRecCreate}>
                <Plus size={16} className="mr-2" />{" "}
                {t("features.stocks.settings.addRecurringShort")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {recEditId
                    ? t("features.stocks.settings.editRecurring")
                    : t("features.stocks.settings.newRecurring")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRecSave} className="space-y-4">
                <Select
                  label={t("features.stocks.common.stockRequired")}
                  options={stocks.map((s) => ({
                    label: `${s.symbol} ${s.name}`,
                    value: s.id,
                  }))}
                  value={recForm.stockId}
                  onChange={(e) =>
                    setRecForm((f) => ({ ...f, stockId: e.target.value }))
                  }
                />
                <Input
                  label={t("features.stocks.settings.recurringAmountLabel")}
                  type="number"
                  value={recForm.amount}
                  onChange={(e) =>
                    setRecForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <Select
                  label={t("features.stocks.settings.frequency")}
                  options={frequencyOptions}
                  value={recForm.frequency}
                  onChange={(e) =>
                    setRecForm((f) => ({ ...f, frequency: e.target.value }))
                  }
                />
                <Input
                  label={t("features.stocks.settings.startDate")}
                  type="date"
                  value={recForm.startDate}
                  onChange={(e) =>
                    setRecForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
                <Select
                  label={t("features.common.account")}
                  options={accounts.map((a) => ({
                    label: a.name,
                    value: a.id,
                  }))}
                  value={recForm.accountId}
                  onChange={(e) =>
                    setRecForm((f) => ({ ...f, accountId: e.target.value }))
                  }
                />
                <Input
                  label={t("features.common.note")}
                  value={recForm.note}
                  onChange={(e) =>
                    setRecForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
                {recFormError && (
                  <p className="text-red-500 text-sm">{recFormError}</p>
                )}
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={recSaving}>
                    {recSaving ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("features.common.stock")}</TableHead>
              <TableHead>{t("features.common.amount")}</TableHead>
              <TableHead>{t("features.stocks.settings.frequency")}</TableHead>
              <TableHead>
                {t("features.stocks.settings.lastGenerated")}
              </TableHead>
              <TableHead>{t("features.common.status")}</TableHead>
              <TableHead>{t("features.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recs.map((r) => {
              const stockInfo = stocks.find(
                (s) => s.id === (r.stockId || r.stock_id),
              );
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {stockInfo
                      ? `${String(stockInfo.market || "TW").toUpperCase() === "US" ? t("features.stocks.common.marketUs") : t("features.stocks.common.marketTaiwan")} · ${stockInfo.symbol} ${stockInfo.name}`
                      : r.symbol || "—"}
                  </TableCell>
                  <TableCell>
                    {fmtCurrency(
                      r.amount,
                      stockInfo?.currency || r.currency,
                      locale,
                    )}
                  </TableCell>
                  <TableCell>
                    {t(
                      `features.stocks.settings.frequencyLabels.${r.frequency}`,
                    ) || r.frequency}
                  </TableCell>
                  <TableCell>
                    {r.lastGenerated ||
                      r.last_generated ||
                      t("features.common.notRecorded")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${r.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {r.isActive
                        ? t("features.stocks.settings.active")
                        : t("features.stocks.settings.inactive")}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleRec(r.id)}
                    >
                      {r.isActive ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openRecEdit(r)}
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => handleDeleteRec(r.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
