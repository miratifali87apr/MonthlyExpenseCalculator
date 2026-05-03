'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import dayjs from 'dayjs';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { propertiesApi, expensesApi, incomeApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { formatCurrency, CATEGORY_LABELS } from '@/lib/utils';
import type { ExpenseItem, IncomeItem } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const PM_CATEGORIES = ['pm_fees', 'maintenance', 'letting_fee'];
const FIXED_CATEGORIES = ['loan', 'insurance', 'council_rates', 'utility', 'other'];

type NewExpense = { name: string; category: string; amount: string; notes: string };
type NewIncome = { name: string; amount: string; notes: string };

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const propId = Number(id);

  const today = dayjs();
  const [month, setMonth] = useState(today.month() + 1);
  const [year, setYear] = useState(today.year());

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExp, setNewExp] = useState<NewExpense>({ name: '', category: 'pm_fees', amount: '', notes: '' });
  const [newInc, setNewInc] = useState<NewIncome>({ name: 'Rent Received', amount: '', notes: '' });

  // AI Statement Parsing
  type MaintenanceRow = { description: string; amount: number };
  interface ParsedStatement {
    property_address: string | null;
    period: { month: string; year: string } | null;
    gross_rent: number | null;
    management_fee: number | null;
    letting_fee: number | null;
    maintenance_items: MaintenanceRow[];
    total_expenses: number | null;
    net_to_owner: number | null;
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [parsedStatement, setParsedStatement] = useState<ParsedStatement | null>(null);
  // Editable extracted fields
  const [editedGrossRent, setEditedGrossRent] = useState('');
  const [editedMgmtFee, setEditedMgmtFee] = useState('');
  const [editedLettingFee, setEditedLettingFee] = useState('');
  const [editedMaintenance, setEditedMaintenance] = useState<MaintenanceRow[]>([]);
  const [aiSaving, setAiSaving] = useState(false);

  const { data: property, isLoading: propLoading } = useQuery({
    queryKey: ['property', propId],
    queryFn: () => propertiesApi.list().then(list => list.find(p => p.id === propId)),
  });

  const { data: expenses = [], isLoading: expLoading } = useQuery({
    queryKey: ['expenses', month, year, propId],
    queryFn: () => expensesApi.list({ month, year, property_id: propId }),
  });

  const { data: income = [], isLoading: incLoading } = useQuery({
    queryKey: ['income', month, year, propId],
    queryFn: () => incomeApi.list({ month, year, property_id: propId }),
  });

  const isLoading = propLoading || expLoading || incLoading;

  // Group expenses
  const pmExpenses = expenses.filter((e: ExpenseItem) => PM_CATEGORIES.includes(e.category));
  const fixedExpenses = expenses.filter((e: ExpenseItem) => FIXED_CATEGORIES.includes(e.category));

  // Income: rental and reimbursements
  const rentItems = income.filter((i: IncomeItem) => i.type === 'rental');
  const reimbItems = income.filter((i: IncomeItem) => i.type === 'reimbursement');

  const grossRent = rentItems.reduce((s, i) => s + Number(i.amount), 0);
  const totalPMExpenses = pmExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netToOwner = grossRent - totalPMExpenses;
  const totalFixed = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCashflow = netToOwner - totalFixed;

  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  async function saveExpense() {
    if (!newExp.name || !newExp.amount) return;
    setSaving(true);
    try {
      const due = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).toISOString();
      await expensesApi.create({
        name: newExp.name,
        category: newExp.category as any,
        amount: Number(newExp.amount),
        due_date: due,
        property_id: propId,
        notes: newExp.notes || undefined,
        is_recurring: false,
      });
      await queryClient.invalidateQueries({ queryKey: ['expenses', month, year, propId] });
      setNewExp({ name: '', category: 'pm_fees', amount: '', notes: '' });
      setShowExpenseForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveIncome() {
    if (!newInc.amount) return;
    setSaving(true);
    try {
      const expectedDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).toISOString();
      await incomeApi.create({
        name: newInc.name,
        type: 'rental',
        amount: Number(newInc.amount),
        property_id: propId,
        expected_date: expectedDate,
        received_date: expectedDate,
        notes: newInc.notes || undefined,
        is_recurring: false,
      });
      await queryClient.invalidateQueries({ queryKey: ['income', month, year, propId] });
      setNewInc({ name: 'Rent Received', amount: '', notes: '' });
      setShowIncomeForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expId: number) {
    await expensesApi.delete(expId);
    queryClient.invalidateQueries({ queryKey: ['expenses', month, year, propId] });
  }

  async function parseStatementWithAI() {
    if (!selectedFile) return;
    setAiParsing(true);
    setAiError(null);
    setParsedStatement(null);

    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.type === 'application/pdf';
    // Use free text-extraction endpoint for PDFs; fall back to AI vision for images
    const endpoint = isPdf ? '/api/ai/parse-statement-text' : '/api/ai/parse-statement';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.detail ?? `HTTP ${res.status}`;
        // If text extraction failed (e.g. scanned PDF), tell user to try image upload
        throw new Error(detail);
      }
      const data = await res.json();
      setParsedStatement(data);
      setEditedGrossRent(String(data.gross_rent ?? ''));
      setEditedMgmtFee(String(data.management_fee ?? ''));
      setEditedLettingFee(String(data.letting_fee ?? ''));
      setEditedMaintenance(data.maintenance_items ?? []);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAiParsing(false);
    }
  }

  async function saveAIExtractedData() {
    if (!parsedStatement) return;
    setAiSaving(true);
    try {
      const due = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).toISOString();

      // Save gross rent as income
      if (editedGrossRent && Number(editedGrossRent) > 0) {
        await incomeApi.create({
          name: 'Rent Received (Statement Import)',
          type: 'rental',
          amount: Number(editedGrossRent),
          property_id: propId,
          expected_date: due,
          received_date: due,
          is_recurring: false,
        });
      }

      // Save management fee
      if (editedMgmtFee && Number(editedMgmtFee) > 0) {
        await expensesApi.create({
          name: 'Management Fee (Statement Import)',
          category: 'pm_fees' as never,
          amount: Number(editedMgmtFee),
          due_date: due,
          property_id: propId,
          is_recurring: false,
        });
      }

      // Save letting fee
      if (editedLettingFee && Number(editedLettingFee) > 0) {
        await expensesApi.create({
          name: 'Letting Fee (Statement Import)',
          category: 'letting_fee' as never,
          amount: Number(editedLettingFee),
          due_date: due,
          property_id: propId,
          is_recurring: false,
        });
      }

      // Save maintenance items
      for (const item of editedMaintenance) {
        if (item.amount > 0) {
          await expensesApi.create({
            name: item.description || 'Maintenance (Statement Import)',
            category: 'maintenance' as never,
            amount: item.amount,
            due_date: due,
            property_id: propId,
            is_recurring: false,
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['expenses', month, year, propId] });
      await queryClient.invalidateQueries({ queryKey: ['income', month, year, propId] });

      // Reset
      setParsedStatement(null);
      setSelectedFile(null);
      setAiError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setAiSaving(false);
    }
  }

  if (isLoading) return <PageSpinner />;
  if (!property) return <div className="p-4 text-red-600">Property not found.</div>;

  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/properties')} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900 text-base leading-tight truncate">{property.name}</h2>
          {property.address && <p className="text-xs text-slate-500 truncate">{property.address}</p>}
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
        <button onClick={prevMonth} className="text-slate-500 hover:text-slate-900 px-2 py-1 rounded">‹</button>
        <span className="font-semibold text-slate-900">{monthLabel}</span>
        <button onClick={nextMonth} className="text-slate-500 hover:text-slate-900 px-2 py-1 rounded">›</button>
      </div>

      {/* PM Statement */}
      <Card title="Property Management Statement">
        {/* AI Upload Section */}
        <div className="mb-5 pb-5 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Upload PM Statement (PDF or screenshot)
          </p>
          <p className="text-xs text-slate-400 mb-2">PDF files are parsed automatically — no AI needed. For scanned images, upload a JPG/PNG.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                Choose File (PDF, JPG or PNG)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  setParsedStatement(null);
                  setAiError(null);
                }}
              />
            </label>
            <span className="text-xs text-slate-500 truncate max-w-[160px]">
              {selectedFile ? selectedFile.name : 'No file chosen'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={parseStatementWithAI}
              loading={aiParsing}
              disabled={!selectedFile || aiParsing}
            >
              Extract Data
            </Button>
          </div>

          {aiParsing && (
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
              <span className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-slate-700 rounded-full shrink-0" />
              Reading your statement…
            </div>
          )}

          {aiError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {aiError}
            </div>
          )}

          {parsedStatement && !aiParsing && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                Extracted data — review and save:
              </p>

              <div className="space-y-2">
                {/* Gross Rent */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 w-36 shrink-0">Gross Rent</label>
                  <input
                    type="number"
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editedGrossRent}
                    onChange={(e) => setEditedGrossRent(e.target.value)}
                  />
                </div>

                {/* Management Fee */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 w-36 shrink-0">Management Fee</label>
                  <input
                    type="number"
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editedMgmtFee}
                    onChange={(e) => setEditedMgmtFee(e.target.value)}
                  />
                </div>

                {/* Letting Fee */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 w-36 shrink-0">Letting Fee</label>
                  <input
                    type="number"
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editedLettingFee}
                    onChange={(e) => setEditedLettingFee(e.target.value)}
                  />
                </div>

                {/* Maintenance items */}
                {editedMaintenance.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1 font-medium">Maintenance Items</p>
                    {editedMaintenance.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 mb-1.5">
                        <input
                          type="text"
                          className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={item.description}
                          onChange={(e) => {
                            const next = [...editedMaintenance];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setEditedMaintenance(next);
                          }}
                        />
                        <input
                          type="number"
                          className="w-full sm:w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={item.amount}
                          onChange={(e) => {
                            const next = [...editedMaintenance];
                            next[idx] = { ...next[idx], amount: Number(e.target.value) };
                            setEditedMaintenance(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="success" onClick={saveAIExtractedData} loading={aiSaving}>
                  Save All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setParsedStatement(null);
                    setSelectedFile(null);
                    setAiError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* INCOME */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Income</h4>
            <button onClick={() => setShowIncomeForm(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <Plus size={12} /> Add Rent
            </button>
          </div>

          {showIncomeForm && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg space-y-2">
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Label (e.g. Rent Received)" value={newInc.name}
                onChange={e => setNewInc(v => ({ ...v, name: e.target.value }))} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Amount" type="number" value={newInc.amount}
                onChange={e => setNewInc(v => ({ ...v, amount: e.target.value }))} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Notes (optional)" value={newInc.notes}
                onChange={e => setNewInc(v => ({ ...v, notes: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveIncome} loading={saving}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowIncomeForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {rentItems.length === 0 && !showIncomeForm && (
            <p className="text-sm text-slate-400 italic">No rent recorded for this month.</p>
          )}
          {rentItems.map((i: IncomeItem) => (
            <div key={i.id} className="flex justify-between py-1.5 text-sm border-b border-slate-100 last:border-0">
              <span className="text-slate-700">{i.name}</span>
              <span className="font-medium text-green-700">{formatCurrency(Number(i.amount))}</span>
            </div>
          ))}
          {grossRent > 0 && (
            <div className="flex justify-between py-1.5 text-sm font-semibold text-slate-900 mt-1">
              <span>Gross Rent</span>
              <span className="text-green-700">{formatCurrency(grossRent)}</span>
            </div>
          )}
        </div>

        {/* PM EXPENSES */}
        <div className="mb-4 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PM Expenses</h4>
            <button onClick={() => setShowExpenseForm(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <Plus size={12} /> Add
            </button>
          </div>

          {showExpenseForm && (
            <div className="mb-3 p-3 bg-amber-50 rounded-lg space-y-2">
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={newExp.category} onChange={e => setNewExp(v => ({ ...v, category: e.target.value }))}>
                <option value="pm_fees">PM Management Fee</option>
                <option value="maintenance">Maintenance / Repair</option>
                <option value="letting_fee">Letting Fee</option>
              </select>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Description" value={newExp.name}
                onChange={e => setNewExp(v => ({ ...v, name: e.target.value }))} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Amount" type="number" value={newExp.amount}
                onChange={e => setNewExp(v => ({ ...v, amount: e.target.value }))} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Notes (optional)" value={newExp.notes}
                onChange={e => setNewExp(v => ({ ...v, notes: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveExpense} loading={saving}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {pmExpenses.length === 0 && !showExpenseForm && (
            <p className="text-sm text-slate-400 italic">No PM expenses recorded.</p>
          )}
          {pmExpenses.map((e: ExpenseItem) => (
            <div key={e.id} className="flex justify-between items-center py-1.5 text-sm border-b border-slate-100 last:border-0 group">
              <div className="min-w-0 flex-1">
                <span className="text-slate-700">{e.name}</span>
                <span className="ml-2 text-xs text-slate-400">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                {e.notes && <p className="text-xs text-slate-400 truncate">{e.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-red-700">({formatCurrency(Number(e.amount))})</span>
                <button onClick={() => deleteExpense(e.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          {totalPMExpenses > 0 && (
            <div className="flex justify-between py-1.5 text-sm font-semibold text-slate-900 mt-1">
              <span>Total PM Expenses</span>
              <span className="text-red-700">({formatCurrency(totalPMExpenses)})</span>
            </div>
          )}
        </div>

        {/* NET TO OWNER */}
        {(grossRent > 0 || totalPMExpenses > 0) && (
          <div className={`pt-3 border-t-2 border-slate-300 flex justify-between items-center`}>
            <span className="font-bold text-slate-900">Net to Owner</span>
            <span className={`text-xl font-bold ${netToOwner >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(netToOwner)}
            </span>
          </div>
        )}
      </Card>

      {/* Fixed Costs */}
      <Card title="Fixed Costs This Month">
        {fixedExpenses.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No fixed expenses recorded for this month.</p>
        ) : (
          <>
            {fixedExpenses.map((e: ExpenseItem) => (
              <div key={e.id} className="flex justify-between py-1.5 text-sm border-b border-slate-100 last:border-0">
                <div>
                  <span className="text-slate-700">{e.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                </div>
                <span className="font-medium text-red-700">({formatCurrency(Number(e.amount))})</span>
              </div>
            ))}
            <div className="flex justify-between py-1.5 text-sm font-semibold mt-1">
              <span>Total Fixed</span>
              <span className="text-red-700">({formatCurrency(totalFixed)})</span>
            </div>
          </>
        )}
      </Card>

      {/* Full Cashflow Summary */}
      <div className={`rounded-xl p-4 border-2 ${totalCashflow >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Monthly Cashflow Summary</p>
        <div className="space-y-1 text-sm mb-3">
          <div className="flex justify-between">
            <span className="text-slate-600">Gross Rent</span>
            <span className="font-medium text-green-700">{formatCurrency(grossRent)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Less PM Expenses</span>
            <span className="font-medium text-red-700">({formatCurrency(totalPMExpenses)})</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1">
            <span className="text-slate-600">Net to Owner</span>
            <span className={`font-medium ${netToOwner >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(netToOwner)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Less Fixed Costs</span>
            <span className="font-medium text-red-700">({formatCurrency(totalFixed)})</span>
          </div>
        </div>
        <div className="flex justify-between items-center border-t-2 border-current pt-2">
          <span className="font-bold text-slate-900">Total Cashflow</span>
          <span className={`text-2xl font-bold ${totalCashflow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(totalCashflow)}
          </span>
        </div>
      </div>

      {/* Reimbursements */}
      {reimbItems.length > 0 && (
        <Card title="Reimbursements">
          {reimbItems.map((i: IncomeItem) => (
            <div key={i.id} className="flex justify-between py-1.5 text-sm border-b border-slate-100 last:border-0">
              <span className="text-slate-700">{i.name}</span>
              <span className="font-medium text-amber-700">{formatCurrency(Number(i.amount))}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
