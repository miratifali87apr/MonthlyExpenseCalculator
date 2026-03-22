import { supabase } from './supabase';
import type {
  DashboardSummary, ExpenseItem, IncomeItem,
  Property, PropertySummary, RecurringTemplate,
} from '../types';

const API_URL = 'https://finance-tracker-backend-nj9l.onrender.com';

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const dashboardApi = {
  getSummary: () => request<DashboardSummary>('/api/dashboard/summary'),
};

export const expensesApi = {
  list: (params?: { month?: number; year?: number }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', String(params.month));
    if (params?.year) qs.set('year', String(params.year));
    const q = qs.toString();
    return request<ExpenseItem[]>(`/api/expenses${q ? `?${q}` : ''}`);
  },
  pay: (id: number) => request<ExpenseItem>(`/api/expenses/${id}/pay`, { method: 'PATCH' }),
  unpay: (id: number) => request<ExpenseItem>(`/api/expenses/${id}/unpay`, { method: 'PATCH' }),
  delete: (id: number) => request<{ message: string }>(`/api/expenses/${id}`, { method: 'DELETE' }),
  generateUpcoming: () => request<{ generated: number }>('/api/expenses/generate-upcoming', { method: 'POST' }),
};

export const incomeApi = {
  list: (params?: { month?: number; year?: number }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', String(params.month));
    if (params?.year) qs.set('year', String(params.year));
    const q = qs.toString();
    return request<IncomeItem[]>(`/api/income${q ? `?${q}` : ''}`);
  },
  receive: (id: number) => request<IncomeItem>(`/api/income/${id}/receive`, { method: 'PATCH' }),
  delete: (id: number) => request<{ message: string }>(`/api/income/${id}`, { method: 'DELETE' }),
};

export const propertiesApi = {
  list: () => request<Property[]>('/api/properties'),
  getSummary: (id: number) => request<PropertySummary>(`/api/properties/${id}/summary`),
};

export const recurringApi = {
  list: () => request<RecurringTemplate[]>('/api/recurring'),
};
