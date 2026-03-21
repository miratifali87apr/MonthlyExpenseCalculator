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

function PredictorTab() {
  const [form, setForm] = useState({
    location: '',
    purchase_price: '',
    deposit: '20',
    interest_rate: '6.5',
    weekly_rent: '',
    property_type: 'House',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const purchasePrice = parseFloat(form.purchase_price) || 0;
  const deposit = parseFloat(form.deposit) || 20;
  const interestRate = parseFloat(form.interest_rate) || 6.5;
  const weeklyRent = parseFloat(form.weekly_rent) || 0;

  const loanAmount = purchasePrice * (1 - deposit / 100);
  const monthlyRate = interestRate / 100 / 12;
  const monthlyRepayment =
    loanAmount > 0 && monthlyRate > 0
      ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -360))
      : 0;
  const monthlyRent = (weeklyRent * 52) / 12;
  const grossYield = purchasePrice > 0 ? (weeklyRent * 52) / purchasePrice * 100 : 0;
  const monthlyCashflow = monthlyRent - monthlyRepayment;

  const hasCalcs = purchasePrice > 0 && weeklyRent > 0;

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
        existing_portfolio_context: `Portfolio includes properties in Finley, Kirwan, and Chigwell.`,
      };

      const res = await fetch(`${API_URL}/api/ai/purchase-predictor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const data: PurchaseResult = await res.json();
      setResult(data);
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

  return (
    <div className="space-y-4">
      {/* Input Form */}
      <Card title="Property Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Property Location</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. Suburb, State"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Purchase Price (AUD)</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. 450000"
              value={form.purchase_price}
              onChange={(e) => update('purchase_price', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deposit %</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={form.deposit}
              onChange={(e) => update('deposit', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Interest Rate %</label>
            <input
              type="number"
              step="0.1"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={form.interest_rate}
              onChange={(e) => update('interest_rate', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Weekly Rent Expected (AUD)</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. 500"
              value={form.weekly_rent}
              onChange={(e) => update('weekly_rent', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Property Type</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={form.property_type}
              onChange={(e) => update('property_type', e.target.value)}
            >
              <option value="House">House</option>
              <option value="Unit/Apartment">Unit/Apartment</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Land">Land</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Live Calculations */}
      {hasCalcs && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Loan Amount', value: formatCurrency(loanAmount), neutral: true },
            { label: 'Monthly Repayment (P&I)', value: formatCurrency(monthlyRepayment), neutral: true },
            { label: 'Gross Yield', value: `${grossYield.toFixed(2)}%`, neutral: true },
            {
              label: 'Monthly Cashflow',
              value: formatCurrency(monthlyCashflow),
              positive: monthlyCashflow >= 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm"
            >
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p
                className={`text-base font-bold ${
                  stat.neutral
                    ? 'text-slate-900'
                    : stat.positive
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={getRecommendation}
        loading={loading}
        disabled={!purchasePrice || !weeklyRent}
        size="md"
        className="w-full sm:w-auto"
      >
        Get AI Recommendation
      </Button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-slate-500 text-sm">
          <span className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full" />
          Claude is evaluating this purchase…
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Recommendation banner */}
          <div
            className={`rounded-xl border-2 p-5 flex flex-col sm:flex-row items-center gap-4 ${
              result.recommendation === 'buy'
                ? 'bg-green-50 border-green-300'
                : result.recommendation === 'consider'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-red-50 border-red-300'
            }`}
          >
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                AI Recommendation
              </p>
              <Badge
                variant={recommendationVariant(result.recommendation)}
                className="text-base px-4 py-1 uppercase"
              >
                {result.recommendation}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Confidence</p>
              <p className="text-3xl font-bold text-slate-900">{result.confidence}%</p>
            </div>
          </div>

          {/* Pros & Cons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card title="Pros">
              <ul className="space-y-2">
                {result.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="shrink-0 text-green-600 font-bold mt-0.5">✓</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Cons">
              <ul className="space-y-2">
                {result.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="shrink-0 text-red-500 font-bold mt-0.5">✗</span>
                    {con}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Summary */}
          <Card title="AI Summary">
            <p className="text-sm text-slate-700 leading-relaxed">{result.ai_summary}</p>
          </Card>
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');

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
