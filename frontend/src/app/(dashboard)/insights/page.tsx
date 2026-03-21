'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { propertiesApi, recurringApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Property, RecurringTemplate } from '@/types';

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

type OwnershipStructure = 'individual' | 'trust' | 'company' | 'smsf';
type AusState = 'QLD' | 'NSW' | 'VIC' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

// 2024-25 Australian marginal tax rates (Stage 3 cuts, incl. 2% Medicare levy)
// Brackets: $0-18,200 nil | $18,201-45,000 19% | $45,001-135,000 32.5% | $135,001-190,000 37% | $190,001+ 45%
function getMarginalRate(income: number): number {
  if (income <= 18200) return 0;
  if (income <= 45000) return 0.21;   // 19% + 2%
  if (income <= 135000) return 0.345; // 32.5% + 2%
  if (income <= 190000) return 0.39;  // 37% + 2%
  return 0.47;                        // 45% + 2%
}

function getMarginalRateLabel(income: number): string {
  if (income <= 18200) return '0% — Nil bracket';
  if (income <= 45000) return '21% (19% + 2% Medicare)';
  if (income <= 135000) return '34.5% (32.5% + 2% Medicare)';
  if (income <= 190000) return '39% (37% + 2% Medicare)';
  return '47% (45% + 2% Medicare)';
}

// LMI estimate — Helia/QBE tiered rates
function calcLMI(loanAmount: number, lvr: number): number {
  if (lvr <= 80) return 0;
  if (lvr <= 85) return loanAmount * 0.009;
  if (lvr <= 90) return loanAmount * 0.018;
  if (lvr <= 95) return loanAmount * 0.038;
  return 0;
}

// Stamp duty — investment property, not first home buyer
function calcStampDuty(price: number, state: AusState): number {
  switch (state) {
    case 'QLD': {
      if (price <= 5000) return 0;
      if (price <= 75000) return (price - 5000) * 0.015;
      if (price <= 540000) return 1050 + (price - 75000) * 0.035;
      if (price <= 1000000) return 17325 + (price - 540000) * 0.045;
      return 38025 + (price - 1000000) * 0.0575;
    }
    case 'NSW': {
      if (price <= 14000) return price * 0.0125;
      if (price <= 30000) return 175 + (price - 14000) * 0.015;
      if (price <= 80000) return 415 + (price - 30000) * 0.0175;
      if (price <= 300000) return 1290 + (price - 80000) * 0.035;
      if (price <= 1000000) return 8990 + (price - 300000) * 0.045;
      if (price <= 3000000) return 40490 + (price - 1000000) * 0.055;
      return 150490 + (price - 3000000) * 0.07; // Premium property duty $3M+
    }
    case 'VIC': {
      if (price <= 25000) return price * 0.014;
      if (price <= 130000) return 350 + (price - 25000) * 0.024;
      if (price <= 960000) return 2870 + (price - 130000) * 0.06;
      return 52670 + (price - 960000) * 0.065;
    }
    case 'WA': {
      // Revenue WA — Dutiable value thresholds (investment property rates)
      if (price <= 120000) return price * 0.019;
      if (price <= 150000) return 2280 + (price - 120000) * 0.0285;
      if (price <= 360000) return 3135 + (price - 150000) * 0.038;
      if (price <= 725000) return 11115 + (price - 360000) * 0.0475;
      return 28453 + (price - 725000) * 0.0515;
    }
    case 'SA': {
      if (price <= 12000) return price * 0.01;
      if (price <= 30000) return 120 + (price - 12000) * 0.02;
      if (price <= 50000) return 480 + (price - 30000) * 0.03;
      if (price <= 100000) return 1080 + (price - 50000) * 0.035;
      if (price <= 200000) return 2830 + (price - 100000) * 0.04;
      if (price <= 250000) return 6830 + (price - 200000) * 0.0425;
      if (price <= 300000) return 8955 + (price - 250000) * 0.0475;
      if (price <= 500000) return 11330 + (price - 300000) * 0.05;
      return 21330 + (price - 500000) * 0.055;
    }
    case 'TAS': {
      if (price <= 3000) return 50;
      if (price <= 25000) return 50 + (price - 3000) * 0.015;
      if (price <= 75000) return 380 + (price - 25000) * 0.0225;
      if (price <= 200000) return 1505 + (price - 75000) * 0.035;
      if (price <= 375000) return 5880 + (price - 200000) * 0.04;
      if (price <= 725000) return 12880 + (price - 375000) * 0.0425;
      return 27755 + (price - 725000) * 0.045;
    }
    case 'ACT': {
      if (price <= 200000) return price * 0.0206;
      if (price <= 300000) return 4120 + (price - 200000) * 0.0292;
      if (price <= 500000) return 7040 + (price - 300000) * 0.0399;
      if (price <= 750000) return 15020 + (price - 500000) * 0.0499;
      if (price <= 1000000) return 27495 + (price - 750000) * 0.0649;
      return 43720 + (price - 1000000) * 0.0699;
    }
    case 'NT': {
      if (price <= 525000) {
        const v = price / 1000;
        return Math.max(0, (0.06571441 * v * v + 15 * v - 12000) * 0.01);
      }
      return price * 0.0495;
    }
    default: return 0;
  }
}

