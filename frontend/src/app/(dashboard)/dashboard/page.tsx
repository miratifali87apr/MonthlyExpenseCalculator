'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { dashboardApi, expensesApi, recurringApi } from '@/lib/api';
import { formatCurrency, formatDate, formatMonth } from '@/lib/utils';
import type { ExpenseItem, IncomeItem } from '@/types';
import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<number | null>(null);
  const [fundingId, setFundingId] = useState<number | null>(null);
  const hasGenerated = useRef(false);

  // Auto-generate recurring bills for current + next month on every dashboard visit
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;

    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1;
    const nextYear = thisMonth === 12 ? thisYear + 1 : thisYear;

    Promise.all([
      recurringApi.generate(thisMonth, thisYear),
      recurringApi.generate(nextMonth, nextYear),
    ]).then(([curr, next]) => {
      const total = (curr.generated ?? 0) + (next.generated ?? 0);
      if (total > 0) {
        toast.success(`${total} bill${total > 1 ? 's' : ''} auto-generated for ${total > 0 ? 'this/next' : 'this'} month`);
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
      }
    }).catch(() => {/* silent fail */});
  }, [queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getSummary(),
  });

  const handleMarkPaid = async (id: number) => {
    setPayingId(id);
    try {
      await expensesApi.pay(id);
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Marked as paid');
    } catch {
      toast.error('Failed to mark as paid');
    } finally { setPayingId(null); }
  };

  const handleFund = async (id: number) => {
    setFundingId(id);
    try {
      await expensesApi.fund(id);
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Marked as funded');
    } catch {
      toast.error('Failed to fund');
    } finally { setFundingId(null); }
  };

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <div className="text-red-600 p-4">Failed to load dashboard.</div>;
  if (!data) return null;

  const isEmpty =
    data.total_monthly_income === 0 &&
    data.total_monthly_expenses === 0 &&
    data.upcoming_7_days.length === 0 &&
    data.overdue_items.length === 0;

  const netPositive = data.net_cashflow >= 0;
  const totalUnfunded = data.next_unfunded.reduce((s, i) => s + i.amount, 0);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Finance Tracker</h2>
        <p className="text-slate-500 max-w-sm mb-8">
          Your dashboard is empty. Start by adding your income, expenses, or a property to see your cashflow.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/income" className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm">
            + Add Income
          </Link>
          <Link href="/expenses" className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-sm">
            + Add Expense
          </Link>
          <Link href="/properties" className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm">
            + Add Property
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Income</p>
          <p className="text-lg md:text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.total_monthly_income)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Expenses</p>
          <p className="text-lg md:text-2xl font-bold text-red-600 mt-1">{formatCurrency(data.total_monthly_expenses)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Net</p>
          <p className={`text-lg md:text-2xl font-bold mt-1 ${netPositive ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.net_cashflow)}
          </p>
        </div>
      </div>

      {/* ── NEXT 7 UNFUNDED ── highlight card */}
      {data.next_unfunded.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-100 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span className="font-bold text-amber-900 text-sm">Needs Funding — Next {data.next_unfunded.length}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-amber-700">Total</span>
              <span className="ml-2 font-bold text-amber-900">{formatCurrency(totalUnfunded)}</span>
            </div>
          </div>
          <div className="divide-y divide-amber-200">
            {data.next_unfunded.map((item: ExpenseItem) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Due {formatDate(item.due_date)}{item.property ? ` · ${item.property.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                  <Button variant="info" size="sm" loading={fundingId === item.id} onClick={() => handleFund(item.id)}>
                    Fund
                  </Button>
                  <Button variant="success" size="sm" loading={payingId === item.id} onClick={() => handleMarkPaid(item.id)}>
                    Paid
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cashflow Trend Chart */}
      <Card title="6-Month Cashflow Trend">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.cashflow_trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#64748b' }} width={38} />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? 'Income' : 'Expenses']}
              labelFormatter={(label) => formatMonth(label)}
            />
            <Legend formatter={(v) => v === 'income' ? 'Income' : 'Expenses'} />
            <Area type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} fill="url(#colorIncome)" />
            <Area type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} fill="url(#colorExpenses)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Upcoming 7 Days */}
      <Card title="Upcoming — Next 7 Days">
        {data.upcoming_7_days.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming expenses in the next 7 days.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.upcoming_7_days.map((item: ExpenseItem) => {
              const needsFunding = item.status === 'pending' || item.status === 'overdue';
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 py-3 ${needsFunding ? 'bg-amber-50 -mx-4 px-4 first:-mt-1 last:-mb-1' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium text-sm truncate ${needsFunding ? 'text-amber-900' : 'text-slate-900'}`}>{item.name}</p>
                    <p className={`text-xs mt-0.5 ${needsFunding ? 'text-amber-700' : 'text-slate-500'}`}>
                      {formatDate(item.due_date)}{item.property ? ` · ${item.property.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-semibold text-sm ${needsFunding ? 'text-amber-900' : 'text-slate-900'}`}>
                      {formatCurrency(item.amount)}
                    </span>
                    {item.status === 'funded' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Funded</span>
                    ) : item.status === 'paid' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid</span>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button variant="info" size="sm" loading={fundingId === item.id} onClick={() => handleFund(item.id)}>
                          Fund
                        </Button>
                        <Button variant="success" size="sm" loading={payingId === item.id} onClick={() => handleMarkPaid(item.id)}>
                          Paid
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Overdue */}
      {data.overdue_items.length > 0 && (
        <Card title="Overdue Items">
          <div className="mb-3 px-3 py-2 bg-red-50 rounded-lg">
            <p className="text-sm font-medium text-red-700">{data.overdue_items.length} item{data.overdue_items.length !== 1 ? 's' : ''} overdue</p>
          </div>
          <div className="divide-y divide-red-50">
            {data.overdue_items.map((item: ExpenseItem) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 text-sm truncate">{item.name}</p>
                  <p className="text-xs text-red-500 mt-0.5">{formatDate(item.due_date)}{item.property ? ` · ${item.property.name}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-sm text-red-700">{formatCurrency(item.amount)}</span>
                  <Button variant="info" size="sm" loading={fundingId === item.id} onClick={() => handleFund(item.id)}>Fund</Button>
                  <Button variant="success" size="sm" loading={payingId === item.id} onClick={() => handleMarkPaid(item.id)}>Paid</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Reimbursements */}
      {data.pending_reimbursements.length > 0 && (
        <Card title="Pending Reimbursements">
          <div className="divide-y divide-slate-100">
            {data.pending_reimbursements.map((item: IncomeItem) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  {item.property && <p className="text-xs text-slate-500">{item.property.name}</p>}
                </div>
                <span className="font-semibold text-sm text-amber-700">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="pt-2 flex justify-between font-semibold text-sm text-slate-700">
              <span>Total pending</span>
              <span>{formatCurrency(data.pending_reimbursements.reduce((s, i) => s + Number(i.amount), 0))}</span>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
