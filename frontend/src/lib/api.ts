import type {
  User,
  DashboardSummary,
  ExpenseItem,
  IncomeItem,
  Property,
  PropertySummary,
  RecurringTemplate,
} from '@/types';

import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const authApi = {
  me: () => request<User>('/api/auth/me'),
};

// Dashboard
export const dashboardApi = {
  getSummary: () => request<DashboardSummary>('/api/dashboard/summary'),
};

// Expenses
export const expensesApi = {
  list: (params?: {
    month?: number;
    year?: number;
    property_id?: number;
    status?: string;
    category?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', String(params.month));
    if (params?.year) qs.set('year', String(params.year));
    if (params?.property_id) qs.set('property_id', String(params.property_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.category) qs.set('category', params.category);
    const queryString = qs.toString();
    return request<ExpenseItem[]>(`/api/expenses${queryString ? `?${queryString}` : ''}`);
  },
  create: (data: Partial<ExpenseItem>) =>
    request<ExpenseItem>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<ExpenseItem>) =>
    request<ExpenseItem>(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/expenses/${id}`, { method: 'DELETE' }),
  pay: (id: number) =>
    request<ExpenseItem>(`/api/expenses/${id}/pay`, { method: 'PATCH' }),
  unpay: (id: number) =>
    request<ExpenseItem>(`/api/expenses/${id}/unpay`, { method: 'PATCH' }),
  fund: (id: number) =>
    request<ExpenseItem>(`/api/expenses/${id}/fund`, { method: 'PATCH' }),
  partialPay: (id: number, amount: number) =>
    request<ExpenseItem>(`/api/expenses/${id}/partial-pay`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    }),
  generateUpcoming: () =>
    request<{ generated: number }>('/api/expenses/generate-upcoming', {
      method: 'POST',
    }),
};

// Income
export const incomeApi = {
  list: (params?: {
    month?: number;
    year?: number;
    type?: string;
    property_id?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', String(params.month));
    if (params?.year) qs.set('year', String(params.year));
    if (params?.type) qs.set('type', params.type);
    if (params?.property_id) qs.set('property_id', String(params.property_id));
    const queryString = qs.toString();
    return request<IncomeItem[]>(`/api/income${queryString ? `?${queryString}` : ''}`);
  },
  create: (data: Partial<IncomeItem>) =>
    request<IncomeItem>('/api/income', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<IncomeItem>) =>
    request<IncomeItem>(`/api/income/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/income/${id}`, { method: 'DELETE' }),
  receive: (id: number) =>
    request<IncomeItem>(`/api/income/${id}/receive`, { method: 'PATCH' }),
};

// Properties
export const propertiesApi = {
  list: () => request<Property[]>('/api/properties'),
  create: (data: Partial<Property>) =>
    request<Property>('/api/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Property>) =>
    request<Property>(`/api/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<void>(`/api/properties/${id}`, { method: 'DELETE' }),
  getSummary: (id: number) =>
    request<PropertySummary>(`/api/properties/${id}/summary`),
};

// Recurring
export const recurringApi = {
  list: () => request<RecurringTemplate[]>('/api/recurring'),
  create: (data: Partial<RecurringTemplate>) =>
    request<RecurringTemplate>('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<RecurringTemplate>) =>
    request<RecurringTemplate>(`/api/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/recurring/${id}`, { method: 'DELETE' }),
  generate: (month?: number, year?: number) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', String(month));
    if (year) qs.set('year', String(year));
    const queryString = qs.toString();
    return request<{ generated: number }>(
      `/api/recurring/generate${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    );
  },
};
