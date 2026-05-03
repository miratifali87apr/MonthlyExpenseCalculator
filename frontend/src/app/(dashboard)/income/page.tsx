'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { incomeApi, propertiesApi } from '@/lib/api';
import {
  formatCurrency,
  formatDate,
  INCOME_TYPE_LABELS,
  FREQUENCY_LABELS,
} from '@/lib/utils';
import { IncomeItem, Property, IncomeType, Frequency } from '@/types';
import { Plus, X, Download } from 'lucide-react';
import { toast } from 'sonner';

function exportIncomeToCSV(items: IncomeItem[]) {
  const headers = ['Name', 'Type', 'Amount', 'Monthly Equiv.', 'Frequency', 'Property', 'Status', 'Notes'];
  const rows = items.map(item => [
    item.name,
    INCOME_TYPE_LABELS[item.type] ?? item.type,
    item.amount.toFixed(2),
    toMonthlyAmount(item).toFixed(2),
    item.frequency ? (FREQUENCY_LABELS[item.frequency] ?? item.frequency) : 'One-off',
    item.property?.name ?? '',
    item.type === 'reimbursement' ? (item.reimbursement_status ?? 'pending') : item.is_recurring ? 'recurring' : 'one-off',
    item.notes ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `income-${new Date().toISOString().slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function toMonthlyAmount(item: IncomeItem): number {
  if (!item.is_recurring || !item.frequency) return item.amount;
  switch (item.frequency) {
    case 'weekly':      return (item.amount * 52) / 12;
    case 'fortnightly': return (item.amount * 26) / 12;
    case 'monthly':     return item.amount;
    case 'quarterly':   return item.amount / 3;
    default:            return 0;
  }
}

const TYPE_BADGE_MAP: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  salary: 'success', rental: 'info', reimbursement: 'warning', other: 'default',
};

// ─── Add Income Modal ──────────────────────────────────────────────────────────

function AddIncomeModal({ onClose, onSaved, properties }: { onClose: () => void; onSaved: () => void; properties: Property[] }) {
  const [form, setForm] = useState({
    name: '', type: 'rental', amount: '', frequency: 'monthly',
    is_recurring: true, property_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.name.trim() || !form.amount) { setError('Name and amount are required.'); return; }
    setSaving(true); setError('');
    try {
      await incomeApi.create({
        name: form.name.trim(),
        type: form.type as IncomeType,
        amount: parseFloat(form.amount),
        frequency: form.is_recurring ? form.frequency as Frequency : undefined,
        is_recurring: form.is_recurring,
        property_id: form.property_id ? parseInt(form.property_id) : undefined,
        notes: form.notes.trim() || undefined,
        reimbursement_status: form.type === 'reimbursement' ? 'pending' : undefined,
      });
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:pb-4 pb-20 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-slate-900">Add Income</h2>
          <button onClick={onClose} aria-label="Close" className="rounded focus:outline-none focus:ring-2 focus:ring-slate-400"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="e.g. Kirwan Rent" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.type} onChange={e => update('type', e.target.value)}>
                <option value="salary">Salary</option>
                <option value="rental">Rental</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="0.00" value={form.amount} onChange={e => update('amount', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.is_recurring} onChange={e => update('is_recurring', e.target.checked)} />
            <span className="text-sm text-slate-700">Recurring income</span>
          </label>
          {form.is_recurring && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.frequency} onChange={e => update('frequency', e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}
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
          <Button size="sm" loading={saving} onClick={handleSave}>Save Income</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Income Modal ─────────────────────────────────────────────────────────

function EditIncomeModal({ item, onClose, onSaved, properties }: { item: IncomeItem; onClose: () => void; onSaved: () => void; properties: Property[] }) {
  const [form, setForm] = useState({
    name: item.name,
    type: item.type,
    amount: String(item.amount),
    frequency: item.frequency ?? 'monthly',
    is_recurring: item.is_recurring,
    property_id: item.property_id ? String(item.property_id) : '',
    notes: item.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.name.trim() || !form.amount) { setError('Name and amount are required.'); return; }
    setSaving(true); setError('');
    try {
      await incomeApi.update(item.id, {
        name: form.name.trim(),
        type: form.type as IncomeType,
        amount: parseFloat(form.amount),
        frequency: form.is_recurring ? form.frequency as Frequency : undefined,
        is_recurring: form.is_recurring,
        property_id: form.property_id ? parseInt(form.property_id) : undefined,
        notes: form.notes.trim() || undefined,
      });
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:pb-4 pb-20 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-slate-900">Edit Income</h2>
          <button onClick={onClose} aria-label="Close" className="rounded focus:outline-none focus:ring-2 focus:ring-slate-400"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.type} onChange={e => update('type', e.target.value)}>
                <option value="salary">Salary</option>
                <option value="rental">Rental</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.amount} onChange={e => update('amount', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.is_recurring} onChange={e => update('is_recurring', e.target.checked)} />
            <span className="text-sm text-slate-700">Recurring income</span>
          </label>
          {form.is_recurring && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" value={form.frequency} onChange={e => update('frequency', e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<IncomeItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['income'],
    queryFn: () => incomeApi.list({}),
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  const handleMarkReceived = async (id: number) => {
    setActionId(id);
    try {
      await incomeApi.receive(id);
      await queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Marked as received');
    } catch {
      toast.error('Failed to update');
    } finally { setActionId(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this income item?')) return;
    setActionId(id);
    try {
      await incomeApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income deleted');
    } catch {
      toast.error('Failed to delete');
    } finally { setActionId(null); }
  };

  const totalMonthly = data?.reduce((sum: number, item: IncomeItem) => sum + toMonthlyAmount(item), 0) ?? 0;

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddIncomeModal
          properties={properties}
          onClose={() => setShowAdd(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['income'] }); toast.success('Income added'); }}
        />
      )}
      {editItem && (
        <EditIncomeModal
          item={editItem}
          properties={properties}
          onClose={() => setEditItem(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['income'] }); toast.success('Income updated'); }}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Income</h1>
        <div className="flex items-center gap-2">
          {data && data.length > 0 && (
            <button
              onClick={() => exportIncomeToCSV(data)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              title="Export to CSV"
            >
              <Download size={13} /> Export
            </button>
          )}
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={15} className="mr-1" /> Add Income
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} cols={8} />
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load income data.</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-slate-500">No income items yet — tap &quot;Add Income&quot; to get started.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {data.map((item: IncomeItem) => (
                <div key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.property?.name ?? 'Personal'}
                        {item.frequency ? ` · ${FREQUENCY_LABELS[item.frequency] ?? item.frequency}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-green-700">{formatCurrency(item.amount)}</p>
                      <Badge variant={TYPE_BADGE_MAP[item.type] ?? 'default'} className="mt-0.5">
                        {INCOME_TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    {item.type === 'reimbursement' && item.reimbursement_status === 'pending' && (
                      <Button variant="success" size="sm" loading={actionId === item.id} onClick={() => handleMarkReceived(item.id)}>
                        Received
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEditItem(item)}>Edit</Button>
                    <Button variant="danger" size="sm" loading={actionId === item.id} onClick={() => handleDelete(item.id)}>Delete</Button>
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
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Property</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Frequency</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((item: IncomeItem) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={TYPE_BADGE_MAP[item.type] ?? 'default'}>
                          {INCOME_TYPE_LABELS[item.type] ?? item.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{item.property?.name ?? '—'}</td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-900">{formatCurrency(item.amount)}</td>
                      <td className="py-3 pr-4 text-slate-500">
                        {item.frequency ? FREQUENCY_LABELS[item.frequency] ?? item.frequency : '—'}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {formatDate(item.received_date ?? item.expected_date)}
                      </td>
                      <td className="py-3 pr-4">
                        {item.type === 'reimbursement' ? (
                          <Badge variant={item.reimbursement_status === 'received' ? 'success' : 'warning'}>
                            {item.reimbursement_status === 'received' ? 'Received' : 'Pending'}
                          </Badge>
                        ) : item.is_recurring ? (
                          <Badge variant="success">Recurring</Badge>
                        ) : (
                          <Badge variant="default">One-off</Badge>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {item.type === 'reimbursement' && item.reimbursement_status === 'pending' && (
                            <Button variant="success" size="sm" loading={actionId === item.id} onClick={() => handleMarkReceived(item.id)}>
                              Mark Received
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditItem(item)}>Edit</Button>
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
                Est. Monthly Total:{' '}
                <span className="font-semibold text-slate-900">{formatCurrency(totalMonthly)}</span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
