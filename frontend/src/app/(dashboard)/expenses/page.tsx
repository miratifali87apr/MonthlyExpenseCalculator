'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { expensesApi } from '@/lib/api';
import {
  formatCurrency,
  formatDate,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_COLORS,
  CATEGORIES,
} from '@/lib/utils';
import { ExpenseItem, Category, PaymentStatus } from '@/types';
import dayjs from 'dayjs';
import { ChevronUp, ChevronDown, ChevronsUpDown, Plus, X } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import type { Property } from '@/types';

type SortKey = 'due_date' | 'name' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';

function AddExpenseModal({ onClose, onSaved, properties }: { onClose: () => void; onSaved: () => void; properties: Property[] }) {
  const [form, setForm] = useState({
    name: '', category: 'other', amount: '', due_date: dayjs().format('YYYY-MM-DD'),
    status: 'pending', property_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.name.trim() || !form.amount) { setError('Name and amount are required.'); return; }
    setSaving(true); setError('');
    try {
      await expensesApi.create({
        name: form.name.trim(), category: form.category as Category,
        amount: parseFloat(form.amount),
        due_date: new Date(form.due_date).toISOString(),
        status: form.status as PaymentStatus,
        property_id: form.property_id ? parseInt(form.property_id) : undefined,
        notes: form.notes.trim() || undefined,
        is_recurring: false,
      });
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Add Expense</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expense Name *</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="e.g. Water Bill" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="0.00" value={form.amount} onChange={e => update('amount', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.category} onChange={e => update('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.status} onChange={e => update('status', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Property</label>
            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.property_id} onChange={e => update('property_id', e.target.value)}>
              <option value="">No property (personal)</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="Optional" value={form.notes} onChange={e => update('notes', e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>Save Expense</Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  paid: 'success',
  pending: 'warning',
  overdue: 'danger',
  funded: 'info',
  partial: 'warning',
};

function PartialPayModal({ expense, onClose, onSaved }: { expense: ExpenseItem; onClose: () => void; onSaved: () => void }) {
  const remaining = expense.amount - (expense.amount_paid ?? 0);
  const [amount, setAmount] = useState(String(remaining.toFixed(2)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError('Enter a valid amount.'); return; }
    if (val > remaining) { setError(`Cannot pay more than remaining balance ${formatCurrency(remaining)}.`); return; }
    setSaving(true); setError('');
    try {
      await expensesApi.partialPay(expense.id, val);
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Partial Payment</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Total</span>
              <span className="font-medium text-slate-900">{formatCurrency(expense.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already paid</span>
              <span className="font-medium text-green-700">{formatCurrency(expense.amount_paid ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1">
              <span className="text-slate-700 font-medium">Remaining</span>
              <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Amount ($)</label>
            <input
              type="number" step="0.01"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>Record Payment</Button>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const now = dayjs();
  const [month, setMonth] = useState<number>(now.month() + 1);
  const [year, setYear] = useState<number>(now.year());
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [partialPayExpense, setPartialPayExpense] = useState<ExpenseItem | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const queryClient = useQueryClient();

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  const queryKey = ['expenses', month, year, status, category];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () =>
      expensesApi.list({
        month,
        year,
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const handleMarkPaid = async (id: number) => {
    setActionId(id);
    try {
      await expensesApi.pay(id);
      await invalidate();
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    setActionId(id);
    try {
      await expensesApi.delete(id);
      await invalidate();
    } finally {
      setActionId(null);
    }
  };

  const sorted: ExpenseItem[] = [...(data ?? [])].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'due_date') cmp = (a.due_date ?? '').localeCompare(b.due_date ?? '');
    else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'amount') cmp = a.amount - b.amount;
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const total = sorted.reduce((sum: number, e: ExpenseItem) => sum + e.amount, 0);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.year() - 2 + i);

  const selectCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400";

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddExpenseModal
          properties={properties}
          onClose={() => setShowAdd(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey })}
        />
      )}
      {partialPayExpense && (
        <PartialPayModal
          expense={partialPayExpense}
          onClose={() => setPartialPayExpense(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey }); }}
        />
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1" /> Add
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="funded">Funded</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* List */}
      <Card>
        {isLoading ? (
          <PageSpinner />
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load expenses.</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses found for the selected filters.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {sorted.map((item: ExpenseItem) => (
                <div key={item.id} className={`py-3 ${item.status === 'pending' || item.status === 'overdue' ? 'bg-amber-50 -mx-4 px-4' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(item.due_date)}{item.property ? ` · ${item.property.name}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-900">{formatCurrency(item.amount)}</p>
                      <Badge variant={STATUS_BADGE_MAP[item.status] ?? 'default'} className="mt-0.5">
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  {item.status === 'partial' && (
                    <p className="text-xs text-amber-700 mb-1">
                      Paid {formatCurrency(item.amount_paid ?? 0)} · Remaining {formatCurrency(item.amount - (item.amount_paid ?? 0))}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-800'}`}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <div className="flex gap-1.5 ml-auto">
                      {item.status === 'paid' ? (
                        <Button variant="ghost" size="sm" loading={actionId === item.id}
                          onClick={async () => { setActionId(item.id); try { await expensesApi.unpay(item.id); await invalidate(); } finally { setActionId(null); } }}>
                          Undo
                        </Button>
                      ) : item.status === 'funded' ? (
                        <>
                          <Button variant="success" size="sm" loading={actionId === item.id} onClick={() => handleMarkPaid(item.id)}>Paid</Button>
                          <Button variant="ghost" size="sm" loading={actionId === item.id}
                            onClick={async () => { setActionId(item.id); try { await expensesApi.unpay(item.id); await invalidate(); } finally { setActionId(null); } }}>
                            Undo
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="success" size="sm" loading={actionId === item.id} onClick={() => handleMarkPaid(item.id)}>Paid</Button>
                          <Button variant="ghost" size="sm" onClick={() => setPartialPayExpense(item)}>Part Pay</Button>
                          <Button variant="info" size="sm" loading={actionId === item.id}
                            onClick={async () => { setActionId(item.id); try { await expensesApi.fund(item.id); await invalidate(); } finally { setActionId(null); } }}>
                            Fund
                          </Button>
                        </>
                      )}
                      <Button variant="danger" size="sm" loading={actionId === item.id} onClick={() => handleDelete(item.id)}>Del</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    {(
                      [
                        { key: 'due_date', label: 'Due Date' },
                        { key: 'name', label: 'Expense' },
                        { key: null, label: 'Property' },
                        { key: null, label: 'Category' },
                        { key: 'amount', label: 'Amount', right: true },
                        { key: 'status', label: 'Status' },
                        { key: null, label: 'Actions' },
                      ] as { key: SortKey | null; label: string; right?: boolean }[]
                    ).map(({ key, label, right }) => (
                      <th
                        key={label}
                        className={`pb-3 pr-4 font-medium last:pr-0 ${right ? 'text-right' : ''} ${key ? 'cursor-pointer select-none hover:text-slate-800' : ''}`}
                        onClick={() => key && toggleSort(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {key && (
                            sortKey === key ? (
                              sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                            ) : (
                              <ChevronsUpDown size={13} className="text-slate-300" />
                            )
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((item: ExpenseItem) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 text-slate-600">{formatDate(item.due_date)}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{item.property?.name ?? '—'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-900">
                        {formatCurrency(item.amount)}
                        {item.status === 'partial' && (
                          <p className="text-xs font-normal text-amber-600">{formatCurrency(item.amount - (item.amount_paid ?? 0))} left</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_BADGE_MAP[item.status] ?? 'default'}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {item.status === 'paid' ? (
                            <Button variant="ghost" size="sm" loading={actionId === item.id}
                              onClick={async () => { setActionId(item.id); try { await expensesApi.unpay(item.id); await invalidate(); } finally { setActionId(null); } }}>
                              Undo Paid
                            </Button>
                          ) : item.status === 'funded' ? (
                            <>
                              <Button variant="success" size="sm" loading={actionId === item.id}
                                onClick={() => handleMarkPaid(item.id)}>
                                Mark Paid
                              </Button>
                              <Button variant="ghost" size="sm" loading={actionId === item.id}
                                onClick={async () => { setActionId(item.id); try { await expensesApi.unpay(item.id); await invalidate(); } finally { setActionId(null); } }}>
                                Undo
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="success" size="sm" loading={actionId === item.id}
                                onClick={() => handleMarkPaid(item.id)}>
                                Mark Paid
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setPartialPayExpense(item)}>
                                Part Pay
                              </Button>
                              <Button variant="info" size="sm" loading={actionId === item.id}
                                onClick={async () => { setActionId(item.id); try { await expensesApi.fund(item.id); await invalidate(); } finally { setActionId(null); } }}>
                                Funded
                              </Button>
                            </>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            loading={actionId === item.id}
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
              <div className="text-sm text-slate-500">
                Total:{' '}
                <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
