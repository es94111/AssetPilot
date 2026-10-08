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
import {
  allowsFractionalShares,
  isValidStockShareQuantity,
} from "@/lib/stockMarket";
import { isDayTradeTaxEffective } from "@/lib/twStockTaxRules";
import { Plus, Trash2, Edit3 } from "lucide-react";

function fmtCurrency(n: number | string, currency: string, locale: string) {
  const code = String(currency || "TWD").toUpperCase();
  const digits = code === "TWD" ? 0 : 2;
  return `${code === "TWD" ? "NT$" : "$"} ${(Number(n) || 0).toLocaleString(localeTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const EMPTY_FORM = {
  stockId: "",
  type: "buy",
  date: "",
  shares: "",
  price: "",
  fee: "",
  tax: "",
  accountId: "",
  dayTrade: false,
  note: "",
};
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type QueryParams = { get(name: string): string | null };

function isDayTradeEligibleStock(stock: any, date: string, account: any): boolean {
  return (
    String(stock?.market || "TW").toUpperCase() !== "US" &&
    (stock?.stockType || stock?.stock_type || "stock") === "stock" &&
    (account?.category === "securities" || account?.account_type === "證券帳戶") &&
    isDayTradeTaxEffective(date)
  );
}

function readPageParam(searchParams: QueryParams) {
  return Math.max(1, Number(searchParams.get("page")) || 1);
}

function readPageSizeParam(searchParams: QueryParams) {
  const value = Number(searchParams.get("pageSize")) || 20;
  return PAGE_SIZE_OPTIONS.includes(value) ? value : 20;
}

export default function StockTxClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [txs, setTxs] = useState<any[]>([]);
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
        const result = await apiGet(`/api/stock-transactions?${params}`);
        setTxs(result.data || result.transactions || []);
        setTotal(result.total || 0);
      } catch (error) {
        if (process.env.NODE_ENV === "development")
          console.warn("[stock-transactions] load failed", error);
      }
      setLoading(false);
    },
    [page, pageSize, filterStockId, filterDateFrom, filterDateTo],
  );

  const loadMeta = useCallback(async () => {
    const [stockResp, accountResp] = await Promise.all([
      apiGet("/api/stocks").catch(() => []),
      apiGet("/api/accounts").catch(() => []),
    ]);
    setStocks(Array.isArray(stockResp) ? stockResp : stockResp?.stocks || []);
    setAccounts(Array.isArray(accountResp) ? accountResp : accountResp?.accounts || []);
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
      setFormError(t("features.stocks.transactions.messages.stockRequired"));
      return;
    }
    const selectedStock = stocks.find((s) => s.id === form.stockId);
    const shareNum = Number(form.shares);
    if (!isValidStockShareQuantity(shareNum, selectedStock?.market)) {
      setFormError(t("features.stocks.transactions.messages.sharesRequired"));
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setFormError(t("features.stocks.transactions.messages.priceRequired"));
      return;
    }
    setSaving(true);
    setFormError("");
    const body: Record<string, unknown> = {
      stockId: form.stockId,
      type: form.type,
      date: form.date,
      shares: shareNum,
      price: Number(form.price),
      accountId: form.accountId || null,
      note: form.note,
      dayTrade:
        form.type === "sell" && dayTradeEligible ? !!form.dayTrade : false,
    };
    const feeText = String(form.fee ?? "").trim();
    const taxText = String(form.tax ?? "").trim();
    if (feeText !== "") body.fee = Number(feeText);
    if (form.type === "sell" && taxText !== "") body.tax = Number(taxText);
    try {
      if (editId) {
        await apiPut(`/api/stock-transactions/${editId}`, body);
      } else {
        await apiPost("/api/stock-transactions", body);
      }
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
      await apiDelete(`/api/stock-transactions/${deleteId}`);
      setDeleteId(null);
      await load(page);
    } catch (e: any) {
      alert(e.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedStock = stocks.find((s) => s.id === form.stockId);
  const selectedAccount = accounts.find((account) => account.id === form.accountId);
  const fractionalShares = allowsFractionalShares(selectedStock?.market);
  // 現股當沖僅適用有效期間內的台股一般股票與證券帳戶。
  const dayTradeEligible = isDayTradeEligibleStock(selectedStock, form.date, selectedAccount);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {t("features.stocks.transactions.title")}
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
          {t("features.stocks.transactions.addTransaction")}
        </Button>
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
                ? t("features.stocks.transactions.editTransaction")
                : t("features.stocks.transactions.newTransaction")}
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
              onChange={(e) => {
                const nextStock = stocks.find((stock) => stock.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  stockId: e.target.value,
                  dayTrade:
                    f.type === "sell" &&
                    isDayTradeEligibleStock(nextStock, f.date, accounts.find((account) => account.id === f.accountId))
                      ? f.dayTrade
                      : false,
                }));
              }}
            />
            <Select
              label={t("features.stocks.transactions.typeLabel")}
              options={[
                { label: t("features.stocks.common.buy"), value: "buy" },
                { label: t("features.stocks.common.sell"), value: "sell" },
              ]}
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value,
                  dayTrade:
                    e.target.value === "sell" &&
                    isDayTradeEligibleStock(selectedStock, f.date, accounts.find((account) => account.id === f.accountId))
                      ? f.dayTrade
                      : false,
                }))
              }
            />
            <Select
              label={t("features.stocks.transactions.accountLabel")}
              options={[
                { label: t("features.stocks.transactions.accountUnspecified"), value: "" },
                ...accounts.map((account) => ({ label: account.name, value: account.id })),
              ]}
              value={form.accountId}
              onChange={(e) => {
                const nextAccount = accounts.find((account) => account.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  accountId: e.target.value,
                  dayTrade:
                    f.type === "sell" &&
                    isDayTradeEligibleStock(selectedStock, f.date, nextAccount)
                      ? f.dayTrade
                      : false,
                }));
              }}
            />
            <Input
              label={t("features.stocks.transactions.dateLabel")}
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  date: e.target.value,
                  dayTrade:
                    f.type === "sell" &&
                    isDayTradeEligibleStock(selectedStock, e.target.value, accounts.find((account) => account.id === f.accountId))
                      ? f.dayTrade
                      : false,
                }))
              }
            />
            <Input
              label={t("features.stocks.transactions.sharesLabel")}
              type="number"
              min="0"
              step={fractionalShares ? "any" : "1"}
              value={form.shares}
              onChange={(e) =>
                setForm((f) => ({ ...f, shares: e.target.value }))
              }
            />
            <Input
              label={t("features.stocks.transactions.priceLabel")}
              type="number"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
            />
            <Input
              label={t("features.stocks.transactions.feeLabel")}
              type="number"
              placeholder={t("features.stocks.common.autoCalculate")}
              value={form.fee}
              onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
            />
            {form.type === "sell" && (
              <>
                <Input
                  label={t("features.stocks.transactions.taxLabel")}
                  type="number"
                  placeholder={t("features.stocks.common.autoCalculate")}
                  value={form.tax}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tax: e.target.value }))
                  }
                />
                {/* 現股當沖（證券交易稅條例第 2 條之 2）：僅台股一般股票適用，稅率減半為 0.15%。 */}
                {dayTradeEligible && (
                  <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!form.dayTrade}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dayTrade: e.target.checked }))
                      }
                    />
                    <span>
                      {t("features.stocks.transactions.dayTradeLabel")}
                      <span className="block text-xs text-slate-500">
                        {t("features.stocks.transactions.dayTradeHint")}
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}
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

      {loading ? (
        <div className="space-y-2" aria-busy="true"><div className="ui-skeleton h-12 w-full" /><div className="ui-skeleton h-12 w-full" /><div className="ui-skeleton h-12 w-full" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("features.common.date")}</TableHead>
              <TableHead>{t("features.common.type")}</TableHead>
              <TableHead>{t("features.common.stock")}</TableHead>
              <TableHead>{t("features.stocks.common.shares")}</TableHead>
              <TableHead>{t("features.stocks.common.price")}</TableHead>
              <TableHead>{t("features.stocks.common.total")}</TableHead>
              <TableHead>{t("features.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txs.map((tx) => {
              const isBuy = tx.type === "buy";
              const total = isBuy
                ? Number(tx.shares) * Number(tx.price) + Number(tx.fee || 0)
                : Number(tx.shares) * Number(tx.price) -
                  Number(tx.fee || 0) -
                  Number(tx.tax || 0);
              return (
                <TableRow key={tx.id}>
                  <TableCell>{tx.date}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${isBuy ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    >
                      {isBuy
                        ? t("features.stocks.common.buy")
                        : t("features.stocks.common.sell")}
                    </span>
                    {Number(tx.day_trade) === 1 && (
                      <span className="ml-1 px-2 py-1 rounded text-xs bg-amber-100 text-amber-800">
                        {t("features.stocks.transactions.dayTradeBadge")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {String(tx.market || "TW").toUpperCase() === "US"
                      ? t("features.stocks.common.marketUs")
                      : t("features.stocks.common.marketTaiwan")}{" "}
                    · {tx.symbol} {tx.stock_name}
                  </TableCell>
                  <TableCell>
                    {Number(tx.shares).toLocaleString(localeTag(locale))}
                  </TableCell>
                  <TableCell>
                    {fmtCurrency(tx.price, tx.currency, locale)}
                  </TableCell>
                  <TableCell
                    className={isBuy ? "text-red-600" : "text-green-600"}
                  >
                    {fmtCurrency(total, tx.currency, locale)}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setForm({
                          stockId: tx.stockId || tx.stock_id,
                          type: tx.type,
                          date: tx.date,
                          shares: String(tx.shares ?? ""),
                          price: String(tx.price ?? ""),
                          fee: tx.fee != null ? String(tx.fee) : "",
                          accountId: tx.account_id || "",
                          // Leave calculated tax empty so a day-trade toggle recalculates it;
                          // only a user-entered manual tax is sent back as an override.
                          tax:
                            Number(tx.tax_auto_calculated) === 1
                              ? ""
                              : tx.tax != null
                                ? String(tx.tax)
                                : "",
                          dayTrade: Number(tx.day_trade) === 1,
                          note: tx.note || "",
                        });
                        setEditId(tx.id);
                        setFormError("");
                        setDialogOpen(true);
                      }}
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                      onClick={() => setDeleteId(tx.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
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
              {t("features.stocks.transactions.deleteMessage")}
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
