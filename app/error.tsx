'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[app] route rendering failed', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
          AssetPilot
        </p>
        <h1 className="mt-4 text-3xl font-semibold">服務暫時無法使用</h1>
        <p className="mt-4 leading-7 text-slate-300">
          資料庫連線可能暫時中斷，系統正在自動重試。連線恢復後，請重新載入此頁面。
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 rounded-2xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
        >
          重新載入
        </button>
      </div>
    </main>
  );
}
