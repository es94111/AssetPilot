// lib/recurringFxRequest.ts — 固定收支表單匯率請求的 stale-response guard。
//
// 零相依純模組：每個表單匯率查詢取得遞增 generation token；表單重開、換幣別、
// 開啟歷史建議或關閉 Modal 時 invalidate。非同步回應只有在 token 仍最新、幣別
// 仍相符，且該幣別未保留歷史建議匯率時才可更新表單。

export interface FxRateRequestToken {
  generation: number;
  currency: string;
}

export interface FxRateRequestContext {
  currentCurrency: string;
  /** 此幣別的 historical rate 由建議表單保留；不接受即時查詢覆寫。 */
  preservedHistoricalCurrency: string | null;
}

export class RecurringFxRequestGuard {
  private generation = 0;

  begin(currency: string): FxRateRequestToken {
    this.generation += 1;
    return {
      generation: this.generation,
      currency: String(currency || '').toUpperCase(),
    };
  }

  invalidate(): void {
    this.generation += 1;
  }

  isLatest(token: FxRateRequestToken): boolean {
    return token.generation === this.generation;
  }

  canApply(token: FxRateRequestToken, context: FxRateRequestContext): boolean {
    const currentCurrency = String(context.currentCurrency || '').toUpperCase();
    const preservedCurrency = context.preservedHistoricalCurrency == null
      ? null
      : String(context.preservedHistoricalCurrency).toUpperCase();
    return this.isLatest(token)
      && token.currency === currentCurrency
      && token.currency !== preservedCurrency;
  }
}