// Land tax calculators — annual, on unimproved land value (est. 30% of purchase price)
// ACT uses a rates system (no separate land tax). NT has no land tax.

function calcLandTax(landValue: number, structure: OwnershipStructure, state: AusState): number {
  const isTrust = structure === 'trust' || structure === 'company';

  switch (state) {
    case 'QLD': {
      const threshold = isTrust ? 350000 : 600000;
      if (landValue <= threshold) return 0;
      if (!isTrust) {
        if (landValue <= 999999) return 500 + (landValue - 600000) * 0.01;
        if (landValue <= 2999999) return 4500 + (landValue - 1000000) * 0.0165;
        return 37500 + (landValue - 3000000) * 0.0225;
      }
      if (landValue <= 2999999) return 1450 + (landValue - 350000) * 0.017;
      return 46500 + (landValue - 3000000) * 0.025; // $1,450 + $2,650,000×1.7% = $46,500
    }
    case 'VIC': {
      // SRO Victoria 2024-25: Individual/SMSF threshold $300k; Trust $25k + 0.5% surcharge
      // Standard tax brackets only apply above $300k (for ALL structures)
      // Trust pays: standard tax (if > $300k) PLUS 0.5% surcharge on value above $25k
      const threshold = isTrust ? 25000 : 300000;
      if (landValue <= threshold) return 0;
      let standardTax = 0;
      if (landValue > 300000) {
        if (landValue <= 600000) standardTax = 375 + (landValue - 300000) * 0.002;
        else if (landValue <= 1000000) standardTax = 975 + (landValue - 600000) * 0.005;
        else if (landValue <= 1800000) standardTax = 2975 + (landValue - 1000000) * 0.008;
        else if (landValue <= 3000000) standardTax = 9375 + (landValue - 1800000) * 0.013;
        else standardTax = 24975 + (landValue - 3000000) * 0.0255;
      }
      // Trust surcharge: +0.5% on all land value above $25k (regardless of standard tax)
      const trustSurcharge = isTrust ? (landValue - 25000) * 0.005 : 0;
      return standardTax + trustSurcharge;
    }
    case 'NSW': {
      // Threshold $1,075,000 (2024-25, adjusted annually by CPI)
      // Same threshold for individuals, companies, trusts
      const threshold = 1075000;
      if (landValue <= threshold) return 0;
      if (landValue <= 6571000) return 100 + (landValue - threshold) * 0.016;
      return 100504 + (landValue - 6571000) * 0.02;
    }
    case 'WA': {
      // Threshold $300,000
      if (landValue <= 300000) return 0;
      if (landValue <= 420000) return (landValue - 300000) * 0.0015;
      if (landValue <= 1000000) return 180 + (landValue - 420000) * 0.0045;
      if (landValue <= 1800000) return 2790 + (landValue - 1000000) * 0.0076;
      if (landValue <= 5000000) return 8870 + (landValue - 1800000) * 0.0105;
      return 42470 + (landValue - 5000000) * 0.014;
    }
    case 'SA': {
      // Threshold $534,000 (2024-25)
      if (landValue <= 534000) return 0;
      if (landValue <= 1082000) return (landValue - 534000) * 0.005;
      if (landValue <= 1700000) return 2740 + (landValue - 1082000) * 0.01;
      if (landValue <= 3900000) return 8940 + (landValue - 1700000) * 0.0175;
      return 47440 + (landValue - 3900000) * 0.024;
    }
    case 'TAS': {
      // Threshold $100,000
      if (landValue <= 100000) return 0;
      if (landValue <= 499999) return (landValue - 100000) * 0.0045;
      return 1800 + (landValue - 500000) * 0.015;
    }
    case 'ACT': return 0; // ACT uses general rates (land value charge), no separate land tax
    case 'NT': return 0;  // NT has no land tax
    default: return 0;
  }
}

