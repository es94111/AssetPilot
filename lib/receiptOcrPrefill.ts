import { TRANSACTION_NOTE_MAX_LENGTH } from './transactionEditRules';

export interface ReceiptOcrPrefillValues {
  amount: string;
  date: string;
  note: string;
}

export interface ReceiptOcrPrefillDraft {
  amount: number | null;
  date: string | null;
  merchant: string | null;
}

export interface ReceiptOcrPrefillEligibility {
  amount: boolean;
  date: boolean;
  note: boolean;
}

/** Fill only untouched draft fields; date can be eligible while showing its default date. */
export function applyReceiptOcrPrefill<T extends ReceiptOcrPrefillValues>(
  current: T,
  draft: ReceiptOcrPrefillDraft,
  eligible: ReceiptOcrPrefillEligibility,
): T {
  return {
    ...current,
    ...(eligible.amount && !current.amount.trim() && draft.amount !== null
      ? { amount: String(draft.amount) }
      : {}),
    ...(eligible.date && draft.date ? { date: draft.date } : {}),
    ...(eligible.note && !current.note.trim() && draft.merchant
      ? { note: draft.merchant.slice(0, TRANSACTION_NOTE_MAX_LENGTH) }
      : {}),
  } as T;
}

/** Invalidates OCR responses when another scan starts or the form closes/changes. */
export function createReceiptOcrRequestGate() {
  let generation = 0;
  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    invalidate(): void {
      generation += 1;
    },
    isCurrent(requestId: number): boolean {
      return generation === requestId;
    },
  };
}
