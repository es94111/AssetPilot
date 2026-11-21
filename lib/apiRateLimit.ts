// lib/apiRateLimit.ts — 公開 API（/api/v1/**）的應用層速率限制（防爆破／防濫用）
//
// 雙層限制（issue：API 完整防護）：
//   1. per-IP（coarse）：阻擋分散式權杖暴力猜測與單一來源洪水，於認證前計數，
//      讓無效權杖的嘗試同樣消耗額度。
//   2. per-token（fine）：辨識單一權杖的濫用（失控的自動化排程等），
//      依讀取／寫入分設較寬／較嚴的額度，額度屬於權杖而非使用者，
//      讓多支整合互不干擾。
//
// 演算法：滑動窗口日誌（sliding window log）。每個 key 只保留窗口內最近
// limit 筆時間戳，記憶體天然有界；key 總量另設上限並以「先清過期、再逐出最舊」
// 防止攻擊者以海量隨機 key（偽造 IP）撐爆記憶體。
//
// 本模組零相依（不碰資料庫／Next.js），可直接單元測試（tests/lib/apiRateLimit.test.ts）。
// 規則預設值可由測試以 _resetApiRateLimitsForTests 覆寫；生產環境以預設值運行。

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  /** 尚可使用的次數（被拒時為 0）。 */
  remaining: number;
  /** 目前窗口的重置時刻（epoch ms）。 */
  resetAt: number;
  /** 被拒時建議的重試等待秒數（>= 1）；放行時為 0。 */
  retryAfterSeconds: number;
}

export interface ApiRateLimitRules {
  tokenRead: RateLimitRule;
  tokenWrite: RateLimitRule;
  ip: RateLimitRule;
}

const WINDOW_MS = 5 * 60 * 1000;

export const DEFAULT_API_RATE_LIMITS: ApiRateLimitRules = {
  tokenRead: { limit: 600, windowMs: WINDOW_MS },
  tokenWrite: { limit: 120, windowMs: WINDOW_MS },
  ip: { limit: 1200, windowMs: WINDOW_MS },
};

let activeRules: ApiRateLimitRules = { ...DEFAULT_API_RATE_LIMITS };

export function getApiRateLimitRules(): ApiRateLimitRules {
  return activeRules;
}

/** 寫入類 scope（含 Webhook 管理）走較嚴的 token 額度；讀取代碼走較寬額度。 */
export function isWriteScope(scope: string): boolean {
  return (
    scope === 'transactions:write' ||
    scope === 'accounts:write' ||
    scope === 'webhooks:manage'
  );
}

/**
 * 滑動窗口日誌限流器。每個執行緒／實例各自記憶（多實例部署時
 * 另需 Cloudflare WAF Rate Limiting 補外層，見 docs/api-security-hardening.md）。
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly getRule: () => RateLimitRule,
    private readonly maxKeys = 5000,
  ) {}

  /**
   * 計入一次請求並回傳裁決。放行時記入窗口；拒絕時不記入
   * （讓限流在窗口滑出後自然恢復，不會因持續敲門而永不解除）。
   */
  check(key: string, now: number = Date.now()): RateLimitDecision {
    const rule = this.getRule();
    const windowStart = now - rule.windowMs;
    const list = (this.hits.get(key) || []).filter((t) => t > windowStart);

    if (list.length >= rule.limit) {
      const oldest = list[0];
      const resetAt = oldest + rule.windowMs;
      this.hits.set(key, list);
      return {
        allowed: false,
        limit: rule.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    list.push(now);
    this.hits.set(key, list);
    this.evictIfNeeded(now, rule.windowMs);
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit - list.length,
      resetAt: list[0] + rule.windowMs,
      retryAfterSeconds: 0,
    };
  }

  /** 不計入的預視（測試／觀測用）。 */
  peek(key: string, now: number = Date.now()): RateLimitDecision {
    const rule = this.getRule();
    const windowStart = now - rule.windowMs;
    const list = (this.hits.get(key) || []).filter((t) => t > windowStart);
    if (list.length >= rule.limit) {
      const resetAt = list[0] + rule.windowMs;
      return {
        allowed: false,
        limit: rule.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit - list.length,
      resetAt: (list[0] ?? now) + rule.windowMs,
      retryAfterSeconds: 0,
    };
  }

  clear(key?: string): void {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }

  get trackedKeyCount(): number {
    return this.hits.size;
  }

  /** 防記憶體耗盡：先清空窗口已過期的 key，仍超限時逐出最舊的 key。 */
  private evictIfNeeded(now: number, windowMs: number): void {
    if (this.hits.size <= this.maxKeys) return;
    for (const [key, list] of this.hits) {
      const newest = list[list.length - 1];
      if (newest === undefined || newest <= now - windowMs) this.hits.delete(key);
    }
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}

const ipLimiter = new SlidingWindowRateLimiter(() => activeRules.ip);
const tokenReadLimiter = new SlidingWindowRateLimiter(() => activeRules.tokenRead);
const tokenWriteLimiter = new SlidingWindowRateLimiter(() => activeRules.tokenWrite);

/**
 * 對指定 scope 選用讀取或寫入額度的 per-token 裁決。
 * 權杖已通過認證才會呼叫（無效權杖走 per-IP 層）。
 */
export function checkTokenRateLimit(
  tokenId: string,
  scope: string,
  now: number = Date.now(),
): RateLimitDecision {
  const limiter = isWriteScope(scope) ? tokenWriteLimiter : tokenReadLimiter;
  return limiter.check(`token:${tokenId}`, now);
}

/** per-IP 裁決（認證前呼叫，涵蓋無效權杖的暴力猜測）。 */
export function checkIpRateLimit(ip: string, now: number = Date.now()): RateLimitDecision {
  return ipLimiter.check(`ip:${ip || 'unknown'}`, now);
}

/** 速率限制回應標頭（RFC 9239 RateLimit-* 風格 + Retry-After）。 */
export function apiRateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(decision.remaining),
  };
  if (!decision.allowed) {
    headers['Retry-After'] = String(decision.retryAfterSeconds);
  }
  return headers;
}

/**
 * 測試用：重設所有窗口，並以覆寫值套用規則（不傳參數時還原預設值）。
 * 生產程式碼不得呼叫。
 */
export function _resetApiRateLimitsForTests(overrides?: Partial<ApiRateLimitRules>): void {
  activeRules = {
    tokenRead: { ...DEFAULT_API_RATE_LIMITS.tokenRead, ...(overrides?.tokenRead || {}) },
    tokenWrite: { ...DEFAULT_API_RATE_LIMITS.tokenWrite, ...(overrides?.tokenWrite || {}) },
    ip: { ...DEFAULT_API_RATE_LIMITS.ip, ...(overrides?.ip || {}) },
  };
  ipLimiter.clear();
  tokenReadLimiter.clear();
  tokenWriteLimiter.clear();
}
