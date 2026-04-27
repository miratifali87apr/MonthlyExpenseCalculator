'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PageSpinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { propertiesApi, recurringApi } from '@/lib/api';
import { formatCurrency, CATEGORY_LABELS } from '@/lib/utils';
import type { Property, RecurringTemplate } from '@/types';
import { ChevronRight, Droplets, Home as HomeIcon, Plus, X, Upload } from 'lucide-react';

function monthlyFromFreq(amount: number, freq: string): number {
  if (freq === 'weekly')      return amount * 52 / 12;
  if (freq === 'fortnightly') return amount * 26 / 12;
  if (freq === 'quarterly')   return amount / 3;
  return amount;
}

function SummaryRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div>
        <span className="text-slate-600">{label}</span>
        {sub && <span className="ml-1.5 text-xs text-slate-400">{sub}</span>}
      </div>
      <span className={`font-semibold tabular-nums ${color ?? 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 border-t border-slate-200" />
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

function PropertyCard({
  property,
  templates,
  onClick,
  onDelete,
}: {
  property: Property;
  templates: RecurringTemplate[];
  onClick: () => void;
  onDelete: () => void;
}) {
  const propTemplates = templates.filter(t => t.property_id === property.id && t.is_active);
  const weeklyRent = property.weekly_rent ?? 0;
  const pmFeePct = property.pm_fee_pct ?? 0;
  const grossMonthlyRent = Math.round(weeklyRent * 52 / 12 * 100) / 100;
  const estPMFees = Math.round(grossMonthlyRent * pmFeePct * 100) / 100;
  const netToOwner = grossMonthlyRent - estPMFees;
  const hasTenant = weeklyRent > 0;

  const fixedCosts = propTemplates.map(t => ({
    label: t.name,
    category: t.category,
    monthly: Math.round(monthlyFromFreq(Number(t.amount), t.frequency) * 100) / 100,
  }));
  const totalFixed = fixedCosts.reduce((s, c) => s + c.monthly, 0);
  const outOfPocket = totalFixed - netToOwner;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={onClick} className="w-full text-left px-4 pt-4 pb-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
              <HomeIcon size={18} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900">{property.name}</p>
              {property.address && <p className="text-xs text-slate-500 truncate">{property.address}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {property.tenant_liable_for_water && (
              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <Droplets size={11} /> Tenant pays water
              </span>
            )}
            <ChevronRight size={16} className="text-slate-400" />
          </div>
        </div>
      </button>

      <div className="px-4 pb-4 border-t border-slate-100">
        {hasTenant ? (
          <>
            <Divider label="Rental Income" />
            <SummaryRow label="Gross Rent" sub={`$${weeklyRent}/wk × 52÷12`} value={formatCurrency(grossMonthlyRent)} color="text-green-700" />
            <SummaryRow label="Est. PM Fees" sub={`~${Math.round(pmFeePct * 100)}%`} value={`(${formatCurrency(estPMFees)})`} color="text-red-600" />
            <div className="flex items-center justify-between py-1.5 text-sm border-t border-slate-200 mt-1">
              <span className="font-semibold text-slate-700">Est. Net to Owner</span>
              <span className="font-bold text-green-700">{formatCurrency(netToOwner)}</span>
            </div>
          </>
        ) : (
          <>
            <Divider label="Rental Income" />
            <p className="text-sm text-slate-400 italic py-1">No tenant — no rental income</p>
          </>
        )}

        <Divider label="Fixed Costs (Monthly)" />
        {fixedCosts.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-1">No recurring expenses set up.</p>
        ) : (
          fixedCosts.map((c, i) => (
            <SummaryRow key={i} label={c.label} sub={CATEGORY_LABELS[c.category]} value={`(${formatCurrency(c.monthly)})`} color="text-red-600" />
          ))
        )}
        {fixedCosts.length > 0 && (
          <div className="flex items-center justify-between py-1.5 text-sm border-t border-slate-200 mt-1">
            <span className="font-semibold text-slate-700">Total Fixed</span>
            <span className="font-bold text-red-700">({formatCurrency(totalFixed)})</span>
          </div>
        )}

        <div className={`mt-3 rounded-xl px-4 py-3 ${outOfPocket > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {outOfPocket > 0 ? 'Out of Pocket / Month' : 'Surplus / Month'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{hasTenant ? 'Fixed costs minus net to owner' : 'No rental income'}</p>
            </div>
            <p className={`text-2xl font-bold ${outOfPocket > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {outOfPocket > 0 ? `(${formatCurrency(outOfPocket)})` : formatCurrency(-outOfPocket)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 gap-2">
          <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            <Upload size={12} /> Upload PM Statement
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-2"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Property Modal ───────────────────────────────────────────────────────

function AddPropertyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [propertyType, setPropertyType] = useState<'investment' | 'ppr'>('investment');
  const [form, setForm] = useState({
    name: '',
    address: '',
    tenant_liable_for_water: false,
    weekly_rent: '',
    pm_fee_pct: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isInvestment = propertyType === 'investment';

  function update(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Property name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await propertiesApi.create({
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        tenant_liable_for_water: isInvestment ? form.tenant_liable_for_water : false,
        weekly_rent: isInvestment ? (parseFloat(form.weekly_rent) || 0) : 0,
        pm_fee_pct: isInvestment ? (parseFloat(form.pm_fee_pct) / 100 || 0) : 0,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save property.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-slate-900">Add Property</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Property type toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Property Type</label>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {(['investment', 'ppr'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPropertyType(type)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                    propertyType === type
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {type === 'investment' ? 'Investment Property' : 'Owner-Occupied (PPOR)'}
                </button>
              ))}
            </div>
            {!isInvestment && (
              <p className="text-xs text-slate-400 mt-1.5">
                PPOR properties have no rental income or PM fees.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Property Name *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. Kirwan"
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. 12 Main St, Kirwan QLD 4817"
              value={form.address}
              onChange={e => update('address', e.target.value)}
            />
          </div>

          {isInvestment && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Weekly Rent ($)</label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="e.g. 550"
                  value={form.weekly_rent}
                  onChange={e => update('weekly_rent', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">PM Management Fee %</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="e.g. 7.5"
                  value={form.pm_fee_pct}
                  onChange={e => update('pm_fee_pct', e.target.value)}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer bg-slate-50 rounded-lg px-3 py-2.5">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 w-4 h-4"
                  checked={form.tenant_liable_for_water}
                  onChange={e => update('tenant_liable_for_water', e.target.checked)}
                />
                <span className="text-sm text-slate-700">Tenant pays water</span>
              </label>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer — always visible */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>Save Property</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: properties, isLoading: propsLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<RecurringTemplate[]>({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.list(),
  });

  if (propsLoading || templatesLoading) return <PageSpinner />;

  const totalOutOfPocket = (properties ?? []).reduce((sum, prop) => {
    const propTemplates = templates.filter(t => t.property_id === prop.id && t.is_active);
    const weeklyRent = prop.weekly_rent ?? 0;
    const gross = weeklyRent * 52 / 12;
    const pmFees = gross * (prop.pm_fee_pct ?? 0);
    const netToOwner = gross - pmFees;
    const fixed = propTemplates.reduce((s, t) => s + monthlyFromFreq(Number(t.amount), t.frequency), 0);
    return sum + (fixed - netToOwner);
  }, 0);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete property "${name}"? This cannot be undone.`)) return;
    await propertiesApi.delete(id);
    queryClient.invalidateQueries({ queryKey: ['properties'] });
  }

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddPropertyModal
          onClose={() => setShowAdd(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['properties'] })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Properties</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1" /> Add Property
        </Button>
      </div>

      {/* Portfolio summary banner */}
      <div className="bg-slate-900 rounded-xl px-4 py-4 text-white">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">Portfolio — Est. Monthly</p>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Properties: {(properties ?? []).length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Tenanted: {(properties ?? []).filter(p => (p.weekly_rent ?? 0) > 0).length}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400">Est. out of pocket</p>
            <p className={`text-xl font-bold ${totalOutOfPocket > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {totalOutOfPocket > 0 ? `(${formatCurrency(totalOutOfPocket)})` : formatCurrency(-totalOutOfPocket)}
            </p>
          </div>
        </div>
      </div>

      {(!properties || properties.length === 0) ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400 text-sm">
          No properties yet — tap &quot;Add Property&quot; to get started.
        </div>
      ) : (
        properties.map(property => (
          <PropertyCard
            key={property.id}
            property={property}
            templates={templates}
            onClick={() => router.push(`/properties/${property.id}`)}
            onDelete={() => handleDelete(property.id, property.name)}
          />
        ))
      )}
    </div>
  );
}
