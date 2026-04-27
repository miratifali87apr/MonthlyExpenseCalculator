import dayjs from 'dayjs';
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export function formatDate(date: string | Date | undefined): string {
  if (!date) return '—';
  return dayjs(date).format('DD/MM/YYYY');
}

export function formatMonth(date: string | Date): string {
  return dayjs(date).format('MMM YYYY');
}

export const CATEGORY_LABELS: Record<string, string> = {
  loan: 'Loan',
  insurance: 'Insurance',
  utility: 'Utility',
  council_rates: 'Council Rates',
  bas: 'BAS',
  school_fees: 'School Fees',
  credit_card: 'Credit Card',
  car: 'Car',
  pm_fees: 'PM Management Fee',
  maintenance: 'Maintenance',
  letting_fee: 'Letting Fee',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<string, string> = {
  loan: 'bg-slate-100 text-slate-600',
  insurance: 'bg-slate-100 text-slate-600',
  utility: 'bg-slate-100 text-slate-600',
  council_rates: 'bg-slate-100 text-slate-600',
  bas: 'bg-slate-100 text-slate-600',
  school_fees: 'bg-slate-100 text-slate-600',
  credit_card: 'bg-slate-100 text-slate-600',
  car: 'bg-slate-100 text-slate-600',
  pm_fees: 'bg-slate-100 text-slate-600',
  maintenance: 'bg-slate-100 text-slate-600',
  letting_fee: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600',
};

export const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-slate-100 text-slate-600',
  overdue: 'bg-rose-50 text-rose-600',
  funded: 'bg-blue-50 text-blue-600',
};

export const INCOME_TYPE_LABELS: Record<string, string> = {
  salary: 'Salary',
  rental: 'Rental',
  reimbursement: 'Reimbursement',
  other: 'Other',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  ad_hoc: 'Ad Hoc',
};

export const CATEGORIES = [
  'loan',
  'insurance',
  'utility',
  'council_rates',
  'bas',
  'school_fees',
  'credit_card',
  'car',
  'pm_fees',
  'maintenance',
  'letting_fee',
  'other',
] as const;

export const FREQUENCIES = [
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'yearly',
  'ad_hoc',
] as const;

export const INCOME_TYPES = [
  'salary',
  'rental',
  'reimbursement',
  'other',
] as const;
