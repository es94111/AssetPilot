"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/clientApi";
import { Button } from "@/components/ui/button";

const PURPOSES = [
  { id: "jwt", label: "登入／JWT" },
  { id: "api-token", label: "API Token／Webhook" },
  { id: "photo", label: "照片資料金鑰" },
] as const;

type Purpose = (typeof PURPOSES)[number]["id"];
type ScheduleForm = Record<Purpose, { enabled: boolean; intervalDays: number }>;

const EMPTY_FORM: ScheduleForm = {
  jwt: { enabled: false, intervalDays: 90 },
  "api-token": { enabled: false, intervalDays: 365 },
  photo: { enabled: false, intervalDays: 365 },
};

function formatDate(value: number | string) {
  const timestamp = Number(value);
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-TW");
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "操作失敗，請稍後再試。";
}

export default function KeyringRotationPanel({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<any>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [expectedInstanceCount, setExpectedInstanceCount] = useState(1);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async (syncForm = false) => {
    try {
      const result = await apiGet("/api/admin/keyring-rotation");
      setStatus(result);
      if (syncForm) {
        const nextForm = { ...EMPTY_FORM } as ScheduleForm;
        for (const schedule of result.schedules || []) {
          if (schedule.purpose in nextForm) {
            nextForm[schedule.purpose as Purpose] = {
              enabled: !!schedule.enabled,
              intervalDays: Number(schedule.intervalDays) || 365,
            };
          }
        }
        setForm(nextForm);
        setExpectedInstanceCount(Number(result.expectedInstanceCount) || 1);
        setBackupConfirmed(false);
      }
      setError("");
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus(true);
    const timer = window.setInterval(() => void loadStatus(false), 30_000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  const schedulesByPurpose = useMemo(() => {
    const values: Partial<Record<Purpose, any>> = {};
    for (const schedule of status?.schedules || []) values[schedule.purpose as Purpose] = schedule;
    return values;
  }, [status]);

  const keysByPurpose = useMemo(() => {
    const values: Partial<Record<Purpose, any[]>> = {};
    for (const key of status?.activeKeys || []) {
      values[key.purpose as Purpose] ||= [];
      values[key.purpose as Purpose]!.push(key);
    }
    return values;
  }, [status]);

  const updateSchedule = (purpose: Purpose, field: "enabled" | "intervalDays", value: boolean | number) => {
    setForm(current => ({
      ...current,
      [purpose]: { ...current[purpose], [field]: value },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiPut("/api/admin/keyring-rotation", {
        expectedInstanceCount,
        backupConfirmed,
        schedules: PURPOSES.map(({ id }) => ({
          purpose: id,
          enabled: form[id].enabled,
          intervalDays: Number(form[id].intervalDays),
        })),
      });
      setMessage("自動輪換設定已儲存。");
      await loadStatus(true);
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async (purpose: Purpose) => {
    const schedule = schedulesByPurpose[purpose];
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiPost("/api/admin/keyring-rotation", {
        purpose,
        action: schedule?.paused ? "resume" : "pause",
      });
      setMessage(schedule?.paused ? "輪換已恢復。" : "輪換已暫停；目前批次完成後停止。未開始的新輪換也會等待恢復。 ");
      await loadStatus(false);
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !status) {
    return <section className="rounded-xl border bg-white p-5 shadow-sm"><p>正在載入金鑰輪換狀態…</p></section>;
  }

  const activeInstanceCount = Number(status?.freshInstanceCount) || 0;
  const pendingReadiness = (status?.readiness || []) as any[];

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">金鑰自動輪換</h2>
          <p className="mt-1 text-sm text-gray-600">所有近期執行副本完成待啟用金鑰自我測試後，系統才會切換金鑰並批次重加密。</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadStatus(false)}>重新整理</Button>
      </div>

      {!status?.keyringEnabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          金鑰環目前未啟用，排程不會執行。{status?.keyringErrorCode ? ` 狀態：${status.keyringErrorCode}` : " 請先完成 KEYRING_ROOT_KEK 與 keyring 啟用設定。"}
        </div>
      )}
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <label className="block text-sm font-medium" htmlFor="rotation-expected-instances">預期執行副本數</label>
          <p className="mt-1 text-xs text-gray-600">請填入所有會處理線上流量的副本數；近期心跳或 readiness 未達標時會 fail closed。</p>
          <input
            id="rotation-expected-instances"
            type="number"
            min={1}
            max={100}
            value={expectedInstanceCount}
            disabled={!canWrite || saving}
            onChange={event => setExpectedInstanceCount(Number(event.target.value))}
            className="mt-2 w-32 rounded-md border px-3 py-2 text-sm disabled:bg-gray-100"
          />
          <p className="mt-2 text-sm">近期心跳：{activeInstanceCount} / {status?.expectedInstanceCount || 1}</p>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            {(status?.instances || []).length === 0 && <p>尚未收到副本心跳。</p>}
            {(status?.instances || []).map((instance: any) => (
              <p key={instance.id}>
                副本 {instance.id} · {instance.online ? "在線" : "心跳逾時"} · {instance.keyringEnabled ? "keyring ready" : "keyring 未就緒"} · {formatDate(instance.lastSeenAt)}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium">備份確認</h3>
          {status?.backupConfirmedAt ? (
            <p className="mt-2 text-sm text-green-700">已由管理員確認備份已設定並測試，時間：{formatDate(status.backupConfirmedAt)}</p>
          ) : (
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={backupConfirmed}
                disabled={!canWrite || saving}
                onChange={event => setBackupConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>我確認資料庫備份已設定並測試成功。這是管理員確認，不代表系統會即時驗證外部備份。</span>
            </label>
          )}
          <p className="mt-3 text-xs text-gray-600">舊金鑰會保留，不會自動銷毀；確認備份、匯出與舊資料均不再依賴舊金鑰後，仍須由管理員另行處理。</p>
        </div>
      </div>

      {pendingReadiness.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {pendingReadiness.map((item: any) => (
            <p key={item.rotationId}>
              {PURPOSES.find(purpose => purpose.id === item.purpose)?.label || item.purpose} readiness：{item.readyCount}/{item.expectedCount} 就緒；在線 {item.observedCount}，待回報 {item.pendingCount}，失敗 {item.failedCount}。未全部通過前不會啟用新金鑰。
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-medium">用途排程</h3>
        {PURPOSES.map(({ id, label }) => {
          const schedule = schedulesByPurpose[id];
          const keys = keysByPurpose[id] || [];
          const currentKey = keys.find(key => key.status === "active");
          const rotation = (status?.rotations || []).find((item: any) => item.purpose === id && ["prepared", "running", "paused"].includes(item.status));
          return (
            <div key={id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(180px,1.2fr)_minmax(130px,0.7fr)_minmax(180px,1fr)_auto] md:items-center">
              <div>
                <p className="font-medium">{label}</p>
                <p className="mt-1 text-xs text-gray-500">Active key：{currentKey?.kid || "尚未建立"}</p>
                {rotation && <p className="mt-1 text-xs text-blue-700">目前工作：{rotation.status} · 已重加密 {rotation.reencrypted}</p>}
                {schedule?.lastErrorCode && <p className="mt-1 text-xs text-red-700">需注意：{schedule.lastErrorCode} · {formatDate(schedule.lastErrorAt)}</p>}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form[id].enabled}
                  disabled={!canWrite || saving}
                  onChange={event => updateSchedule(id, "enabled", event.target.checked)}
                />
                啟用排程
              </label>
              <label className="text-sm">
                輪換週期（天）
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={form[id].intervalDays}
                  disabled={!canWrite || saving}
                  onChange={event => updateSchedule(id, "intervalDays", Number(event.target.value))}
                  className="ml-2 w-24 rounded-md border px-2 py-1 disabled:bg-gray-100"
                />
                <span className="ml-1 text-xs text-gray-500">1–3650</span>
                {schedule?.enabled && <span className="mt-1 block text-xs text-gray-500">下次輪換：{formatDate(schedule.nextRunAt)}</span>}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs ${schedule?.paused ? "text-amber-700" : schedule?.enabled ? "text-green-700" : "text-gray-500"}`}>
                  {schedule?.paused ? "已暫停" : schedule?.enabled ? "排程啟用中" : "未啟用"}
                </span>
                {canWrite && (schedule?.enabled || rotation) && (
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void togglePause(id)}>
                    {schedule?.paused ? "恢復" : "暫停"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canWrite && (
        <div className="flex justify-end">
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "儲存中…" : "儲存輪換設定"}
          </Button>
        </div>
      )}
    </section>
  );
}
