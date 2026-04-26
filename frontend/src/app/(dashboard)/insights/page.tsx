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
import { ProGate } from '@/components/ui/ProGate';
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
  const [annualSalary, setAnnualSalary] = useState('120000');
  const [councilRates, setCouncilRates] = useState('2000');
  // Loan
  const [repaymentType, setRepaymentType] = useState<'io' | 'pi'>('io');
  const [loanTerm, setLoanTerm] = useState('30');
  // Land value
  const [landValuePct, setLandValuePct] = useState('40');
  // Ongoing cost inputs
  const [pmFeePct, setPmFeePct] = useState('7.5');
  const [waterRates, setWaterRates] = useState('1200');
  const [insuranceAmt, setInsuranceAmt] = useState('1800');
  const [maintenancePct, setMaintenancePct] = useState('0.75');
  const [strataFees, setStrataFees] = useState('5000');
  // Depreciation
  const [depreciationEnabled, setDepreciationEnabled] = useState(false);
  const [buildingCostPct, setBuildingCostPct] = useState('');
  const [plantEquipment, setPlantEquipment] = useState<'new' | 'pre2017' | 'post2017'>('new');
  // Structure-specific
  const [companyTaxRate, setCompanyTaxRate] = useState(25);
  const [smsfPhase, setSmsfPhase] = useState<'accumulation' | 'pension'>('accumulation');
  const [trustBeneficiaryRate, setTrustBeneficiaryRate] = useState('45');
  // Projection
  const [growthRate, setGrowthRate] = useState('6');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTax, setShowTax] = useState(true);
  const [showCosts, setShowCosts] = useState(true);
  const [showDepreciation, setShowDepreciation] = useState(false);

  // ── Parsed inputs ─────────────────────────────────────────────────────────
  const purchasePrice = parseFloat(form.purchase_price) || 0;
  const deposit = parseFloat(form.deposit) || 20;
  const interestRate = parseFloat(form.interest_rate) || 6.5;
  const weeklyRent = parseFloat(form.weekly_rent) || 0;
  const salary = parseFloat(annualSalary) || 0;
  const annualCouncilRates = parseFloat(councilRates) || 0;
  const loanTermYears = parseInt(loanTerm) || 30;
  const landValPct = parseFloat(landValuePct) || 40;
  const pmFeeRate = parseFloat(pmFeePct) || 7.5;
  const annualWaterRates = parseFloat(waterRates) || 1200;
  const annualInsurance = parseFloat(insuranceAmt) || 1800;
  const maintenanceRate = parseFloat(maintenancePct) || 0.75;
  const annualStrataInput = parseFloat(strataFees) || 5000;
  const growthRatePct = parseFloat(growthRate) || 6;
  const trustBenefRate = parseFloat(trustBeneficiaryRate) || 45;

  // ── Loan calcs ────────────────────────────────────────────────────────────
  const lvr = 100 - deposit;
  const loanAmount = purchasePrice * (1 - deposit / 100);
  const monthlyRate = interestRate / 100 / 12;
  const n = loanTermYears * 12;
  const monthlyRepayment = loanAmount > 0 && monthlyRate > 0
    ? repaymentType === 'io'
      ? loanAmount * monthlyRate
      : loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    : 0;

  // ── Income ────────────────────────────────────────────────────────────────
  const grossAnnualRent = weeklyRent * 52;
  const vacancyAllowance = grossAnnualRent * 0.026;
  const effectiveAnnualRent = grossAnnualRent - vacancyAllowance;
  const grossYield = purchasePrice > 0 ? grossAnnualRent / purchasePrice * 100 : 0;

  // ── Ongoing costs ─────────────────────────────────────────────────────────
  const estimatedLandValue = purchasePrice * (landValPct / 100);
  const annualLandTax = calcLandTax(estimatedLandValue, structure, state);
  const annualInterest = loanAmount * (interestRate / 100);
  const annualPmFees = grossAnnualRent * (pmFeeRate / 100);
  const lettingFee = weeklyRent; // 1 week rent/yr
  const annualMaintenance = purchasePrice * (maintenanceRate / 100);
  const isUnitOrTownhouse = form.property_type === 'Unit/Apartment' || form.property_type === 'Townhouse';
  const annualStrata = isUnitOrTownhouse ? annualStrataInput : 0;

  // ── Depreciation ──────────────────────────────────────────────────────────
  const defaultBuildCostPct = isUnitOrTownhouse ? 85 : 60;
  const buildCostPctNum = parseFloat(buildingCostPct) || defaultBuildCostPct;
  const divFortyThree = depreciationEnabled ? purchasePrice * (buildCostPctNum / 100) * 0.025 : 0;
  const divFortyMap: Record<string, number> = { new: 8000, pre2017: 3000, post2017: 0 };
  const divForty = depreciationEnabled ? (divFortyMap[plantEquipment] ?? 0) : 0;
  const totalDepreciation = divFortyThree + divForty;

  // ── Acquisition costs ─────────────────────────────────────────────────────
  const lmi = calcLMI(loanAmount, lvr);
  const stampDuty = purchasePrice > 0 ? calcStampDuty(purchasePrice, state, structure) : 0;
  const conveyancing = purchasePrice * 0.002;
  const totalAcquisitionCosts = stampDuty + lmi + conveyancing;
  const totalCashRequired = purchasePrice * (deposit / 100) + totalAcquisitionCosts;

  // ── Pre-tax cashflow (actual cash in/out) ─────────────────────────────────
  const annualCashExpenses = annualPmFees + lettingFee + annualCouncilRates + annualWaterRates + annualInsurance + annualMaintenance + annualStrata + annualLandTax;
  const preTaxAnnualCashflow = effectiveAnnualRent - (monthlyRepayment * 12) - annualCashExpenses;
  const monthlyCashflow = preTaxAnnualCashflow / 12;

  // ── Yields ────────────────────────────────────────────────────────────────
  const netYield = purchasePrice > 0 ? (grossAnnualRent - annualCashExpenses) / purchasePrice * 100 : 0;

  // ── Tax deductibles (interest only for P&I, not principal) ────────────────
  const deductiblesBase = annualInterest + annualPmFees + lettingFee + annualCouncilRates + annualWaterRates + annualInsurance + annualMaintenance + annualStrata + annualLandTax;
  const netRentalForTax = grossAnnualRent - (structure === 'individual' ? deductiblesBase + totalDepreciation : deductiblesBase);

  // ── Tax benefit / cost ────────────────────────────────────────────────────
  let monthlyTaxBenefit = 0;
  let annualTaxBenefit = 0;
  let taxRate = 0;
  let taxNote = '';
  let taxRateLabel = '';

  if (structure === 'individual') {
    taxRate = getMarginalRate(salary);
    taxRateLabel = salary > 0 ? getMarginalRateLabel(salary) : 'Enter salary to calculate';
    if (salary > 0) {
      if (netRentalForTax < 0) {
        annualTaxBenefit = Math.abs(netRentalForTax) * taxRate;
        taxNote = `Negative gearing saves ${formatCurrency(annualTaxBenefit)}/yr at ${(taxRate * 100).toFixed(0)}% marginal rate`;
      } else {
        annualTaxBenefit = -(netRentalForTax * taxRate);
        taxNote = `Net rental income ${formatCurrency(netRentalForTax)}/yr taxed at ${(taxRate * 100).toFixed(0)}% marginal rate`;
      }
      monthlyTaxBenefit = annualTaxBenefit / 12;
    }
  } else if (structure === 'trust') {
    if (netRentalForTax < 0) {
      taxRateLabel = 'No tax benefit at trust level';
      taxNote = 'Trust losses cannot be distributed — carried forward internally. No negative gearing benefit.';
    } else {
      taxRateLabel = `${trustBenefRate}% — Beneficiary marginal rate`;
      annualTaxBenefit = -(netRentalForTax * trustBenefRate / 100);
      monthlyTaxBenefit = annualTaxBenefit / 12;
      taxNote = `Trust distributes ${formatCurrency(netRentalForTax)}/yr to beneficiaries taxed at ${trustBenefRate}%.`;
    }
  } else if (structure === 'company') {
    taxRate = companyTaxRate / 100;
    taxRateLabel = `${companyTaxRate}% — ${companyTaxRate === 25 ? 'Base Rate Entity' : 'Standard'} (Pty Ltd)`;
    if (netRentalForTax < 0) {
      taxNote = 'Company losses carried forward — no immediate benefit. No CGT 50% discount on sale.';
    } else {
      annualTaxBenefit = -(netRentalForTax * taxRate);
      monthlyTaxBenefit = annualTaxBenefit / 12;
      taxNote = `Profits taxed at ${companyTaxRate}%. Dividends can be franked. No CGT 50% discount on sale.`;
    }
  } else if (structure === 'smsf') {
    taxRate = smsfPhase === 'pension' ? 0 : 0.15;
    taxRateLabel = smsfPhase === 'pension' ? '0% — Pension phase' : '15% — Accumulation phase';
    if (netRentalForTax < 0) {
      taxNote = `SMSF losses carried forward. Must use LRBA. CGT: ${smsfPhase === 'pension' ? '0%' : '10% after 12 months'}.`;
    } else {
      annualTaxBenefit = -(netRentalForTax * taxRate);
      monthlyTaxBenefit = annualTaxBenefit / 12;
      taxNote = `${smsfPhase === 'pension' ? '0%' : '15%'} on net rental. CGT: ${smsfPhase === 'pension' ? '0%' : '10% after 12 months'}.`;
    }
  }

  const afterTaxMonthlyCashflow = monthlyCashflow + monthlyTaxBenefit;
  const afterTaxAnnualCashflow = afterTaxMonthlyCashflow * 12;

  // ── 10-year equity projection ─────────────────────────────────────────────
  const k = 120; // 10 years in months
  const outstandingBalance = repaymentType === 'io' || loanAmount === 0 || monthlyRate === 0
    ? loanAmount
    : loanAmount * (Math.pow(1 + monthlyRate, n) - Math.pow(1 + monthlyRate, k)) / (Math.pow(1 + monthlyRate, n) - 1);
  const futureValue = purchasePrice > 0 ? purchasePrice * Math.pow(1 + growthRatePct / 100, 10) : 0;
  const tenYearEquity = futureValue - outstandingBalance;

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
        existing_portfolio_context: `Portfolio in Finley, Kirwan, Chigwell. State: ${state}. Ownership: ${structure}. Stamp duty: ${formatCurrency(stampDuty)}. LMI: ${formatCurrency(lmi)}. Total cash required: ${formatCurrency(totalCashRequired)}. After-tax cashflow: ${formatCurrency(afterTaxMonthlyCashflow)}/mo. Land tax (${state}): ${formatCurrency(annualLandTax)}/yr. Net yield: ${netYield.toFixed(2)}%. Repayment: ${repaymentType.toUpperCase()}.`,
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
    <div className="space-y-4 pb-36">

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
              <input className={`${inputCls} pl-9`} placeholder="e.g. Surry Hills NSW" value={form.location} onChange={(e) => update('location', e.target.value)} />
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
          {/* IO / P&I toggle */}
          <div>
            <label className={labelCls}>Repayment Type</label>
            <div className="flex gap-2">
              {(['io', 'pi'] as const).map((t) => (
                <button key={t} onClick={() => { setRepaymentType(t); setResult(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${repaymentType === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                  {t === 'io' ? 'Interest Only' : 'P&I'}
                </button>
              ))}
            </div>
          </div>
          {repaymentType === 'pi' && (
            <div>
              <label className={labelCls}>Loan Term</label>
              <div className="relative">
                <input type="number" className={`${inputCls} pr-10`} value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">yrs</span>
              </div>
            </div>
          )}
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
          <div>
            <label className={labelCls}>PM Fee</label>
            <div className="relative">
              <input type="number" step="0.1" className={`${inputCls} pr-8`} value={pmFeePct} onChange={(e) => setPmFeePct(e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Water Rates</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
              <input type="number" className={`${inputCls} pl-7 pr-10`} value={waterRates} onChange={(e) => setWaterRates(e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">/yr</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Landlord Insurance</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
              <input type="number" className={`${inputCls} pl-7 pr-10`} value={insuranceAmt} onChange={(e) => setInsuranceAmt(e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">/yr</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Maintenance &amp; Repairs</label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input type="number" step="0.1" className={`${inputCls} pr-8`} value={maintenancePct} onChange={(e) => setMaintenancePct(e.target.value)} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{purchasePrice > 0 ? formatCurrency(annualMaintenance) + '/yr' : '—'}</span>
            </div>
          </div>
          {isUnitOrTownhouse && (
            <div>
              <label className={labelCls}>Strata / Body Corporate</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                <input type="number" className={`${inputCls} pl-7 pr-10`} value={strataFees} onChange={(e) => setStrataFees(e.target.value)} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-semibold">/yr</span>
              </div>
            </div>
          )}
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
            {structure === 'trust' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <strong>Discretionary Trust:</strong> Losses stay inside trust — no negative gearing benefit. Profits distributed at beneficiary marginal rates. CGT 50% discount passes through to individual beneficiaries.
                  {(state === 'NSW' || state === 'VIC') && <span className="ml-1 font-semibold">Stamp duty surcharge applies in {state}.</span>}
                </div>
                <div>
                  <label className={labelCls}>Beneficiary Marginal Rate (for distribution modelling)</label>
                  <div className="relative">
                    <input type="number" className={`${inputCls} pr-8`} value={trustBeneficiaryRate} onChange={(e) => setTrustBeneficiaryRate(e.target.value)} />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                  </div>
                </div>
              </>
            )}
            {structure === 'company' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <strong>Company (Pty Ltd):</strong> Losses carried forward — no negative gearing. No CGT 50% discount on sale.
                </div>
                <div>
                  <label className={labelCls}>Company Tax Rate</label>
                  <div className="flex gap-2">
                    {([25, 30] as const).map((r) => (
                      <button key={r} onClick={() => setCompanyTaxRate(r)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${companyTaxRate === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                        {r}% {r === 25 ? '(Base Rate)' : '(Standard)'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {structure === 'smsf' && (
              <>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800">
                  <strong>SMSF:</strong> Must use LRBA (limited recourse borrowing arrangement). CGT: 10% accumulation / 0% pension after 12 months.
                </div>
                <div>
                  <label className={labelCls}>SMSF Phase</label>
                  <div className="flex gap-2">
                    {(['accumulation', 'pension'] as const).map((p) => (
                      <button key={p} onClick={() => setSmsfPhase(p)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all capitalize ${smsfPhase === p ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
                        {p === 'accumulation' ? 'Accumulation (15%)' : 'Pension (0%)'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
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
              <div className="flex justify-between">
                <span className="text-slate-500">Stamp Duty ({state}){structure === 'trust' && (state === 'NSW' || state === 'VIC') ? <span className="ml-1 text-orange-500 text-xs">+ trust surcharge</span> : ''}</span>
                <span className="font-bold text-orange-600">{formatCurrency(stampDuty)}</span>
              </div>
              {lmi > 0 && <div className="flex justify-between"><span className="text-slate-500">LMI — LVR {lvr.toFixed(0)}%</span><span className="font-bold text-red-600">{formatCurrency(lmi)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Conveyancing (~0.2%)</span><span>{formatCurrency(conveyancing)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Total Cash Required</span><span>{formatCurrency(totalCashRequired)}</span>
              </div>
              <p className="text-xs text-slate-400">{formatCurrency(purchasePrice * (deposit / 100))} deposit + {formatCurrency(totalAcquisitionCosts)} costs</p>

              <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-1">Annual Ongoing (Tax Calc)</p>
                <div className="flex justify-between"><span className="text-slate-500">Interest ({repaymentType.toUpperCase()})</span><span>{formatCurrency(annualInterest)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">PM Fees ({pmFeeRate}%)</span><span>{formatCurrency(annualPmFees)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Letting Fee (1 wk)</span><span>{formatCurrency(lettingFee)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Council Rates</span><span>{formatCurrency(annualCouncilRates)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Water Rates</span><span>{formatCurrency(annualWaterRates)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Landlord Insurance</span><span>{formatCurrency(annualInsurance)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Maintenance ({maintenanceRate}%)</span><span>{formatCurrency(annualMaintenance)}</span></div>
                {isUnitOrTownhouse && <div className="flex justify-between"><span className="text-slate-500">Strata / Body Corp</span><span>{formatCurrency(annualStrata)}</span></div>}
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {state} Land Tax
                    <button className="ml-1.5 text-slate-400 hover:text-slate-600 text-[10px] underline" onClick={() => setLandValuePct(landValuePct)}>
                      (est. {landValPct}% = {formatCurrency(estimatedLandValue)})
                    </button>
                  </span>
                  <span className={annualLandTax > 0 ? 'font-semibold text-orange-600' : 'text-slate-400 text-xs'}>
                    {state === 'NT' ? 'No land tax' : annualLandTax > 0 ? formatCurrency(annualLandTax) : `Below ${landTaxThresholdLabel(structure, state)}`}
                  </span>
                </div>
                {/* Land value % edit */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400 shrink-0">Land value %:</span>
                  <div className="relative flex-1">
                    <input type="number" step="1" className="w-full border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-700 focus:outline-none focus:border-violet-400" value={landValuePct} onChange={(e) => setLandValuePct(e.target.value)} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Vacancy Allowance (2.6%)</span><span className="text-red-500">−{formatCurrency(vacancyAllowance)}</span></div>
                {depreciationEnabled && totalDepreciation > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Depreciation (Div 43+40)</span><span className="text-indigo-600">{formatCurrency(totalDepreciation)}</span></div>
                )}
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

      {/* Depreciation (optional) */}
      {purchasePrice > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors" onClick={() => setShowDepreciation(v => !v)}>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Optional</p>
              <h3 className="text-sm font-bold text-slate-800">Depreciation {depreciationEnabled ? <span className="text-purple-600 font-normal">— {formatCurrency(totalDepreciation)}/yr</span> : <span className="text-slate-400 font-normal">(off)</span>}</h3>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showDepreciation ? 'rotate-180' : ''}`} />
          </button>
          {showDepreciation && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 rounded-full transition-colors ${depreciationEnabled ? 'bg-purple-600' : 'bg-slate-300'} relative`} onClick={() => setDepreciationEnabled(v => !v)}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${depreciationEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Include depreciation in tax calc</span>
              </label>
              {depreciationEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Construction Cost % (Div 43)</label>
                    <div className="relative">
                      <input type="number" step="1" className={`${inputCls} pr-8`} placeholder={String(defaultBuildCostPct)} value={buildingCostPct} onChange={(e) => setBuildingCostPct(e.target.value)} />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Div 43 @ 2.5%/yr = {formatCurrency(divFortyThree)}/yr</p>
                  </div>
                  <div>
                    <label className={labelCls}>Plant & Equipment (Div 40)</label>
                    <select className={inputCls} value={plantEquipment} onChange={(e) => setPlantEquipment(e.target.value as 'new' | 'pre2017' | 'post2017')}>
                      <option value="new">New property (~$8,000/yr)</option>
                      <option value="pre2017">Established pre-2017 (~$3,000/yr)</option>
                      <option value="post2017">Established post-2017 ($0 — not available)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Div 40 = {formatCurrency(divForty)}/yr</p>
                  </div>
                  <div className="sm:col-span-2 bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
                    Total depreciation: <strong>{formatCurrency(totalDepreciation)}/yr</strong> — applied to Individual tax calc only. Consult a quantity surveyor for accurate schedule.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky summary bar */}
      {hasCalcs && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg px-4 py-3">
          <div className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Loan', value: formatCurrency(loanAmount), color: 'text-slate-900' },
              { label: repaymentType === 'io' ? 'Repayment (IO)' : 'Repayment (P&I)', value: formatCurrency(monthlyRepayment) + '/mo', color: 'text-slate-900' },
              { label: 'Gross / Net Yield', value: `${grossYield.toFixed(1)}% / ${netYield.toFixed(1)}%`, color: grossYield >= 5 ? 'text-emerald-700' : grossYield >= 3.5 ? 'text-amber-700' : 'text-red-600' },
              { label: 'After-Tax CF/mo', value: formatCurrency(afterTaxMonthlyCashflow), color: afterTaxMonthlyCashflow >= 0 ? 'text-emerald-700' : 'text-red-600' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className={`text-xs sm:text-sm font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* After-Tax Panel */}
      {hasCalcs && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              After-Tax Summary — {structure === 'individual' ? 'Individual PAYG' : structure === 'trust' ? 'Discretionary Trust' : structure === 'company' ? `Company ${companyTaxRate}%` : `SMSF ${smsfPhase === 'pension' ? '0%' : '15%'}`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Tax Rate</p>
              <p className="text-sm font-bold text-white leading-snug">{taxRateLabel || '—'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{annualTaxBenefit >= 0 ? 'Annual Tax Saving' : 'Annual Tax Cost'}</p>
              <p className={`text-lg font-black ${annualTaxBenefit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {annualTaxBenefit !== 0 ? (annualTaxBenefit >= 0 ? '+' : '') + formatCurrency(Math.abs(annualTaxBenefit)) : '—'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{monthlyTaxBenefit >= 0 ? 'Monthly Tax Saving' : 'Monthly Tax Cost'}</p>
              <p className={`text-lg font-black ${monthlyTaxBenefit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {monthlyTaxBenefit !== 0 ? (monthlyTaxBenefit >= 0 ? '+' : '') + formatCurrency(Math.abs(monthlyTaxBenefit)) : '—'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">After-Tax CF/mo</p>
              <p className={`text-2xl font-black ${afterTaxMonthlyCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(afterTaxMonthlyCashflow)}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Annual After-Tax CF</p>
              <p className={`text-xl font-black ${afterTaxAnnualCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(afterTaxAnnualCashflow)}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 sm:col-span-1">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">10-yr Equity Proj.</p>
              <div className="flex items-center gap-1.5">
                <p className={`text-lg font-black ${tenYearEquity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(tenYearEquity)}</p>
                <div className="flex items-center gap-0.5">
                  <input type="number" step="0.5" className="w-12 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} />
                  <span className="text-xs text-slate-400">%/yr</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{formatCurrency(futureValue)} value − {formatCurrency(outstandingBalance)} loan</p>
            </div>
          </div>
          {taxNote && <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/10">{taxNote}</p>}
        </div>
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
          <li><strong>Stamp duty / transfer duty:</strong> Rates and thresholds are indexed annually. NSW/VIC trust surcharges included. Foreign purchaser surcharges, off-the-plan discounts and FHOG concessions are <em>not</em> included.</li>
          <li><strong>Land tax:</strong> Land value estimated at {landValPct}% of purchase price — actual UCV set by the state valuer-general may differ significantly. NSW trust/company = no threshold (taxed from $1). VIC trust surcharge 0.5% applies.</li>
          <li><strong>Tax brackets:</strong> 2024-25 Stage 3 rates apply from 1 July 2024. Medicare Levy Surcharge, HECS/HELP repayments, and low-income offsets are not included.</li>
          <li><strong>Depreciation:</strong> Div 40 plant/equipment unavailable for established properties acquired post-9 May 2017. Div 43 building allowance at 2.5%/yr (residential). A quantity surveyor&apos;s report is recommended.</li>
          <li><strong>Trust / Company / SMSF:</strong> Structural decisions have significant legal and compliance implications. SMSF LRBA rules restrict borrowing structure. Specialist advice is essential.</li>
          <li><strong>LMI:</strong> Estimated using indicative Helia/QBE tiered rates. Actual premiums vary by lender.</li>
          <li><strong>10-yr equity:</strong> Growth rate assumption is illustrative only — past capital growth does not guarantee future performance.</li>
        </ul>
        <p className="text-xs text-amber-700">Verify current rates: QLD — qro.qld.gov.au | VIC — sro.vic.gov.au | NSW — revenue.nsw.gov.au | WA — revenue.wa.gov.au | SA — revenuesa.sa.gov.au | TAS — sro.tas.gov.au | ACT — revenue.act.gov.au</p>
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
      {activeTab === 'portfolio' && (
        <ProGate feature="AI Portfolio Analysis">
          <PortfolioTab properties={properties} />
        </ProGate>
      )}
      {activeTab === 'predictor' && (
        <ProGate feature="AI Purchase Predictor">
          <PredictorTab />
        </ProGate>
      )}
      {activeTab === 'holding' && (
        <HoldingCostsTab properties={properties} templates={templates} />
      )}
    </div>
  );
}
