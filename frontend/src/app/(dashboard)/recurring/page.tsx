'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { CardGridSkeleton } from '@/components/ui/Skeleton';
import { recurringApi, propertiesApi } from '@/lib/api';
import {
  formatCurrency,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  FREQUENCY_LABELS,
  CATEGORIES,
  FREQUENCIES,
} from '@/lib/utils';
import { RecurringTemplate, Property, Category, Frequency } from '@/types';
import {
  Plus, X, Pencil, Pause, Play, Trash2,
  Calendar, Tag, Home, DollarSign, RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

const MONTH_LABELS: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

function toMonthlyAmount(template: RecurringTemplate): number {
  switch (template.frequency) {
    case 'weekly':      return (template.amount * 52) / 12;
    case 'fortnightly': return (template.amount * 26) / 12;
    case 'monthly':     return template.amount;
    case 'quarterly':   return template.amount / 3;
    case 'yearly':      return template.amount / 12;
    default:            return 0;
  }
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  loan:         'from-blue-500 to-blue-600',
  insurance:    'from-purple-500 to-purple-600',
  utility:      'from-yellow-500 to-yellow-600',
  council_rates:'from-orange-500 to-orange-600',
  bas:          'from-red-500 to-red-600',
  school_fees:  'from-pink-500 to-pink-600',
  credit_card:  'from-indigo-500 to-indigo-600',
  car:          'from-cyan-500 to-cyan-600',
  pm_fees:      'from-teal-500 to-teal-600',
  maintenance:  'from-amber-500 to-amber-600',
  letting_fee:  'from-violet-500 to-violet-600',
  other:        'from-slate-400 to-slate-500',
};

// ─── Form Modal (Add / Edit) ──────────────────────────────────────────────────

interface FormState {
  name: string;
  category: string;
  amount: string;
  frequency: string;
  day_of_month: string;
  month_of_year: string;
  property_id: string;
  notes: string;
}

function RecurringModal({
  onClose,
  onSaved,
  properties,
  editing,
}: {
  onClose: () => void;
  onSaved: (template: RecurringTemplate) => void;
  properties: Property[];
  editing?: RecurringTemplate;
}) {
  const [form, setForm] = useState<FormState>({
    name:         editing?.name ?? '',
    category:     editing?.category ?? 'loan',
    amount:       editing?.amount != null ? String(editing.amount) : '',
    frequency:    editing?.frequency ?? 'monthly',
    day_of_month: editing?.day_of_month != null ? String(editing.day_of_month) : '',
    month_of_year:editing?.month_of_year != null ? String(editing.month_of_year) : '1',
    property_id:  editing?.property_id != null ? String(editing.property_id) : '',
    notes:        editing?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.amount) {
      setError('Name and amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name:          form.name.trim(),
      category:      form.category as Category,
      amount:        parseFloat(form.amount),
      frequency:     form.frequency as Frequency,
      day_of_month:  form.day_of_month ? parseInt(form.day_of_month) : undefined,
      month_of_year: form.frequency === 'yearly' ? parseInt(form.month_of_year || '1') : undefined,
      property_id:   form.property_id ? parseInt(form.property_id) : undefined,
      notes:         form.notes.trim() || undefined,
      is_active:     true,
    };
    try {
      let saved: RecurringTemplate;
      if (editing) {
        saved = await recurringApi.update(editing.id, payload);
      } else {
        saved = await recurringApi.create(payload);
      }
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder:text-slate-300';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">{editing ? 'Edit Template' : 'New Recurring Template'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{editing ? 'Update the details below' : 'Set up a recurring expense'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className={labelCls}>Name *</label>
            <input
              className={inputCls}
              placeholder="e.g. Home Loan Repayment"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              autoFocus
            />
          </div>

          {/* Amount + Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount ($) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputCls} pl-6`}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => update('amount', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Due Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                className={inputCls}
                placeholder="e.g. 14"
                value={form.day_of_month}
                onChange={e => update('day_of_month', e.target.value)}
              />
            </div>
          </div>

          {/* Category + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-8`}
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Frequency</label>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-8`}
                  value={form.frequency}
                  onChange={e => update('frequency', e.target.value)}
                >
                  {FREQUENCIES.map(f => (
                    <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Month of year — only shown for yearly */}
          {form.frequency === 'yearly' && (
            <div>
              <label className={labelCls}>Month of Year</label>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-8`}
                  value={form.month_of_year}
                  onChange={e => update('month_of_year', e.target.value)}
                >
                  {Object.entries(MONTH_LABELS).map(([num, name]) => (
                    <option key={num} value={num}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Property */}
          <div>
            <label className={labelCls}>Property</label>
            <div className="relative">
              <select
                className={`${inputCls} appearance-none pr-8`}
                value={form.property_id}
                onChange={e => update('property_id', e.target.value)}
              >
                <option value="">Personal (no property)</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <input
              className={inputCls}
              placeholder="Optional"
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            {editing ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onToggle,
  onDelete,
  isDeleting,
  isToggling,
}: {
  template: RecurringTemplate;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isToggling: boolean;
}) {
  const monthly = toMonthlyAmount(template);
  const gradient = CATEGORY_GRADIENTS[template.category] ?? 'from-slate-400 to-slate-500';
  const isYearly = template.frequency === 'yearly';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${!template.is_active ? 'opacity-60' : 'border-slate-200'}`}>
      {/* Color top bar */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <p className={`font-bold text-slate-900 truncate ${!template.is_active ? 'line-through text-slate-500' : ''}`}>
              {template.name}
            </p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-800'}`}>
              {CATEGORY_LABELS[template.category] ?? template.category}
            </span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black text-slate-900">{formatCurrency(template.amount)}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
              {FREQUENCY_LABELS[template.frequency] ?? template.frequency}
            </p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs text-slate-500">
          {template.day_of_month != null && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Day {template.day_of_month}{isYearly && template.month_of_year ? ` of ${MONTH_LABELS[template.month_of_year]}` : ''}
            </span>
          )}
          {isYearly && template.month_of_year && !template.day_of_month && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {MONTH_LABELS[template.month_of_year]}
            </span>
          )}
          {template.property && (
            <span className="flex items-center gap-1">
              <Home size={11} />
              {template.property.name}
            </span>
          )}
          {template.notes && (
            <span className="flex items-center gap-1 truncate max-w-[140px]">
              <Tag size={11} />
              {template.notes}
            </span>
          )}
        </div>

        {/* Monthly equivalent pill */}
        {template.frequency !== 'monthly' && template.frequency !== 'ad_hoc' && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600">
              <DollarSign size={10} />
              {formatCurrency(monthly)}/mo equivalent
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className={`flex-1 text-[10px] font-bold uppercase tracking-wide ${template.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
            {template.is_active ? '● Active' : '○ Paused'}
          </span>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onToggle}
            disabled={isToggling}
            className={`p-1.5 rounded-lg transition-colors ${template.is_active ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-700' : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'} disabled:opacity-40`}
            title={template.is_active ? 'Pause' : 'Resume'}
          >
            {isToggling ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : template.is_active ? (
              <Pause size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
            title="Delete"
          >
            {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplate | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const { data, isLoading, error } = useQuery<RecurringTemplate[]>({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.list(),
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  function openAdd() {
    setEditing(undefined);
    setShowModal(true);
  }

  function openEdit(t: RecurringTemplate) {
    setEditing(t);
    setShowModal(true);
  }

  // Instantly update cache — no waiting for refetch
  function handleSaved(saved: RecurringTemplate, wasEditing: boolean) {
    queryClient.setQueryData<RecurringTemplate[]>(['recurring'], (old) => {
      if (!old) return [saved];
      const exists = old.find(t => t.id === saved.id);
      return exists
        ? old.map(t => t.id === saved.id ? saved : t)
        : [...old, saved];
    });
    toast.success(wasEditing ? 'Template updated' : 'Template created');
  }

  async function handleToggle(template: RecurringTemplate) {
    setTogglingId(template.id);
    try {
      const updated = await recurringApi.update(template.id, { is_active: !template.is_active });
      queryClient.setQueryData<RecurringTemplate[]>(['recurring'], (old) =>
        old?.map(t => t.id === updated.id ? updated : t) ?? []
      );
      toast.success(template.is_active ? 'Template paused' : 'Template resumed');
    } catch {
      toast.error('Failed to update template');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Permanently delete this template? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await recurringApi.delete(id);
      queryClient.setQueryData<RecurringTemplate[]>(['recurring'], (old) =>
        old?.filter(t => t.id !== id) ?? []
      );
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  }

  const templates = data ?? [];
  const activeTemplates = templates.filter(t => t.is_active);
  const totalMonthlyCost = activeTemplates.reduce((s, t) => s + toMonthlyAmount(t), 0);
  const totalYearlyCost = totalMonthlyCost * 12;

  const filtered = templates.filter(t => {
    if (filter === 'active') return t.is_active;
    if (filter === 'paused') return !t.is_active;
    return true;
  });

  return (
    <div className="space-y-5">
      {showModal && (
        <RecurringModal
          properties={properties}
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={(saved) => handleSaved(saved, !!editing)}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your repeating expenses</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Template</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Stats bar */}
      {templates.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeTemplates.length}</p>
            <p className="text-xs text-slate-500">of {templates.length} templates</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly</p>
            <p className="text-lg font-black text-red-600 mt-1">{formatCurrency(totalMonthlyCost)}</p>
            <p className="text-xs text-slate-500">est. cost</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Yearly</p>
            <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(totalYearlyCost)}</p>
            <p className="text-xs text-slate-500">est. cost</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {templates.length > 0 && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(['all', 'active', 'paused'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-600 text-center">
          Failed to load templates. Please refresh.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={24} className="text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700">
            {filter !== 'all' ? `No ${filter} templates` : 'No recurring templates yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1 mb-5">
            {filter !== 'all' ? 'Try switching the filter above' : 'Add your first recurring expense to get started'}
          </p>
          {filter === 'all' && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Plus size={15} /> Add Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openEdit(template)}
              onToggle={() => handleToggle(template)}
              onDelete={() => handleDelete(template.id)}
              isDeleting={deletingId === template.id}
              isToggling={togglingId === template.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
