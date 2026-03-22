export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const COLORS = {
  primary: '#6d28d9',     // violet-700
  primaryLight: '#7c3aed', // violet-600
  accent: '#4f46e5',      // indigo-600
  success: '#059669',     // emerald-600
  warning: '#d97706',     // amber-600
  danger: '#dc2626',      // red-600
  bg: '#f8fafc',          // slate-50
  card: '#ffffff',
  border: '#e2e8f0',      // slate-200
  textPrimary: '#0f172a', // slate-900
  textSecondary: '#64748b', // slate-500
  textMuted: '#94a3b8',   // slate-400
  dark: '#0f172a',        // slate-900
  darkCard: '#1e293b',    // slate-800
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  paid:     { bg: '#ecfdf5', text: '#065f46', border: '#6ee7b7' },
  pending:  { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
  overdue:  { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  funded:   { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
  partial:  { bg: '#fdf4ff', text: '#6b21a8', border: '#d8b4fe' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  loan: 'Loan', insurance: 'Insurance', utility: 'Utility',
  council_rates: 'Council Rates', bas: 'BAS', school_fees: 'School Fees',
  credit_card: 'Credit Card', car: 'Car', pm_fees: 'PM Fees',
  maintenance: 'Maintenance', letting_fee: 'Letting Fee', other: 'Other',
};
