'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { dashboardApi, expensesApi, recurringApi, exportApi } from '@/lib/api';
import { formatCurrency, formatDate, formatMonth } from '@/lib/utils';
import type { ExpenseItem, IncomeItem } from '@/types';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, FileDown, ArrowRight,
  CheckCircle2, Clock, AlertCircle, Home, RefreshCw, Sparkles,
  ChevronRight, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// ─── Tax export ───────────────────────────────────────────────────────────────
async function downloadTaxExport(setLoading: (v: boolean) => void) {
  setLoading(true);
  const now = new Date();
  const fy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  try {
    const result = await exportApi.taxYear(fy);
    const rows: string[][] = [];
    rows.push([`CashflowWise — ${result.financial_year}`]);
    rows.push([]);
    rows.push(['INCOME']);
    rows.push(['Date', 'Description', 'Type', 'Property', 'Amount', 'Notes']);
    result.income.forEach((i) => rows.push([
      String(i.date), String(i.name), String(i.type), String(i.property),
      String(i.amount), String(i.notes),
    ]));
    rows.push([]);
    rows.push(['EXPENSES']);
    rows.push(['Due Date', 'Description', 'Category', 'Property', 'Amount', 'Paid', 'Status', 'Notes']);
    result.expenses.forEach((e) => rows.push([
      String(e.due_date), String(e.name), String(e.category), String(e.property),
      String(e.amount), String(e.amount_paid), String(e.status), String(e.notes),
    ]));
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Total Income', String(result.summary.total_income)]);
    rows.push(['Total Expenses', String(result.summary.total_expenses)]);
    rows.push(['Net Cashflow', String(result.summary.net)]);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflowwise-FY${fy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`FY${fy} tax summary downloaded`);
  } catch {
    toast.error('Export failed. Please try again.');
  } finally {
    setLoading(false);
  }
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Bill row ─────────────────────────────────────────────────────────────────
function BillRow({
  item, payingId, fundingId, onPay, onFund,
}: {
  item: ExpenseItem;
  payingId: number | null;
  fundingId: number | null;
  onPay: (id: number) => void;
  onFund: (id: number) => void;
}) {
  const isOverdue = item.status === 'overdue';
  const isFunded = item.status === 'funded';
  const isPaid = item.status === 'paid';
  const daysUntil = dayjs(item.due_date).diff(dayjs(), 'day');
  const dueLabel = daysUntil === 0 ? 'Due today' : daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `Due in ${daysUntil}d`;

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-slate-50 last:border-0">
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${
        isPaid ? 'bg-emerald-400' : isFunded ? 'bg-indigo-400' : isOverdue ? 'bg-rose-400' : 'bg-slate-300'
      }`} />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          <span className={isOverdue ? 'text-rose-500 font-medium' : ''}>{dueLabel}</span>
          {item.property ? ` · ${item.property.name}` : ''}
        </p>
      </div>

      {/* Amount */}
      <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
        {formatCurrency(item.amount)}
      </span>

      {/* Action */}
      <div className="shrink-0">
        {isPaid ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={11} /> Paid
          </span>
        ) : isFunded ? (
          <Button variant="success" size="sm" loading={payingId === item.id} onClick={() => onPay(item.id)}>
            Mark Paid
          </Button>
        ) : (
          <div className="flex gap-1.5">
            <Button variant="info" size="sm" loading={fundingId === item.id} onClick={() => onFund(item.id)}>
              Reserve
            </Button>
            <Button variant="success" size="sm" loading={payingId === item.id} onClick={() => onPay(item.id)}>
              Paid
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty / Onboarding ───────────────────────────────────────────────────────
function EmptyDashboard() {
  const steps = [
    {
      icon: <Home className="w-5 h-5 text-slate-700" />,
      badge: 'Start here', badgeCls: 'bg-slate-800 text-white',
      title: 'Add your first property',
      desc: 'Everything connects to a property — mortgage, insurance, rates, and rental income.',
      cta: 'Add Property', href: '/properties',
      ctaCls: 'bg-slate-800 hover:bg-slate-700 text-white',
      cardCls: 'border-slate-300 ring-2 ring-slate-800/10',
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-indigo-600" />,
      badge: 'Step 2', badgeCls: 'bg-indigo-50 text-indigo-700',
      title: 'Set up recurring bills',
      desc: 'Add your mortgage, insurance, council rates once — we auto-generate them every month.',
      cta: 'Set Up Recurring Bills', href: '/recurring',
      ctaCls: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      cardCls: 'border-slate-200',
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      badge: 'Step 3', badgeCls: 'bg-emerald-50 text-emerald-700',
      title: 'Add your income',
      desc: 'Salary, rental, or other income. Your dashboard shows real cashflow — in vs out.',
      cta: 'Add Income', href: '/income',
      ctaCls: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      cardCls: 'border-slate-200',
    },
    {
      icon: <Sparkles className="w-5 h-5 text-violet-600" />,
      badge: 'Optional', badgeCls: 'bg-violet-50 text-violet-700',
      title: 'Explore AI Insights',
      desc: 'AI analysis of your portfolio, purchase modelling, and holding cost breakdown.',
      cta: 'View AI Insights', href: '/insights',
      ctaCls: 'bg-violet-600 hover:bg-violet-700 text-white',
      cardCls: 'border-slate-200',
    },
  ];

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
          <DollarSign className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome to CashflowWise</h2>
        <p className="text-slate-500 mt-2 text-sm max-w-sm mx-auto">
          Set up in 5 minutes. Follow the steps below in order.
        </p>
      </div>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.href} className={`relative rounded-xl border bg-white p-5 hover:shadow-md transition-shadow ${step.cardCls}`}>
            {i < steps.length - 1 && (
              <div className="absolute left-[2.35rem] -bottom-3 w-px h-3 bg-slate-200 z-10" />
            )}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mb-1.5 ${step.badgeCls}`}>
                  {step.badge}
                </span>
                <h3 className="font-semibold text-slate-900 text-base">{step.title}</h3>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                <Link
                  href={step.href}
                  className={`inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${step.ctaCls}`}
                >
                  {step.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 mb-2">Not a property investor?</p>
        <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 font-medium">
          Go to Bills & Payments <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<number | null>(null);
  const [fundingId, setFundingId] = useState<number | null>(null);
  const [exportingFY, setExportingFY] = useState(false);
  const hasGenerated = useRef(false);

  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;

    // Only generate once per day — skip on subsequent page visits to avoid unnecessary
    // POST requests that add latency on every dashboard load.
    const GENERATE_KEY = 'cfw_last_generate';
    const today = new Date().toDateString();
    if (typeof window !== 'undefined' && localStorage.getItem(GENERATE_KEY) === today) return;

    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    Promise.all([recurringApi.generate(m, y), recurringApi.generate(nm, ny)])
      .then(([a, b]) => {
        if (typeof window !== 'undefined') localStorage.setItem(GENERATE_KEY, today);
        const total = (a.generated ?? 0) + (b.generated ?? 0);
        if (total > 0) {
          toast.success(`${total} bill${total > 1 ? 's' : ''} auto-generated`);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
      }).catch(() => {});
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
      toast.success('Marked as paid');
    } catch { toast.error('Failed'); }
    finally { setPayingId(null); }
  };

  const handleFund = async (id: number) => {
    setFundingId(id);
    try {
      await expensesApi.fund(id);
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Reserved');
    } catch { toast.error('Failed'); }
    finally { setFundingId(null); }
  };

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <div className="text-red-600 p-4 text-sm">Failed to load dashboard.</div>;
  if (!data) return null;

  const isEmpty =
    data.total_monthly_income === 0 &&
    data.total_monthly_expenses === 0 &&
    data.upcoming_7_days.length === 0 &&
    data.overdue_items.length === 0;

  if (isEmpty) return <EmptyDashboard />;

  const netPositive = data.net_cashflow >= 0;
  const currentMonth = dayjs().format('MMMM YYYY');

  // Merge upcoming + overdue into one action list, deduplicated
  const allActionItems: ExpenseItem[] = [
    ...data.overdue_items,
    ...data.next_unfunded.filter(i => !data.overdue_items.find(o => o.id === i.id)),
    ...data.upcoming_7_days.filter(i =>
      !data.overdue_items.find(o => o.id === i.id) &&
      !data.next_unfunded.find(n => n.id === i.id)
    ),
  ].slice(0, 10);

  const paidCount = data.upcoming_7_days.filter(i => i.status === 'paid').length;
  const pendingCount = data.next_unfunded.length;
  const overdueCount = data.overdue_items.length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── Hero Card ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-6 md:p-8 relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />

        <div className="relative">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">{currentMonth}</p>
          <p className="text-xs text-white/50 mb-4">Net Cashflow</p>

          <div className="flex items-end gap-4 mb-6">
            <p className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-none">
              {formatCurrency(Math.abs(data.net_cashflow))}
            </p>
            <div className={`flex items-center gap-1.5 mb-1 px-3 py-1.5 rounded-full text-xs font-bold ${
              netPositive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {netPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {netPositive ? 'Positive' : 'Negative'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white/8 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-xs text-white/40 font-medium mb-1">Total Income</p>
              <p className="text-xl font-bold text-emerald-300">{formatCurrency(data.total_monthly_income)}</p>
            </div>
            <div className="bg-white/8 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-xs text-white/40 font-medium mb-1">Total Bills</p>
              <p className="text-xl font-bold text-white">{formatCurrency(data.total_monthly_expenses)}</p>
            </div>
          </div>

          <button
            onClick={() => downloadTaxExport(setExportingFY)}
            disabled={exportingFY}
            className="flex items-center gap-2 text-white/50 hover:text-white/80 text-xs font-medium transition-colors disabled:opacity-40"
          >
            <FileDown size={13} />
            {exportingFY ? 'Preparing…' : 'Download Tax Year Summary'}
          </button>
        </div>
      </div>

      {/* ── Quick Stats Row ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <StatPill
          icon={<CheckCircle2 size={16} className="text-emerald-600" />}
          label="Paid this month"
          value={String(paidCount)}
          sub="bills cleared"
          color="bg-emerald-50"
        />
        <StatPill
          icon={<Clock size={16} className="text-indigo-600" />}
          label="Pending"
          value={String(pendingCount)}
          sub={pendingCount > 0 ? `${formatCurrency(data.next_unfunded.reduce((s, i) => s + i.amount, 0))} to action` : 'all clear'}
          color="bg-indigo-50"
        />
        <StatPill
          icon={<AlertCircle size={16} className={overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'} />}
          label="Overdue"
          value={String(overdueCount)}
          sub={overdueCount > 0 ? 'needs attention' : 'nothing overdue'}
          color={overdueCount > 0 ? 'bg-rose-50' : 'bg-slate-50'}
        />
      </div>

      {/* ── Main content grid ───────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-5 gap-5">

        {/* Bills to action — 3 cols */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Bills to Action</h2>
              <p className="text-xs text-slate-400 mt-0.5">Overdue, unfunded &amp; upcoming 7 days</p>
            </div>
            <Link href="/expenses" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5">
              See all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="px-5 py-1">
            {allActionItems.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">All clear!</p>
                <p className="text-xs text-slate-400 mt-1">No bills needing action right now.</p>
              </div>
            ) : (
              allActionItems.map(item => (
                <BillRow
                  key={item.id}
                  item={item}
                  payingId={payingId}
                  fundingId={fundingId}
                  onPay={handleMarkPaid}
                  onFund={handleFund}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column — 2 cols */}
        <div className="md:col-span-2 flex flex-col gap-5">

          {/* Cashflow chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1">
            <h2 className="font-bold text-slate-900 text-sm mb-1">6-Month Trend</h2>
            <p className="text-xs text-slate-400 mb-4">Income vs expenses</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.cashflow_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tickFormatter={(v) => dayjs(v).format('MMM')} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#94a3b8' }} width={32} />
                <Tooltip
                  formatter={(v: number, n: string) => [formatCurrency(v), n === 'income' ? 'Income' : 'Bills']}
                  labelFormatter={(l) => formatMonth(l)}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="income" stroke="#6366f1" strokeWidth={2} fill="url(#gi)" />
                <Area type="monotone" dataKey="expenses" stroke="#94a3b8" strokeWidth={2} fill="url(#ge)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Bills
              </span>
            </div>
          </div>

          {/* Pending reimbursements */}
          {data.pending_reimbursements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-bold text-slate-900 text-sm mb-3">Pending Reimbursements</h2>
              <div className="space-y-2">
                {data.pending_reimbursements.map((item: IncomeItem) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 font-medium truncate">{item.name}</p>
                      {item.property && <p className="text-xs text-slate-400">{item.property.name}</p>}
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between text-xs font-semibold text-slate-600">
                  <span>Total</span>
                  <span>{formatCurrency(data.pending_reimbursements.reduce((s, i) => s + Number(i.amount), 0))}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
