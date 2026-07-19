export const DASHBOARD_MODULE_IDS = [
  'assets',
  'attention',
  'whyChanged',
  'cashOutlook',
  'savingsScenario',
  'spending',
  'portfolioHealth',
  'incomeRecent',
] as const;

export type DashboardModuleId = (typeof DASHBOARD_MODULE_IDS)[number];

export interface DashboardLayoutPreference {
  version: 2;
  moduleOrder: DashboardModuleId[];
  hiddenModules: DashboardModuleId[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutPreference = {
  version: 2,
  moduleOrder: [...DASHBOARD_MODULE_IDS],
  hiddenModules: [],
};

const moduleIdSet = new Set<string>(DASHBOARD_MODULE_IDS);

export function normalizeDashboardLayout(value: unknown): DashboardLayoutPreference {
  const candidate = value && typeof value === 'object'
    ? value as { moduleOrder?: unknown; hiddenModules?: unknown }
    : {};
  const requestedOrder = Array.isArray(candidate.moduleOrder)
    ? candidate.moduleOrder.filter((id): id is DashboardModuleId => typeof id === 'string' && moduleIdSet.has(id))
    : [];
  const uniqueOrder = [...new Set(requestedOrder)];
  const moduleOrder = [
    ...uniqueOrder,
    ...DASHBOARD_MODULE_IDS.filter(id => !uniqueOrder.includes(id)),
  ];
  const requestedHidden = Array.isArray(candidate.hiddenModules)
    ? candidate.hiddenModules.filter((id): id is DashboardModuleId => typeof id === 'string' && moduleIdSet.has(id))
    : [];

  return {
    version: 2,
    moduleOrder,
    hiddenModules: [...new Set(requestedHidden)],
  };
}

export function parseDashboardLayout(raw: unknown): DashboardLayoutPreference {
  if (typeof raw !== 'string' || !raw.trim()) return normalizeDashboardLayout(raw);
  try {
    return normalizeDashboardLayout(JSON.parse(raw));
  } catch {
    return normalizeDashboardLayout(null);
  }
}
