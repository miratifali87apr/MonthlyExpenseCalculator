'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { PageSpinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { propertiesApi, recurringApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Property, RecurringTemplate } from '@/types';
import {
  MapPin, Building2, Receipt, TrendingUp, Sparkles,
  AlertTriangle, ChevronDown, BarChart3, Calculator, Landmark,
} from 'lucide-react';
import {
  calcStampDuty, calcLandTax, calcLMI, getMarginalRate, getMarginalRateLabel, landTaxThresholdLabel,
} from '@/lib/taxCalcs';
import type { OwnershipStructure, AusState } from '@/lib/taxCalcs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const WEEKLY_RENT_MAP: Record<string, number> = {
  Finley: 530,
  Kirwan: 600,
  Chigwell: 580,
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyRanking {
  name: string;
  rating: 'strong' | 'moderate' | 'weak';
  reason: string;
}

interface PortfolioAnalysis {
  portfolio_score: number;
  insights: string[];
  recommendations: string[];
  property_rankings: PropertyRanking[];
}

interface PurchaseResult {
  monthly_cashflow: number;
  annual_yield: number;
  recommendation: 'buy' | 'consider' | 'avoid';
  confidence: number;
  pros: string[];
  cons: string[];
  ai_summary: string;
}

type Tab = 'portfolio' | 'predictor' | 'holding';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

function scoreColor(score: number): string {
  if (score > 70) return 'text-green-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score > 70) return 'bg-green-50 border-green-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function ratingVariant(rating: 'strong' | 'moderate' | 'weak'): 'success' | 'warning' | 'danger' {
  if (rating === 'strong') return 'success';
  if (rating === 'moderate') return 'warning';
  return 'danger';
}

function recommendationVariant(rec: 'buy' | 'consider' | 'avoid'): 'success' | 'warning' | 'danger' {
  if (rec === 'buy') return 'success';
  if (rec === 'consider') return 'warning';
  return 'danger';
}

function oopColor(oop: number): string {
  if (oop > 1000) return 'border-red-200 bg-red-50';
  if (oop >= 500) return 'border-amber-200 bg-amber-50';
  return 'border-green-200 bg-green-50';
}

function oopTextColor(oop: number): string {
  if (oop > 1000) return 'text-red-700';
  if (oop >= 500) return 'text-amber-700';
  return 'text-green-700';
}

// ─── Tab: Portfolio AI ────────────────────────────────────────────────────────

function PortfolioTab({ properties }: { properties: Property[] }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const payload = {
        properties: properties.map((p) => ({
          name: p.name,
          address: p.address ?? '',
          purchase_price: p.purchase_price ?? null,
          loan_amount: p.loan_amount ?? null,
        })),
        holding_costs: [],
        rental_income: Object.entries(WEEKLY_RENT_MAP).map(([name, weekly]) => ({
          property: name,
          weekly_rent: weekly,
          annual_income: weekly * 52,
        })),
      };

      const res = await fetch(`${API_URL}/api/ai/analyze-portfolio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }

      const data: PortfolioAnalysis = await res.json();
      setAnalysis(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          AI-powered analysis of your entire property portfolio.
        </p>
        <Button onClick={runAnalysis} loading={loading} size="md">
          Generate AI Analysis
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12 text-slate-500 text-sm">
          <span className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full" />
          Claude is analysing your portfolio…
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-4">
          {/* Score */}
          <div className={`rounded-xl border-2 p-6 text-center ${scoreBg(analysis.portfolio_score)}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Portfolio Score
            </p>
            <p className={`text-7xl font-bold ${scoreColor(analysis.portfolio_score)}`}>
              {analysis.portfolio_score}
            </p>
            <p className="text-sm text-slate-500 mt-1">out of 100</p>
          </div>

          {/* Insights */}
          <Card title="Insights">
            <ul className="space-y-2">
              {analysis.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="shrink-0 mt-0.5">💡</span>
                  {insight}
                </li>
              ))}
            </ul>
          </Card>

          {/* Recommendations */}
          <Card title="Recommendations">
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="shrink-0 mt-0.5 text-slate-400">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </Card>

          {/* Property Rankings */}
          <Card title="Property Rankings">
            <div className="space-y-3">
              {analysis.property_rankings.map((prop, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm">{prop.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{prop.reason}</p>
                  </div>
                  <Badge variant={ratingVariant(prop.rating)} className="shrink-0 capitalize">
                    {prop.rating}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400 text-sm">
          Click &quot;Generate AI Analysis&quot; to get your portfolio insights.
        </div>
      )}
    </div>
  );
}

