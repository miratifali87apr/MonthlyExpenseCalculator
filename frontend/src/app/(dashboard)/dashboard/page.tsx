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
import { AlertTriangle, Home, RefreshCw, TrendingUp, Sparkles, ChevronRight, ArrowRight } from 'lucide-react';
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
    const steps = [
      {
        num: 1,
        icon: <Home className="w-5 h-5 text-slate-700" />,
        label: 'Start here',
        labelColor: 'bg-slate-800 text-white',
        title: 'Add your first property',
        desc: 'Everything connects to a property — your mortgage, insurance, rates, rental income, and cashflow analysis all live here.',
        cta: 'Add Property',
        href: '/properties',
        ctaStyle: 'bg-slate-800 hover:bg-slate-700 text-white',
        cardStyle: 'border-slate-300 bg-white ring-2 ring-slate-800/10',
      },
      {
        num: 2,
        icon: <RefreshCw className="w-5 h-5 text-blue-600" />,
        label: 'Step 2',
        labelColor: 'bg-blue-100 text-blue-700',
        title: 'Set up your recurring bills',
        desc: 'Add your regular bills once — mortgage, insurance, council rates — and we\'ll auto-generate them every month so you never miss one.',
        cta: 'Set Up Recurring Bills',
        href: '/recurring',
        ctaStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
        cardStyle: 'border-slate-200 bg-white',
      },
      {
        num: 3,
        icon: <TrendingUp className="w-5 h-5 text-green-600" />,
        label: 'Step 3',
        labelColor: 'bg-green-100 text-green-700',
        title: 'Add your income',
        desc: 'Add your salary, rental income, or other earnings. Your dashboard will show real cashflow — what\'s coming in vs going out.',
        cta: 'Add Income',
        href: '/income',
        ctaStyle: 'bg-green-600 hover:bg-green-700 text-white',
        cardStyle: 'border-slate-200 bg-white',
      },
      {
        num: 4,
        icon: <Sparkles className="w-5 h-5 text-purple-600" />,
        label: 'Optional',
        labelColor: 'bg-purple-100 text-purple-700',
        title: 'Explore AI Insights',
        desc: 'Once your data is set up, get an AI analysis of your portfolio, model new property purchases, and see your holding costs.',
        cta: 'View AI Insights',
        href: '/insights',
        ctaStyle: 'bg-purple-600 hover:bg-purple-700 text-white',
        cardStyle: 'border-slate-200 bg-white',
      },
    ];

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome — let&apos;s get you set up</h2>
          <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
            Follow these steps in order. It takes about 5 minutes and your dashboard will be fully live.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.num} className={`relative rounded-xl border p-5 transition-shadow hover:shadow-md ${step.cardStyle}`}>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute left-[2.35rem] -bottom-3 w-px h-3 bg-slate-200 z-10" />
              )}
              <div className="flex items-start gap-4">
                {/* Icon circle */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${step.labelColor}`}>
                      {step.label}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">{step.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
                  <Link
                    href={step.href}
                    className={`inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${step.ctaStyle}`}
                  >
                    {step.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Personal use divider */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400 mb-3">Not a property investor? Track personal bills instead</p>
          <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
            Go to Expenses <ChevronRight className="w-4 h-4" />
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
