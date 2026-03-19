'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { recurringApi, propertiesApi } from '@/lib/api';
import {
  formatCurrency,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  FREQUENCY_LABELS,
  CATEGORIES,
} from '@/lib/utils';
import { RecurringTemplate, Property, Category, Frequency } from '@/types';
import { Plus, X } from 'lucide-react';

function toMonthlyAmount(template: RecurringTemplate): number {
  switch (template.frequency) {
    case 'weekly':      return (template.amount * 52) / 12;
    case 'fortnightly': return (template.amount * 26) / 12;
    case 'monthly':     return template.amount;
    case 'quarterly':   return template.amount / 3;
    default:            return 0;
  }
}

// ─── Add Recurring Modal ───────────────────────────────────────────────────────

function AddRecurringModal({ onClose, onSaved, properties }: { onClose: () => void; onSaved: () => void; properties: Property[] }) {
  const [form, setForm] = useState({
    name: '', category: 'loan', amount: '', frequency: 'monthly',
    day_of_month: '', property_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.name.trim() || !form.amount) { setError('Name and amount are required.'); return; }
    setSaving(true); setError('');
    try {
      await recurringApi.create({
        name: form.name.trim(),
        category: form.category as Category,
        amount: parseFloat(form.amount),
        frequency: form.frequency as Frequency,
        day_of_month: form.day_of_month ? parseInt(form.day_of_month) : undefined,
        property_id: form.property_id ? parseInt(form.property_id) : undefined,
        notes: form.notes.trim() || undefined,
        is_active: true,
      });
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Add Recurring Template</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="e.g. Kirwan Home Loan" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="0.00" value={form.amount} onChange={e => update('amount', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Day of Month</label>
              <input type="number" min="1" max="31" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="e.g. 14" value={form.day_of_month} onChange={e => update('day_of_month', e.target.value)} />
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.frequency} onChange={e => update('frequency', e.target.value)}>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          <Button size="sm" loading={saving} onClick={handleSave}>Save Template</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, error } = useQuery<RecurringTemplate[]>({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.list(),
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this recurring template?')) return;
    setDeletingId(id);
    try {
      await recurringApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['recurring'] });
    } finally { setDeletingId(null); }
  };

  const activeTemplates = data?.filter((t) => t.is_active) ?? [];
  const totalMonthlyCost = activeTemplates.reduce((sum, t) => sum + toMonthlyAmount(t), 0);

  return (
    <div className="p-6 space-y-6">
      {showAdd && (
        <AddRecurringModal
          properties={properties}
          onClose={() => setShowAdd(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['recurring'] })}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Recurring Templates</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1" /> Add Recurring
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <PageSpinner />
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load recurring templates.</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-slate-500">No recurring templates yet — tap &quot;Add Recurring&quot; to get started.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {data.map((template: RecurringTemplate) => (
                <div key={template.id} className="py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm truncate">{template.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {template.property?.name ?? 'Personal'} · {FREQUENCY_LABELS[template.frequency] ?? template.frequency}
                        {template.day_of_month != null ? ` · Day ${template.day_of_month}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-900">{formatCurrency(template.amount)}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-800'}`}>
                        {CATEGORY_LABELS[template.category] ?? template.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={template.is_active ? 'success' : 'default'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="danger" size="sm" loading={deletingId === template.id} onClick={() => handleDelete(template.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Property</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Frequency</th>
                    <th className="pb-3 pr-4 font-medium">Due Day</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((template: RecurringTemplate) => (
                    <tr key={template.id}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{template.name}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-800'}`}>
                          {CATEGORY_LABELS[template.category] ?? template.category}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{template.property?.name ?? '—'}</td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-900">{formatCurrency(template.amount)}</td>
                      <td className="py-3 pr-4 text-slate-600">{FREQUENCY_LABELS[template.frequency] ?? template.frequency}</td>
                      <td className="py-3 pr-4 text-slate-600">{template.day_of_month != null ? `Day ${template.day_of_month}` : '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={template.is_active ? 'success' : 'default'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button variant="danger" size="sm" loading={deletingId === template.id} onClick={() => handleDelete(template.id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
              <p className="text-xs text-slate-400">{activeTemplates.length} active of {data.length} total templates</p>
              <div className="text-sm text-slate-500">
                Est. Monthly Cost (active): <span className="font-semibold text-slate-900">{formatCurrency(totalMonthlyCost)}</span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