// ─── Tab: Purchase Predictor ──────────────────────────────────────────────────


function PredictorTab() {
  const [form, setForm] = useState({
    location: '',
    purchase_price: '',
    deposit: '20',
    interest_rate: '6.5',
    weekly_rent: '',
    property_type: 'House',
  });
  const [state, setState] = useState<AusState>('QLD');
  const [structure, setStructure] = useState<OwnershipStructure>('individual');
  const [annualSalary, setAnnualSalary] = useState('');
  const [beneficiaries, setBeneficiaries] = useState('1');
  const [councilRates, setCouncilRates] = useState('2000');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTax, setShowTax] = useState(true);
  const [showCosts, setShowCosts] = useState(true);

  const purchasePrice = parseFloat(form.purchase_price) || 0;
  const deposit = parseFloat(form.deposit) || 20;
  const interestRate = parseFloat(form.interest_rate) || 6.5;
  const weeklyRent = parseFloat(form.weekly_rent) || 0;
  const salary = parseFloat(annualSalary) || 0;
  const numBeneficiaries = parseInt(beneficiaries) || 1;
  const annualCouncilRates = parseFloat(councilRates) || 0;

  const lvr = 100 - deposit;
  const loanAmount = purchasePrice * (1 - deposit / 100);
  const monthlyRate = interestRate / 100 / 12;
  const monthlyRepayment =
    loanAmount > 0 && monthlyRate > 0
      ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -360))
      : 0;
  const monthlyRent = (weeklyRent * 52) / 12;
  const grossYield = purchasePrice > 0 ? (weeklyRent * 52) / purchasePrice * 100 : 0;
  const monthlyCashflow = monthlyRent - monthlyRepayment;

  // Acquisition costs
  const lmi = calcLMI(loanAmount, lvr);
  const stampDuty = purchasePrice > 0 ? calcStampDuty(purchasePrice, state) : 0;
  const conveyancing = purchasePrice * 0.002;
  const totalAcquisitionCosts = stampDuty + lmi + conveyancing;
  const totalCashRequired = purchasePrice * (deposit / 100) + totalAcquisitionCosts;

  // Ongoing costs & tax calcs
  const estimatedLandValue = purchasePrice * 0.3;
  const annualLandTax = calcLandTax(estimatedLandValue, structure, state);
  const annualInterest = loanAmount * (interestRate / 100);
  const annualRental = weeklyRent * 52;
  const annualMgmtFees = annualRental * 0.08;
  const annualDeductibles = annualInterest + annualMgmtFees + annualCouncilRates + annualLandTax;
  const netRentalForTax = annualRental - annualDeductibles;

  let monthlyTaxBenefit = 0;
  let taxRate = 0;
  let taxNote = '';
  let taxRateLabel = '';

  if (structure === 'individual') {
    taxRate = getMarginalRate(salary);
    taxRateLabel = salary > 0 ? getMarginalRateLabel(salary) : 'Enter salary to calculate';
    if (salary > 0) {
      if (netRentalForTax < 0) {
        monthlyTaxBenefit = (Math.abs(netRentalForTax) * taxRate) / 12;
        taxNote = `Negative gearing saves ${formatCurrency(Math.abs(netRentalForTax) * taxRate)}/yr at ${(taxRate * 100).toFixed(0)}% marginal rate`;
      } else {
        monthlyTaxBenefit = -(netRentalForTax * taxRate) / 12;
        taxNote = `Net rental income ${formatCurrency(netRentalForTax)}/yr taxed at ${(taxRate * 100).toFixed(0)}% marginal rate`;
      }
    }
  } else if (structure === 'trust') {
    taxRate = 0;
    taxRateLabel = 'No tax benefit at trust level';
    monthlyTaxBenefit = 0;
    if (netRentalForTax < 0) {
      taxNote = 'Trust losses cannot be distributed to beneficiaries — carried forward internally. No negative gearing benefit.';
    } else {
      taxNote = 'Trust distributes net income to beneficiaries who pay tax at their own marginal rates. No tax benefit is modelled here — consult your accountant for distribution planning.';
    }
  } else if (structure === 'company') {
    taxRate = 0.25;
    taxRateLabel = '25% — Base Rate Entity (Pty Ltd)';
    if (netRentalForTax < 0) {
      monthlyTaxBenefit = 0;
      taxNote = 'Company losses carried forward — no immediate benefit. No CGT 50% discount on sale. Consider trust structure.';
    } else {
      monthlyTaxBenefit = -(netRentalForTax * 0.25) / 12;
      taxNote = 'Profits taxed at 25%. Dividends can be franked. No CGT 50% discount on property sale.';
    }
  } else if (structure === 'smsf') {
    taxRate = 0.15;
    taxRateLabel = '15% — Accumulation phase (0% in Pension phase)';
    if (netRentalForTax < 0) {
      monthlyTaxBenefit = 0;
      taxNote = 'SMSF losses carried forward. Must use LRBA (limited recourse borrowing). CGT: 10% after 12 months.';
    } else {
      monthlyTaxBenefit = -(netRentalForTax * 0.15) / 12;
      taxNote = '15% on net rental in accumulation phase. 0% in pension phase. 10% CGT after 12 months.';
    }
  }

  const afterTaxMonthlyCashflow = monthlyCashflow + monthlyTaxBenefit;
  const isLand = form.property_type === 'Land';
  const hasCalcs = purchasePrice > 0 && (weeklyRent > 0 || isLand);

  async function getRecommendation() {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const payload = {
        purchase_price: purchasePrice,
        loan_amount: loanAmount,
        interest_rate: interestRate,
        weekly_rent: weeklyRent,
        property_type: form.property_type,
        location: form.location,
        existing_portfolio_context: `Portfolio in Finley, Kirwan, Chigwell. State: ${state}. Ownership: ${structure}. Stamp duty: ${formatCurrency(stampDuty)}. LMI: ${formatCurrency(lmi)}. Total cash required: ${formatCurrency(totalCashRequired)}. After-tax cashflow: ${formatCurrency(afterTaxMonthlyCashflow)}/mo. Land tax (${state}): ${formatCurrency(annualLandTax)}/yr.`,
      };
      const res = await fetch(`${API_URL}/api/ai/purchase-predictor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setResult(await res.json());
      setShowTax(false);
      setShowCosts(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setResult(null);
  }

  const inputCls = 'w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white focus:outline-none focus:border-violet-500 transition-colors placeholder:text-slate-300 placeholder:font-normal';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="space-y-4">

      {/* Step 1 — Property Details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Step 1</p>
            <h3 className="text-sm font-bold text-slate-800">Property Details</h3>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input className={`${inputCls} pl-9`} placeholder="Suburb, State — e.g. Surry Hills NSW" value={form.location} onChange={(e) => update('location', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Purchase Price</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
              <input type="number" className={`${inputCls} pl-7`} placeholder="650,000" value={form.purchase_price} onChange={(e) => update('purchase_price', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Deposit</label>
            <div className="relative">
              <input type="number" className={`${inputCls} pr-8`} value={form.deposit} onChange={(e) => update('deposit', e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
            </div>
            {lvr > 80 && purchasePrice > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                LVR {lvr.toFixed(0)}% — LMI applies ({formatCurrency(lmi)})
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Interest Rate</label>
            <div className="relative">
              <input type="number" step="0.1" className={`${inputCls} pr-8`} value={form.interest_rate} onChange={(e) => update('interest_rate', e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Weekly Rent{isLand ? <span className="text-slate-300 font-normal normal-case ml-1">(optional for land)</span> : ''}</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
              <input type="number" className={`${inputCls} pl-7 pr-10`} placeholder={isLand ? '0' : '550'} value={form.weekly_rent} onChange={(e) => update('weekly_rent', e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">/wk</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Property Type</label>
            <select className={`${inputCls}`} value={form.property_type} onChange={(e) => update('property_type', e.target.value)}>
              <option>House</option>
              <option>Unit/Apartment</option>
              <option>Townhouse</option>
              <option>Land</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>State / Territory</label>
            <select className={`${inputCls}`} value={state} onChange={(e) => { setState(e.target.value as AusState); setResult(null); }}>
              <option value="QLD">QLD — Queensland</option>
              <option value="NSW">NSW — New South Wales</option>
              <option value="VIC">VIC — Victoria</option>
              <option value="WA">WA — Western Australia</option>
              <option value="SA">SA — South Australia</option>
              <option value="TAS">TAS — Tasmania</option>
              <option value="ACT">ACT — Capital Territory</option>
              <option value="NT">NT — Northern Territory</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Annual Council Rates</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
              <input type="number" className={`${inputCls} pl-7 pr-10`} value={councilRates} onChange={(e) => setCouncilRates(e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">/yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2 — Ownership */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors" onClick={() => setShowTax(v => !v)}>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Step 2</p>
            <h3 className="text-sm font-bold text-slate-800">Ownership & Tax Structure</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showTax ? 'rotate-180' : ''}`} />
        </button>
        {showTax && (
          <div className="px-5 pb-5 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
              {([
                { value: 'individual', label: 'Individual', sub: 'PAYG' },
                { value: 'trust', label: 'Discretionary', sub: 'Trust' },
                { value: 'company', label: 'Company', sub: 'Pty Ltd' },
                { value: 'smsf', label: 'SMSF', sub: 'Self-Managed' },
              ] as { value: OwnershipStructure; label: string; sub: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStructure(opt.value); setResult(null); }}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold border-2 transition-all text-center ${
                    structure === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  <p className="font-bold">{opt.label}</p>
                  <p className={`text-[10px] mt-0.5 ${structure === opt.value ? 'text-indigo-200' : 'text-slate-400'}`}>{opt.sub}</p>
                </button>
              ))}
            </div>
            {structure === 'individual' && (
              <div>
                <label className={labelCls}>Annual Salary / Other Income</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                  <input type="number" className={`${inputCls} pl-7 pr-10`} placeholder="120,000" value={annualSalary} onChange={(e) => setAnnualSalary(e.target.value)} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">/yr</span>
                </div>
                {salary > 0 && <p className="text-xs text-indigo-600 font-semibold mt-2">↳ {getMarginalRateLabel(salary)}</p>}
              </div>
            )}
            {structure === 'company' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Company (Pty Ltd):</strong> 25% flat tax. Losses carried forward — no negative gearing. No CGT 50% discount on sale.
              </div>
            )}
            {structure === 'smsf' && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800">
                <strong>SMSF:</strong> 15% on net rental (accumulation phase), 0% in pension phase. Must use LRBA. CGT 10% after 12 months.
              </div>
            )}
            {structure === 'trust' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Discretionary Trust:</strong> No tax benefit modelled — losses stay inside the trust. Profits distributed at beneficiary marginal rates. CGT 50% discount passes through to individual beneficiaries.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3 — Costs */}
      {purchasePrice > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors" onClick={() => setShowCosts(v => !v)}>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Step 3</p>
              <h3 className="text-sm font-bold text-slate-800">Acquisition Costs — {state}</h3>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showCosts ? 'rotate-180' : ''}`} />
          </button>
          {showCosts && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Purchase Price</span><span className="font-semibold">{formatCurrency(purchasePrice)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Stamp Duty ({state})</span><span className="font-bold text-orange-600">{formatCurrency(stampDuty)}</span></div>
              {lmi > 0 && <div className="flex justify-between"><span className="text-slate-500">LMI — LVR {lvr.toFixed(0)}%</span><span className="font-bold text-red-600">{formatCurrency(lmi)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Conveyancing (~0.2%)</span><span>{formatCurrency(conveyancing)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Total Cash Required</span><span>{formatCurrency(totalCashRequired)}</span>
              </div>
              <p className="text-xs text-slate-400">{formatCurrency(purchasePrice * (deposit / 100))} deposit + {formatCurrency(totalAcquisitionCosts)} costs</p>

              <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-1">Annual Ongoing (Tax Calc)</p>
                <div className="flex justify-between"><span className="text-slate-500">Interest (IO)</span><span>{formatCurrency(annualInterest)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">PM Fees (~8%)</span><span>{formatCurrency(annualMgmtFees)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Council Rates</span><span>{formatCurrency(annualCouncilRates)}</span></div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{state} Land Tax (est. {formatCurrency(estimatedLandValue)} land)</span>
                  <span className={annualLandTax > 0 ? 'font-semibold text-orange-600' : 'text-slate-400 text-xs'}>
                    {state === 'ACT' ? 'In general rates' : state === 'NT' ? 'No land tax' : annualLandTax > 0 ? formatCurrency(annualLandTax) : `Below ${landTaxThresholdLabel(structure, state)}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                  <span>Net Rental for Tax</span>
                  <span className={netRentalForTax >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {formatCurrency(netRentalForTax)}/yr <span className="font-normal text-xs text-slate-400">{netRentalForTax < 0 ? '(neg. geared)' : '(pos. geared)'}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Metric Cards */}
      {hasCalcs && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Loan Amount', value: formatCurrency(loanAmount), accent: 'border-l-slate-400', text: 'text-slate-900' },
              { label: 'Monthly Repayment', value: formatCurrency(monthlyRepayment), accent: 'border-l-slate-400', text: 'text-slate-900' },
              { label: 'Gross Yield', value: `${grossYield.toFixed(2)}%`, accent: grossYield >= 5 ? 'border-l-emerald-500' : grossYield >= 3.5 ? 'border-l-amber-400' : 'border-l-red-400', text: grossYield >= 5 ? 'text-emerald-700' : grossYield >= 3.5 ? 'text-amber-700' : 'text-red-600' },
              { label: 'Pre-Tax Cashflow/mo', value: formatCurrency(monthlyCashflow), accent: monthlyCashflow >= 0 ? 'border-l-emerald-500' : 'border-l-red-400', text: monthlyCashflow >= 0 ? 'text-emerald-700' : 'text-red-600' },
            ].map((s) => (
              <div key={s.label} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${s.accent} p-4 shadow-sm`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{s.label}</p>
                <p className={`text-lg font-black ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* After-Tax Panel */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                After-Tax Summary — {structure === 'individual' ? 'Individual PAYG' : structure === 'trust' ? 'Discretionary Trust' : structure === 'company' ? 'Company 25%' : 'SMSF 15%'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Tax Rate</p>
                <p className="text-sm font-bold text-white leading-snug">{taxRateLabel || `${(taxRate * 100).toFixed(0)}%`}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{monthlyTaxBenefit >= 0 ? 'Monthly Tax Saving' : 'Monthly Tax Cost'}</p>
                <p className={`text-xl font-black ${monthlyTaxBenefit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {monthlyTaxBenefit !== 0 ? (monthlyTaxBenefit >= 0 ? '+' : '') + formatCurrency(monthlyTaxBenefit) : '—'}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">After-Tax Cashflow/mo</p>
                <p className={`text-2xl font-black ${afterTaxMonthlyCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(afterTaxMonthlyCashflow)}
                </p>
              </div>
            </div>
            {taxNote && <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/10">{taxNote}</p>}
          </div>
        </>
      )}

      {/* AI CTA Button */}
      <button
        onClick={getRecommendation}
        disabled={loading || !purchasePrice || (!weeklyRent && !isLand)}
        className="w-full relative overflow-hidden rounded-2xl px-6 py-5 flex items-center justify-center gap-4
          bg-gradient-to-r from-violet-600 to-indigo-600 text-white
          shadow-lg shadow-indigo-200 hover:shadow-xl hover:from-violet-700 hover:to-indigo-700
          disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
      >
        {loading
          ? <span className="animate-spin h-5 w-5 border-2 border-white/40 border-t-white rounded-full shrink-0" />
          : <Sparkles className="w-6 h-6 shrink-0" />
        }
        <div className="text-left">
          <p className="font-bold text-base leading-tight">{loading ? 'Claude is analysing…' : 'Get AI Recommendation'}</p>
          <p className="text-xs text-indigo-200 mt-0.5">Powered by Claude AI — instant investment analysis</p>
        </div>
      </button>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* AI Result */}
      {result && !loading && (
        <div className="space-y-4">
          <div className={`rounded-2xl border-2 p-6 flex items-center justify-between ${
            result.recommendation === 'buy' ? 'bg-emerald-50 border-emerald-300'
            : result.recommendation === 'consider' ? 'bg-amber-50 border-amber-300'
            : 'bg-red-50 border-red-300'
          }`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">AI Verdict</p>
              <Badge variant={recommendationVariant(result.recommendation)} className="text-base px-5 py-1.5 uppercase font-bold">
                {result.recommendation}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Confidence</p>
              <p className="text-5xl font-black text-slate-900">{result.confidence}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border-2 border-emerald-100 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">Pros</p>
              <ul className="space-y-2.5">
                {result.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">✓</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border-2 border-red-100 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-3">Cons</p>
              <ul className="space-y-2.5">
                {result.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-black">✗</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">AI Analysis</p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{result.ai_summary}</p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Important Disclaimer — General Information Only</p>
        <p className="text-xs text-amber-900 leading-relaxed">
          All figures are <strong>estimates only</strong> based on publicly available 2024-25 rates and are provided for indicative purposes. This tool does <strong>not</strong> constitute financial, tax, or legal advice. You should consult a <strong>registered tax agent or accountant</strong> (CPA/CA), a qualified property lawyer or conveyancer, and a licensed financial adviser before making any investment decision.
        </p>
        <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
          <li><strong>Stamp duty / transfer duty:</strong> Rates and thresholds are indexed annually by each state revenue office. Concessions, surcharges (e.g. foreign purchaser: VIC 8%, NSW 8%, QLD 7%), and off-the-plan discounts are <em>not</em> included.</li>
          <li><strong>Land tax:</strong> Land value is estimated at 30% of purchase price — actual unimproved capital value (UCV) set by the state valuer-general may differ significantly. VIC COVID debt levy (+0.1–0.2%) may apply Jan 2024 onwards for some landholdings.</li>
          <li><strong>Tax brackets:</strong> 2024-25 Stage 3 rates apply from 1 July 2024. Medicare Levy Surcharge, HECS/HELP repayments, and low-income offsets are not included.</li>
          <li><strong>Deductions excluded:</strong> Depreciation (Div 43 building allowance &amp; Div 40 plant/equipment), body corporate fees, insurance, maintenance, water rates, and borrowing costs may all be deductible — a quantity surveyor&apos;s report is recommended.</li>
          <li><strong>Trust / Company / SMSF:</strong> Structural decisions have significant legal, stamp duty, and ongoing compliance cost implications. The trust surcharge, company franking rules, and SMSF LRBA requirements are complex — specialist advice is essential.</li>
          <li><strong>LMI:</strong> Estimated using indicative Helia/QBE tiered rates. Actual premiums vary by lender, loan purpose, and borrower profile.</li>
        </ul>
        <p className="text-xs text-amber-700">Verify current rates directly with the relevant state revenue authority before transacting: QLD — qro.qld.gov.au | VIC — sro.vic.gov.au | NSW — revenue.nsw.gov.au | WA — revenue.wa.gov.au | SA — revenuesa.sa.gov.au | TAS — sro.tas.gov.au | ACT — revenue.act.gov.au</p>
      </div>
    </div>
  );
}

// ─── Tab: Holding Costs ───────────────────────────────────────────────────────

function HoldingCostsTab({
  properties,
  templates,
}: {
  properties: Property[];
  templates: RecurringTemplate[];
}) {
  interface PropertyHolding {
    property: Property;
    monthlyTemplates: RecurringTemplate[];
    totalMonthly: number;
    weeklyRent: number;
    monthlyRent: number;
    netOOP: number;
  }

  const holdings: PropertyHolding[] = properties
    .map((prop) => {
      const propTemplates = templates.filter((t) => t.property_id === prop.id);
      const totalMonthly = propTemplates.reduce((sum, t) => {
        const amt = Number(t.amount) || 0;
        if (t.frequency === 'monthly') return sum + amt;
        if (t.frequency === 'quarterly') return sum + amt / 3;
        if (t.frequency === 'weekly') return sum + (amt * 52) / 12;
        if (t.frequency === 'fortnightly') return sum + (amt * 26) / 12;
        return sum + amt; // ad_hoc treated as monthly
      }, 0);

      // Match property name to known weekly rents
      const matchKey = Object.keys(WEEKLY_RENT_MAP).find((k) =>
        prop.name.toLowerCase().includes(k.toLowerCase())
      );
      const weeklyRent = matchKey ? WEEKLY_RENT_MAP[matchKey] : 0;
      const monthlyRent = (weeklyRent * 52) / 12;
      const netOOP = Math.max(0, totalMonthly - monthlyRent);

      return { property: prop, monthlyTemplates: propTemplates, totalMonthly, weeklyRent, monthlyRent, netOOP };
    })
    .sort((a, b) => b.netOOP - a.netOOP);

  const grandTotal = holdings.reduce((sum, h) => sum + h.netOOP, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Monthly out-of-pocket holding costs per property after rental income offsets.
      </p>

      {holdings.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400 text-sm">
          No properties or recurring templates found.
        </div>
      )}

      {holdings.map(({ property, monthlyTemplates, totalMonthly, weeklyRent, monthlyRent, netOOP }) => (
        <div
          key={property.id}
          className={`rounded-xl border-2 p-4 ${oopColor(netOOP)}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-900">{property.name}</p>
              {property.address && (
                <p className="text-xs text-slate-500">{property.address}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500">Net OOP / month</p>
              <p className={`text-xl font-bold ${oopTextColor(netOOP)}`}>
                {formatCurrency(netOOP)}
              </p>
            </div>
          </div>

          {/* Template rows */}
          {monthlyTemplates.length > 0 ? (
            <div className="space-y-1 mb-3">
              {monthlyTemplates.map((t) => {
                const monthly =
                  t.frequency === 'monthly'
                    ? Number(t.amount)
                    : t.frequency === 'quarterly'
                    ? Number(t.amount) / 3
                    : t.frequency === 'weekly'
                    ? (Number(t.amount) * 52) / 12
                    : t.frequency === 'fortnightly'
                    ? (Number(t.amount) * 26) / 12
                    : Number(t.amount);
                return (
                  <div key={t.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">{t.name}</span>
                    <span className="text-slate-700 font-medium">{formatCurrency(monthly)}/mo</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic mb-3">No recurring templates.</p>
          )}

          {/* Totals */}
          <div className="border-t border-current/20 pt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Monthly Costs</span>
              <span className="font-medium text-slate-900">{formatCurrency(totalMonthly)}</span>
            </div>
            {weeklyRent > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Rental Income (${weeklyRent}/wk)</span>
                <span className="font-medium text-green-700">{formatCurrency(monthlyRent)}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Grand total */}
      {holdings.length > 0 && (
        <div className="rounded-xl border-2 border-slate-800 bg-slate-900 p-4 text-white flex items-center justify-between">
          <span className="font-semibold">Grand Total Out of Pocket / Month</span>
          <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio AI' },
  { id: 'predictor', label: 'Purchase Predictor' },
  { id: 'holding', label: 'Holding Costs' },
];

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('predictor');

  const { data: properties = [], isLoading: propsLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.list(),
  });

  if (propsLoading || templatesLoading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">AI Insights</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Powered by Claude — get intelligent analysis of your property portfolio.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'portfolio' && <PortfolioTab properties={properties} />}
      {activeTab === 'predictor' && <PredictorTab />}
      {activeTab === 'holding' && (
        <HoldingCostsTab properties={properties} templates={templates} />
      )}
    </div>
  );
}
