"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/clientApi";
import StocksTabNav from "./StocksTabNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Trash2, Edit3, RefreshCw } from "lucide-react";

function fmtCurrency(n: number | string, currency: string, locale: string) {
  const code = String(currency || "TWD").toUpperCase();
  const digits = code === "TWD" ? 0 : 2;
  return `${code === "TWD" ? "NT$" : "$"} ${(Number(n) || 0).toLocaleString(localeTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const EMPTY_FORM = {
  stockId: "",
  date: "",
  cashDividend: "",
  stockDividendShares: "",
  accountId: "",
  note: "",
};
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type QueryParams = { get(name: string): string | null };

function readPageParam(searchParams: QueryParams) {
  return Math.max(1, Number(searchParams.get("page")) || 1);
}

function readPageSizeParam(searchParams: QueryParams) {
  const value = Number(searchParams.get("pageSize")) || 20;
  return PAGE_SIZE_OPTIONS.includes(value) ? value : 20;
}

export default function DividendsClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [divs, setDivs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => readPageParam(searchParams));
  const [pageSize, setPageSize] = useState(() =>
    readPageSizeParam(searchParams),
  );
  const [stocks, setStocks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStockId, setFilterStockId] = useState(
    () => searchParams.get("stockId") || "",
  );
  const [filterDateFrom, setFilterDateFrom] = useState(
    () => searchParams.get("dateFrom") || "",
  );
  const [filterDateTo, setFilterDateTo] = useState(
    () => searchParams.get("dateTo") || "",
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncModal, setSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(pageSize),
        });
        if (filterStockId) params.set("stockId", filterStockId);
        if (filterDateFrom) params.set("dateFrom", filterDateFrom);
        if (filterDateTo) params.set("dateTo", filterDateTo);
        const result = await apiGet(`/api/stock-dividends?${params}`);
        setDivs(result.data || result.dividends || []);
        setTotal(result.total || 0);
      } catch (error) {
        if (process.env.NODE_ENV === "development")
          console.warn("[stock-dividends] load failed", error);
      }
      setLoading(false);
    },
    [page, pageSize, filterStockId, filterDateFrom, filterDateTo],
  );

  const loadMeta = useCallback(async () => {
    const [stockResp, acctResp] = await Promise.all([
      apiGet("/api/stocks").catch(() => []),
      apiGet("/api/accounts").catch(() => []),
    ]);
    setStocks(Array.isArray(stockResp) ? stockResp : stockResp?.stocks || []);
    setAccounts(Array.isArray(acctResp) ? acctResp : []);
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);
  useEffect(() => {
    load(page);
  }, [page, load]);

  useEffect(() => {
    const nextPage = readPageParam(searchParams);
    const nextPageSize = readPageSizeParam(searchParams);
    const nextStockId = searchParams.get("stockId") || "";
    const nextDateFrom = searchParams.get("dateFrom") || "";
    const nextDateTo = searchParams.get("dateTo") || "";
    if (nextPage !== page) setPage(nextPage);
    if (nextPageSize !== pageSize) setPageSize(nextPageSize);
    if (nextStockId !== filterStockId) setFilterStockId(nextStockId);
    if (nextDateFrom !== filterDateFrom) setFilterDateFrom(nextDateFrom);
    if (nextDateTo !== filterDateTo) setFilterDateTo(nextDateTo);
  }, [currentQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (filterStockId) params.set("stockId", filterStockId);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    const nextQuery = params.toString();
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [
    currentQuery,
    filterStockId,
    filterDateFrom,
    filterDateTo,
    page,
    pageSize,
    pathname,
    router,
  ]);

  function updateFilter(setter: (value: string) => void, value: string) {
    setPage(1);
    setter(value);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.stockId) {
      setFormError(t("features.stocks.dividends.messages.stockRequired"));
      return;
    }
    if (!form.cashDividend && !form.stockDividendShares) {
      setFormError(t("features.stocks.dividends.messages.dividendRequired"));
      return;
    }
    setSaving(true);
    setFormError("");
    const body = {
      stockId: form.stockId,
      date: form.date,
      cashDividend: Number(form.cashDividend) || 0,
      stockDividendShares: Number(form.stockDividendShares) || 0,
      accountId: form.accountId || null,
      note: form.note,
    };
    try {
      if (editId) {
        await apiPut(`/api/stock-dividends/${editId}`, body);
      } else {
        await apiPost("/api/stock-dividends", body);
      }
      setDialogOpen(false);
      setPage(1);
      await load(1);
    } catch (e: any) {
      setFormError(e.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/api/stock-dividends/${deleteId}`);
      setDeleteId(null);
      await load(page);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiPost("/api/stock-dividends/sync", {});
      setSyncResult({
        synced: res.synced ?? 0,
        skipped: res.skipped ?? 0,
        errors: res.errors ?? [],
      });
      await load(1);
    } catch (e: any) {
      alert(e.message);
    }
    setSyncing(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {t("features.stocks.dividends.title")}
      </h2>
      <StocksTabNav />

      <div className="flex gap-2 items-center p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
        <Select
          options={stocks.map((s) => ({
            label: `${String(s.market || "TW").toUpperCase() === "US" ? t("features.stocks.common.marketUs") : t("features.stocks.common.marketTaiwan")} · ${s.symbol} ${s.name}`,
            value: s.id,
          }))}
          value={filterStockId}
          onChange={(e) => updateFilter(setFilterStockId, e.target.value)}
          label={t("features.stocks.common.stockLabel")}
          className="w-48"
        />
        <Input
          type="date"
          value={filterDateFrom}
          onChange={(e) => updateFilter(setFilterDateFrom, e.target.value)}
          label={t("features.common.startDate")}
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={(e) => updateFilter(setFilterDateTo, e.target.value)}
          label={t("features.common.endDate")}
        />
        <Button
          variant="outline"
          onClick={() => {
            setPage(1);
            setFilterStockId("");
            setFilterDateFrom("");
            setFilterDateTo("");
          }}
        >
          {t("common.clear")}
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setForm({
                ...EMPTY_FORM,
                date: new Date().toISOString().slice(0, 10),
                stockId: stocks[0]?.id || "",
              });
              setEditId(null);
              setFormError("");
              setDialogOpen(true);
            }}
          >
            <Plus size={16} className="mr-2" />{" "}
            {t("features.stocks.dividends.addDividend")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSyncResult(null);
              setSyncModal(true);
            }}
          >
            <RefreshCw size={16} className="mr-2" />{" "}
            {t("features.stocks.dividends.syncExDividends")}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {t("common.totalRecords", { count: total })}
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {t("common.perPage")}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {t("common.recordsUnit", { count: size })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId
                ? t("features.stocks.dividends.editDividend")
                : t("features.stocks.dividends.newDividend")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select
              label={t("features.stocks.common.stockRequired")}
              options={stocks.map((s) => ({
                label: `${String(s.market || "TW").toUpperCase() === "US" ? t("features.stocks.common.marketUs") : t("features.stocks.common.marketTaiwan")} · ${s.symbol} ${s.name}`,
                value: s.id,
              }))}
              value={form.stockId}
              onChange={(e) =>
                setForm((f) => ({ ...f, stockId: e.target.value }))
              }
            />
            <Input
              label={t("features.common.date")}
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <Input
              label={t("features.stocks.dividends.cashDividendLabel")}
              type="number"
              value={form.cashDividend}
              onChange={(e) =>
                setForm((f) => ({ ...f, cashDividend: e.target.value }))
              }
            />
            <Input
              label={t("features.stocks.dividends.stockDividendLabel")}
              type="number"
              value={form.stockDividendShares}
              onChange={(e) =>
                setForm((f) => ({ ...f, stockDividendShares: e.target.value }))
              }
            />
            <Select
              label={t("features.stocks.dividends.depositAccount")}
              options={[
                {
                  label: t("features.stocks.common.cancelAccounting"),
                  value: "",
                },
                ...accounts.map((a) => ({ label: a.name, value: a.id })),
              ]}
              value={form.accountId}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountId: e.target.value }))
              }
            />
            <Input
              label={t("features.common.note")}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={syncModal} onOpenChange={setSyncModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("features.stocks.dividends.syncExDividends")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {t("features.stocks.dividends.syncDescription")}
            </p>
            {syncResult && (
              <div className="text-sm p-3 rounded bg-green-50 text-green-800">
                <p>
                  {t(
                    syncResult.errors.length > 0
                      ? "features.stocks.dividends.syncResultWithFailed"
                      : "features.stocks.dividends.syncResult",
                    {
                      synced: syncResult.synced,
                      skipped: syncResult.skipped,
                      failed: syncResult.errors.length,
                    },
                  )}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSyncModal(false)}>
                {t("common.close")}
              </Button>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing
                  ? t("features.stocks.dividends.syncing")
                  : t("features.stocks.dividends.syncStart")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-slate-500">{t("common.loading")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("features.common.date")}</TableHead>
              <TableHead>{t("features.common.stock")}</TableHead>
              <TableHead>{t("features.stocks.common.cashDividend")}</TableHead>
              <TableHead>{t("features.stocks.common.stockDividend")}</TableHead>
              <TableHead>{t("features.common.note")}</TableHead>
              <TableHead>{t("features.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {divs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.date}</TableCell>
                <TableCell>
                  {String(d.market || "TW").toUpperCase() === "US"
                    ? t("features.stocks.common.marketUs")
                    : t("features.stocks.common.marketTaiwan")}{" "}
                  · {d.symbol} {d.stock_name}
                </TableCell>
                <TableCell className="text-green-600">
                  {fmtCurrency(
                    d.cash_dividend ?? d.cashDividend,
                    d.currency,
                    locale,
                  )}
                </TableCell>
                <TableCell>
                  {d.stock_dividend_shares ??
                    d.stockDividendShares ??
                    t("features.common.notRecorded")}
                </TableCell>
                <TableCell>
                  {d.note || t("features.common.notRecorded")}
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setForm({
                        stockId: d.stockId || d.stock_id,
                        date: d.date,
                        cashDividend: d.cashDividend ?? d.cash_dividend,
                        stockDividendShares:
                          d.stockDividendShares ?? d.stock_dividend_shares,
                        accountId: d.accountId || d.account_id || "",
                        note: d.note || "",
                      });
                      setEditId(d.id);
                      setFormError("");
                      setDialogOpen(true);
                    }}
                  >
                    <Edit3 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => setDeleteId(d.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-4">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("common.previousPage")}
          </Button>
          <span className="self-center">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.nextPage")}
          </Button>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100">
            <h3 className="text-lg font-semibold mb-4">
              {t("common.confirmDelete")}
            </h3>
            <p className="mb-4">
              {t("features.stocks.dividends.deleteMessage")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
