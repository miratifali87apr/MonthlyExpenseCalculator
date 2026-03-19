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
  loan: 'bg-blue-100 text-blue-800',
  insurance: 'bg-purple-100 text-purple-800',
  utility: 'bg-yellow-100 text-yellow-800',
  council_rates: 'bg-orange-100 text-orange-800',
  bas: 'bg-red-100 text-red-800',
  school_fees: 'bg-pink-100 text-pink-800',
  credit_card: 'bg-indigo-100 text-indigo-800',
  car: 'bg-cyan-100 text-cyan-800',
  pm_fees: 'bg-teal-100 text-teal-800',
  maintenance: 'bg-amber-100 text-amber-800',
  letting_fee: 'bg-violet-100 text-violet-800',
  other: 'bg-gray-100 text-gray-800',
};

export const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
};

export const INCOME_TYPE_LABELS: Record<string, string> = {
  salary: 'Salary',
  rental: 'Rental',
  reimbursement: 'Reimbursement',
  other: 'Other',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
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
  'monthly',
  'quarterly',
  'weekly',
  'fortnightly',
  'ad_hoc',
] as const;

export const INCOME_TYPES = [
  'salary',
  'rental',
  'reimbursement',
  'other',
] as const;
