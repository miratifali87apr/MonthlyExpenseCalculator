'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { expensesApi, aiApi } from '@/lib/api';
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
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Plus, X, Download,
  Trash2, CheckSquare, Pencil, BarChart2, Table2, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { propertiesApi } from '@/lib/api';
import type { Property } from '@/types';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

type SortKey = 'due_date' | 'name' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'chart';

// ─── Chart palette ──────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#6366f1', '#64748b', '#0ea5e9', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#a855f7',
];

// ─── Excel export ────────────────────────────────────────────────────────────
async function exportToExcel(items: ExpenseItem[], month: number, year: number) {
  const XLSX = await import('xlsx');
  const rows = items.map(e => ({
    'Date': formatDate(e.due_date),
    'Expense Name': e.name,
    'Category': CATEGORY_LABELS[e.category] ?? e.category,
    'Property': e.property?.name ?? '',
    'Amount ($)': e.amount,
    'Amount Paid ($)': e.amount_paid ?? 0,
    'Status': e.status.charAt(0).toUpperCase() + e.status.slice(1),
    'Notes': e.notes ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 22 },
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

  const monthName = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM-YYYY');
  XLSX.writeFile(wb, `CashflowWise-Expenses-${monthName}.xlsx`);
}

// ─── CSV export (kept for quick download) ────────────────────────────────────
function exportToCSV(items: ExpenseItem[], month: number, year: number) {
  const headers = ['Name', 'Category', 'Amount', 'Amount Paid', 'Due Date', 'Status', 'Property', 'Notes'];
  const rows = items.map(e => [
    e.name,
    CATEGORY_LABELS[e.category] ?? e.category,
    e.amount.toFixed(2),
    (e.amount_paid ?? 0).toFixed(2),
    formatDate(e.due_date),
    e.status,
    e.property?.name ?? '',
    e.notes ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses-${year}-${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart view ──────────────────────────────────────────────────────────────
function ChartView({ items }: { items: ExpenseItem[] }) {
  const total = items.reduce((s, e) => s + e.amount, 0);

  // Category breakdown for pie
  const categoryMap: Record<string, number> = {};
  for (const e of items) {
    const key = CATEGORY_LABELS[e.category] ?? e.category;
    categoryMap[key] = (categoryMap[key] ?? 0) + e.amount;
  }
  const pieData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Status breakdown for bar
  const statusMap: Record<string, number> = {};
  for (const e of items) {
    const label = e.status.charAt(0).toUpperCase() + e.status.slice(1);
    statusMap[label] = (statusMap[label] ?? 0) + e.amount;
  }
  const barData = Object.entries(statusMap).map(([status, amount]) => ({ status, amount }));

  const STATUS_BAR_COLORS: Record<string, string> = {
    Paid: '#10b981',
    Pending: '#64748b',
    Overdue: '#f43f5e',
    Funded: '#6366f1',
    Partial: '#f59e0b',
  };

  const formatTooltipValue = (value: number) => formatCurrency(value);

  if (items.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">No data for selected period.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-slate-900' },
          { label: 'Paid', value: items.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0), color: 'text-emerald-700' },
          { label: 'Pending', value: items.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0), color: 'text-slate-600' },
          { label: 'Overdue', value: items.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0), color: 'text-rose-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category pie */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">By Category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipValue} />
              <Legend
                formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status bar */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">By Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={STATUS_BAR_COLORS[entry.status] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Category Breakdown</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium text-right">% of Total</th>
                <th className="px-4 py-2.5 font-medium text-right"># Bills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pieData.map(({ name, value }) => (
                <tr key={name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(value)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {items.filter(e => (CATEGORY_LABELS[e.category] ?? e.category) === name).length}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(total)}</td>
                <td className="px-4 py-2.5 text-right">100%</td>
                <td className="px-4 py-2.5 text-right">{items.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onSaved, properties }: { onClose: () => void; onSaved: () => void; properties: Property[] }) {
  const [form, setForm] = useState({
    name: '', category: 'other', amount: '', due_date: dayjs().format('YYYY-MM-DD'),
    status: 'pending', property_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update(field: keyof typeof form, value: string) {
    if (error) setError('');
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleScanBill(file: File) {
    setScanning(true);
    setScanError('');
    try {
      const data = await aiApi.extractBillFree(file);
      // Pre-fill form with extracted data
      setForm(f => ({
        ...f,
        name: data.name || f.name,
        amount: data.amount != null ? String(data.amount) : f.amount,
        due_date: data.due_date || f.due_date,
        category: data.category || f.category,
        notes: data.notes || f.notes,
      }));
      // Auto-match property: check if any property name/address appears in the bill text
      if (data._text_sample && properties.length > 0) {
        const sample = data._text_sample;
        const matched = properties.find(p => {
          const name = p.name.toLowerCase();
          const addr = (p.address ?? '').toLowerCase();
          return sample.includes(name) || (addr.length > 3 && sample.includes(addr.split(' ')[0]));
        });
        if (matched) setForm(f => ({ ...f, property_id: String(matched.id) }));
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Try a clearer image.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    const parsedAmount = parseFloat(form.amount);
    if (!form.name.trim() || !form.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Name and a positive amount are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      await expensesApi.create({
        name: form.name.trim(), category: form.category as Category,
        amount: parsedAmount,
        due_date: dayjs(form.due_date).toISOString(),
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
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:pb-4 pb-20 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-slate-900">Add Expense</h2>
          <button onClick={onClose} aria-label="Close" className="rounded focus:outline-none focus:ring-2 focus:ring-slate-400">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          {/* Scan Bill — upload any bill PDF/image to auto-fill the form */}
          <label className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${scanning ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="sr-only"
              disabled={scanning}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScanBill(f); }}
            />
            {scanning
              ? <><span className="animate-spin h-4 w-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full shrink-0" /><span className="text-xs text-indigo-600 font-medium">Reading bill…</span></>
              : <><span className="text-base">📷</span><span className="text-xs text-slate-500 font-medium">Scan bill to auto-fill <span className="text-indigo-600">— tap to upload PDF or photo</span></span></>
            }
          </label>
          {scanError && <p className="text-xs text-red-600">{scanError}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expense Name *</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="e.g. Water Bill" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" min="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="0.00" value={form.amount} onChange={e => update('amount', e.target.value)} />
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
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>Save Expense</Button>
        </div>
      </div>
    </div>
  );
}

function EditExpenseModal({ expense, onClose, onSaved, properties }: { expense: ExpenseItem; onClose: () => void; onSaved: () => void; properties: Property[] }) {
  const [form, setForm] = useState({
    name: expense.name,
    category: expense.category,
    amount: String(expense.amount),
    due_date: dayjs(expense.due_date).format('YYYY-MM-DD'),
    status: expense.status,
    property_id: expense.property_id ? String(expense.property_id) : '',
    notes: expense.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field: keyof typeof form, value: string) {
    if (error) setError('');
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    const parsedAmount = parseFloat(form.amount);
    if (!form.name.trim() || !form.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Name and a positive amount are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      await expensesApi.update(expense.id, {
        name: form.name.trim(),
        category: form.category as Category,
        amount: parsedAmount,
        due_date: dayjs(form.due_date).toISOString(),
        status: form.status as PaymentStatus,
        property_id: form.property_id ? parseInt(form.property_id) : undefined,
        notes: form.notes.trim() || undefined,
      });
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:pb-4 pb-20 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-slate-900">Edit Expense</h2>
          <button onClick={onClose} aria-label="Close" className="rounded focus:outline-none focus:ring-2 focus:ring-slate-400">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expense Name *</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" min="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.amount} onChange={e => update('amount', e.target.value)} />
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
                <option value="funded">Reserved</option>
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
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>Save Changes</Button>
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const now = dayjs();
  const [month, setMonth] = useState<number>(now.month() + 1);
  const [year, setYear] = useState<number>(now.year());
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null);
  const [partialPayExpense, setPartialPayExpense] = useState<ExpenseItem | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [xlsxLoading, setXlsxLoading] = useState(false);

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
      toast.success('Marked as paid');
    } catch {
      toast.error('Failed to mark as paid');
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
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setActionId(null);
    }
  };

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(e => e.id)));
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} expense${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => expensesApi.delete(id)));
      await invalidate();
      toast.success(`${selectedIds.size} expense${selectedIds.size > 1 ? 's' : ''} deleted`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to delete some expenses');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkPay() {
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => expensesApi.pay(id)));
      await invalidate();
      toast.success(`${selectedIds.size} expense${selectedIds.size > 1 ? 's' : ''} marked as paid`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to mark some expenses as paid');
    } finally {
      setBulkLoading(false);
    }
  }

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
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.year() - 2 + i);
  const selectCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400";

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddExpenseModal
          properties={properties}
          onClose={() => setShowAdd(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey }); toast.success('Expense added'); }}
        />
      )}
      {editExpense && (
        <EditExpenseModal
          expense={editExpense}
          properties={properties}
          onClose={() => setEditExpense(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey }); toast.success('Expense updated'); }}
        />
      )}
      {partialPayExpense && (
        <PartialPayModal
          expense={partialPayExpense}
          onClose={() => setPartialPayExpense(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey }); toast.success('Payment recorded'); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Table2 size={13} /> Table
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'chart'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart2 size={13} /> Charts
            </button>
          </div>

          {/* Export buttons — hidden on mobile to keep Add button visible */}
          {sorted.length > 0 && (
            <div className="hidden sm:contents">
              <button
                onClick={() => exportToCSV(sorted, month, year)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Export to CSV"
              >
                <Download size={13} /> CSV
              </button>
              <button
                onClick={async () => {
                  setXlsxLoading(true);
                  try { await exportToExcel(sorted, month, year); }
                  finally { setXlsxLoading(false); }
                }}
                disabled={xlsxLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                title="Export to Excel"
              >
                <FileSpreadsheet size={13} /> {xlsxLoading ? 'Generating…' : 'Excel'}
              </button>
            </div>
          )}

          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={15} className="mr-1" /> Add
          </Button>
        </div>
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

      {/* Content */}
      <Card>
        {isLoading ? (
          <TableSkeleton rows={7} cols={7} />
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load expenses.</p>
        ) : viewMode === 'chart' ? (
          <ChartView items={sorted} />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses found for the selected filters.</p>
        ) : (
          <>
            {/* Mobile bulk action bar */}
            <div className="md:hidden mb-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 font-medium">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 cursor-pointer"
                  checked={sorted.length > 0 && selectedIds.size === sorted.length}
                  onChange={toggleSelectAll}
                />
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
              </label>
              {selectedIds.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkPay}
                    disabled={bulkLoading}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Mark All Paid
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkLoading}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {sorted.map((item: ExpenseItem) => (
                <div key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 cursor-pointer mt-1 flex-shrink-0"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-base truncate">{item.name}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{formatDate(item.due_date)}{item.property ? ` · ${item.property.name}` : ''}</p>
                      </div>
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
                      <Button variant="ghost" size="sm" onClick={() => setEditExpense(item)}><Pencil size={13} /></Button>
                      <Button variant="danger" size="sm" loading={actionId === item.id} onClick={() => handleDelete(item.id)}>Del</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="hidden md:flex items-center gap-3 mb-3 px-3 py-2 bg-slate-800 text-white rounded-xl text-sm">
                <CheckSquare size={15} className="text-slate-300" />
                <span className="font-semibold">{selectedIds.size} selected</span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={handleBulkPay}
                    disabled={bulkLoading}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Mark All Paid
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkLoading}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-3 pr-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-slate-800 cursor-pointer"
                        checked={sorted.length > 0 && selectedIds.size === sorted.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
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
                    <tr key={item.id} className={selectedIds.has(item.id) ? 'bg-slate-50' : ''}>
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-slate-800 cursor-pointer"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
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
                                Reserve
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditExpense(item)}>
                            <Pencil size={13} className="mr-1" /> Edit
                          </Button>
                          <Button variant="danger" size="sm" loading={actionId === item.id} onClick={() => handleDelete(item.id)}>
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