function landTaxThresholdLabel(structure: OwnershipStructure, state: AusState): string {
  const isTrust = structure === 'trust' || structure === 'company';
  switch (state) {
    case 'QLD': return isTrust ? '$350k' : '$600k';
    case 'VIC': return isTrust ? '$25k (trust surcharge applies)' : '$300k';
    case 'NSW': return '$1,075,000';
    case 'WA': return '$300k';
    case 'SA': return '$534k';
    case 'TAS': return '$100k';
    case 'ACT': return 'N/A (general rates system)';
    case 'NT': return 'N/A (no land tax)';
    default: return '—';
  }
}

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
    const perBeneIncome = salary > 0 ? salary / numBeneficiaries : 0;
    const distRate = perBeneIncome > 0 ? getMarginalRate(perBeneIncome) : 0;
    taxRate = distRate;
    taxRateLabel = salary > 0
      ? `${(distRate * 100).toFixed(0)}% (${formatCurrency(perBeneIncome)}/beneficiary)`
      : 'Enter beneficiary income to calculate';
    if (netRentalForTax < 0) {
      monthlyTaxBenefit = 0;
      taxNote = 'Trust losses are carried forward internally — no immediate tax deduction. Profits distributed at beneficiary marginal rates.';
    } else if (salary > 0) {
      monthlyTaxBenefit = -(netRentalForTax * distRate) / 12;
      taxNote = `Net income ${formatCurrency(netRentalForTax)}/yr distributed across ${numBeneficiaries} beneficiar${numBeneficiaries > 1 ? 'ies' : 'y'} at ${(distRate * 100).toFixed(0)}%`;
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

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="space-y-4">
      {/* Property Details */}
      <Card title="Property Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Property Location</label>
            <input className={inputCls} placeholder="e.g. Suburb, State" value={form.location} onChange={(e) => update('location', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Purchase Price (AUD)</label>
            <input type="number" className={inputCls} placeholder="e.g. 450000" value={form.purchase_price} onChange={(e) => update('purchase_price', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Deposit %</label>
            <input type="number" className={inputCls} value={form.deposit} onChange={(e) => update('deposit', e.target.value)} />
            {lvr > 80 && purchasePrice > 0 && (
              <p className="text-xs text-amber-600 mt-1">LVR {lvr.toFixed(0)}% — LMI applies ({formatCurrency(lmi)})</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Interest Rate %</label>
            <input type="number" step="0.1" className={inputCls} value={form.interest_rate} onChange={(e) => update('interest_rate', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Weekly Rent Expected (AUD){isLand ? ' — optional for land' : ''}</label>
            <input type="number" className={inputCls} placeholder={isLand ? '0 (land banking)' : 'e.g. 500'} value={form.weekly_rent} onChange={(e) => update('weekly_rent', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Property Type</label>
            <select className={`${inputCls} bg-white`} value={form.property_type} onChange={(e) => update('property_type', e.target.value)}>
              <option value="House">House</option>
              <option value="Unit/Apartment">Unit/Apartment</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Land">Land</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>State / Territory</label>
            <select className={`${inputCls} bg-white`} value={state} onChange={(e) => { setState(e.target.value as AusState); setResult(null); }}>
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
            <label className={labelCls}>Annual Council Rates (AUD)</label>
            <input type="number" className={inputCls} value={councilRates} onChange={(e) => setCouncilRates(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Ownership & Tax Structure */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
          onClick={() => setShowTax(v => !v)}
        >
          Ownership & Tax Structure
          <span className="text-slate-400 text-xs">{showTax ? '▲ collapse' : '▼ expand'}</span>
        </button>
        {showTax && <div className="px-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Ownership Structure</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { value: 'individual', label: 'Individual (PAYG)' },
                { value: 'trust', label: 'Discretionary Trust' },
                { value: 'company', label: 'Company (Pty Ltd)' },
                { value: 'smsf', label: 'SMSF' },
              ] as { value: OwnershipStructure; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStructure(opt.value); setResult(null); }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors text-center ${
                    structure === opt.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(structure === 'individual' || structure === 'trust') && (
            <div>
              <label className={labelCls}>
                {structure === 'trust' ? 'Total Beneficiary Income (AUD/yr)' : 'Annual Salary / Other Income (AUD)'}
              </label>
              <input type="number" className={inputCls} placeholder="e.g. 120000" value={annualSalary} onChange={(e) => setAnnualSalary(e.target.value)} />
              {salary > 0 && structure === 'individual' && (
                <p className="text-xs text-slate-500 mt-1">Marginal rate: {getMarginalRateLabel(salary)}</p>
              )}
            </div>
          )}

          {structure === 'trust' && (
            <div>
              <label className={labelCls}>Number of Beneficiaries</label>
              <input type="number" min="1" className={inputCls} value={beneficiaries} onChange={(e) => setBeneficiaries(e.target.value)} />
              {salary > 0 && numBeneficiaries > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {formatCurrency(salary / numBeneficiaries)}/person → {getMarginalRateLabel(salary / numBeneficiaries)}
                </p>
              )}
            </div>
          )}

          {structure === 'company' && (
            <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p><strong>Company (Pty Ltd):</strong> 25% flat tax on profits. Losses carried forward — no negative gearing benefit.</p>
              <p>No CGT 50% discount on property sale. Dividends can be franked. Generally not recommended for property holding vs. trust.</p>
            </div>
          )}
          {structure === 'smsf' && (
            <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
              <p><strong>SMSF:</strong> 15% tax on net rental income (accumulation). 0% in pension phase.</p>
              <p>Must use Limited Recourse Borrowing Arrangement (LRBA). CGT: 10% after 12 months (accumulation), 0% pension phase.</p>
            </div>
          )}
          {structure === 'trust' && (
            <div className="sm:col-span-2 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 space-y-1">
              <p><strong>Discretionary Trust:</strong> Trust losses cannot be distributed — carried forward internally.</p>
              <p>Positive income split among beneficiaries at their marginal rates. 50% CGT discount passes to individual beneficiaries.</p>
            </div>
          )}
        </div>
        </div>}
      </div>

      {/* Acquisition Costs */}
      {purchasePrice > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
          onClick={() => setShowCosts(v => !v)}
        >
          {`Acquisition Costs — ${state} (Investment Property)`}
          <span className="text-slate-400 text-xs">{showCosts ? '▲ collapse' : '▼ expand'}</span>
        </button>
        {showCosts && <div className="px-4 pb-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Purchase Price</span>
              <span className="font-medium">{formatCurrency(purchasePrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Stamp Duty ({state})</span>
              <span className="font-semibold text-orange-700">{formatCurrency(stampDuty)}</span>
            </div>
            {lmi > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">LMI — LVR {lvr.toFixed(0)}%</span>
                <span className="font-semibold text-red-700">{formatCurrency(lmi)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Conveyancing / Legal (est. 0.2%)</span>
              <span className="font-medium">{formatCurrency(conveyancing)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">Total Cash Required to Purchase</span>
              <span className="font-bold text-slate-900">{formatCurrency(totalCashRequired)}</span>
            </div>
            <p className="text-xs text-slate-400">{formatCurrency(purchasePrice * (deposit / 100))} deposit + {formatCurrency(totalAcquisitionCosts)} costs</p>
          </div>

          {/* Annual ongoing */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Annual Ongoing Costs (for tax calc)</p>
            <div className="flex justify-between">
              <span className="text-slate-500">Interest (IO equivalent)</span>
              <span>{formatCurrency(annualInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PM / Agent Fees (~8% of rent)</span>
              <span>{formatCurrency(annualMgmtFees)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Council Rates</span>
              <span>{formatCurrency(annualCouncilRates)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{state} Land Tax (est. land {formatCurrency(estimatedLandValue)})</span>
              <span className={annualLandTax > 0 ? 'font-semibold text-orange-700' : 'text-slate-400'}>
                {state === 'ACT' ? 'Included in general rates' : state === 'NT' ? 'No land tax (NT)' : annualLandTax > 0 ? formatCurrency(annualLandTax) : `Below threshold (${landTaxThresholdLabel(structure, state)})`}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
              <span>Net Rental Income for Tax</span>
              <span className={netRentalForTax >= 0 ? 'text-green-700' : 'text-red-700'}>
                {formatCurrency(netRentalForTax)}/yr
                <span className="font-normal text-xs ml-1 text-slate-500">
                  {netRentalForTax < 0 ? '(negatively geared)' : '(positively geared)'}
                </span>
              </span>
            </div>
          </div>
        </div>}
        </div>
      )}

      {/* Live Calculations */}
      {hasCalcs && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Loan Amount', value: formatCurrency(loanAmount), neutral: true },
              { label: 'Monthly Repayment (P&I)', value: formatCurrency(monthlyRepayment), neutral: true },
              { label: 'Gross Yield', value: `${grossYield.toFixed(2)}%`, neutral: true },
              { label: 'Pre-Tax Cashflow/mo', value: formatCurrency(monthlyCashflow), positive: monthlyCashflow >= 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                <p className={`text-base font-bold ${stat.neutral ? 'text-slate-900' : stat.positive ? 'text-green-700' : 'text-red-700'}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* After-tax summary panel */}
          <div className="bg-slate-800 rounded-xl p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              After-Tax Summary —{' '}
              {structure === 'individual' ? 'Individual PAYG' : structure === 'trust' ? 'Discretionary Trust' : structure === 'company' ? 'Company 25%' : 'SMSF 15%'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Tax Rate</p>
                <p className="text-sm font-semibold leading-tight">{taxRateLabel || `${(taxRate * 100).toFixed(0)}%`}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{monthlyTaxBenefit >= 0 ? 'Monthly Tax Saving' : 'Monthly Tax Cost'}</p>
                <p className={`text-lg font-bold ${monthlyTaxBenefit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {monthlyTaxBenefit !== 0 ? (monthlyTaxBenefit >= 0 ? '+' : '') + formatCurrency(monthlyTaxBenefit) + '/mo' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">After-Tax Cashflow/mo</p>
                <p className={`text-2xl font-bold ${afterTaxMonthlyCashflow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(afterTaxMonthlyCashflow)}
                </p>
              </div>
            </div>
            {taxNote && <p className="text-xs text-slate-400 mt-3 border-t border-slate-700 pt-2">{taxNote}</p>}
            <p className="text-xs text-slate-500 mt-2">
              * Deductions: interest (IO), PM fees ~8%, council rates{annualLandTax > 0 ? `, ${state} land tax` : ''}. Estimate only — seek professional tax advice.
            </p>
          </div>
        </>
      )}

      <Button onClick={getRecommendation} loading={loading} disabled={!purchasePrice || (!weeklyRent && !isLand)} size="md" className="w-full sm:w-auto">
        Get AI Recommendation
      </Button>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-slate-500 text-sm">
          <span className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full" />
          Claude is evaluating this purchase…
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-5 flex flex-col sm:flex-row items-center gap-4 ${
            result.recommendation === 'buy' ? 'bg-green-50 border-green-300'
            : result.recommendation === 'consider' ? 'bg-amber-50 border-amber-300'
            : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">AI Recommendation</p>
              <Badge variant={recommendationVariant(result.recommendation)} className="text-base px-4 py-1 uppercase">
                {result.recommendation}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Confidence</p>
              <p className="text-3xl font-bold text-slate-900">{result.confidence}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card title="Pros">
              <ul className="space-y-2">
                {result.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="shrink-0 text-green-600 font-bold mt-0.5">✓</span>{pro}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Cons">
              <ul className="space-y-2">
                {result.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="shrink-0 text-red-500 font-bold mt-0.5">✗</span>{con}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="AI Summary">
            <p className="text-sm text-slate-700 leading-relaxed">{result.ai_summary}</p>
          </Card>
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
        <p className="text-xs text-amber-700">Rates sourced from: ATO, Revenue NSW, SRO Victoria, Queensland Revenue Office, Revenue WA, RevenueSA, State Revenue Office Tasmania, ACT Revenue Office. Verify all figures with the relevant authority before transacting.</p>
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
