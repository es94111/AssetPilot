export function visibleThroughMonthIndexForToday(today: string): number {
  const month = Number(String(today || '').slice(5, 7));
  return month >= 1 && month <= 12 ? month - 1 : 11;
}

export function blankMonthsAfter(values: number[], visibleThroughMonthIndex: number): number[] {
  return values.map((value, index) => (index > visibleThroughMonthIndex ? 0 : value));
}

export function isFutureMonthIndex(index: number, visibleThroughMonthIndex: number): boolean {
  return index > visibleThroughMonthIndex;
}
