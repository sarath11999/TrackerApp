/** Money is stored as integer cents everywhere; these helpers convert at the edges. */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Gas / Transportation',
  'Shopping',
  'Entertainment',
  'Bills',
  'Education',
  'Health',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(v: unknown): v is ExpenseCategory {
  return typeof v === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

export const MAX_EXPENSE_CENTS = 100_000_000; // $1,000,000.00

/**
 * Parse a user-entered dollar string ("12", "12.5", "$1,234.56") into integer
 * cents without floating-point arithmetic. Returns null when invalid.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned) ?? /^\.(\d{1,2})$/.exec(cleaned);
  if (!m) return null;
  let dollars: string;
  let frac: string;
  if (cleaned.startsWith('.')) {
    dollars = '0';
    frac = m[1];
  } else {
    dollars = m[1];
    frac = m[2] ?? '';
  }
  const cents = Number(dollars) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  return Math.abs(cents) >= 100_000 ? usdWhole.format(Math.round(cents / 100)) : usd.format(cents / 100);
}

/** Convert cents to an editable string, e.g. 1250 → "12.50". */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
