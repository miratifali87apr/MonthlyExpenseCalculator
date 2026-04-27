import Link from 'next/link';
import { Check, X, Sparkles, DollarSign, ArrowLeft } from 'lucide-react';

const FREE_FEATURES = [
  'Up to 2 properties',
  'Bills & payments tracking',
  'Auto Bills (recurring)',
  'Income tracking',
  'Export to CSV',
  'Mobile app access',
];

const FREE_NO = [
  'AI PM Statement Upload',
  'AI Portfolio Analysis',
  'AI Purchase Predictor',
  'Monthly cashflow email report',
  'Tax year summary export',
  'Unlimited properties',
];

const PRO_FEATURES = [
  'Unlimited properties',
  'Bills & payments tracking',
  'Auto Bills (recurring)',
  'Income tracking',
  'Export to CSV',
  'Mobile app access',
  'AI PM Statement Upload',
  'AI Portfolio Analysis',
  'AI Purchase Predictor',
  'Monthly cashflow email report',
  'Tax year summary export',
  'Priority support',
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Nav */}
      <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">CashflowWise</span>
        </div>
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center px-4 pt-8 pb-14">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium text-slate-300 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Simple, transparent pricing
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Start free. Upgrade when ready.
        </h1>
        <p className="text-slate-400 text-base max-w-md mx-auto">
          All the tools Australian property investors need to track cashflow, manage bills, and make smarter decisions.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="max-w-4xl mx-auto px-4 pb-20 grid md:grid-cols-2 gap-6">

        {/* Free */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Free</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-slate-400 mb-1.5">/month</span>
            </div>
            <p className="text-slate-400 text-sm">Get started with the core tools. No credit card needed.</p>
          </div>

          <Link
            href="/login"
            className="block text-center border border-white/20 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors mb-7"
          >
            Get started free
          </Link>

          <ul className="space-y-3 flex-1">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                {f}
              </li>
            ))}
            {FREE_NO.map(f => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-500">
                <X className="w-4 h-4 text-slate-600 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="bg-gradient-to-br from-violet-600/30 to-purple-700/30 border-2 border-violet-500/50 rounded-2xl p-7 flex flex-col relative overflow-hidden">
          {/* Popular badge */}
          <div className="absolute top-4 right-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
            Most Popular
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-2">Pro</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">$19</span>
              <span className="text-slate-300 mb-1.5">/month</span>
            </div>
            <p className="text-slate-300 text-sm">Everything in Free, plus AI features and full reporting.</p>
          </div>

          <a
            href="mailto:hello@financetracker.com.au?subject=Pro Plan Upgrade"
            className="block text-center bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/50 mb-7"
          >
            Upgrade to Pro
          </a>

          <ul className="space-y-3 flex-1">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-200">
                <Check className="w-4 h-4 text-violet-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* FAQ / trust */}
      <div className="max-w-2xl mx-auto px-4 pb-20 text-center">
        <p className="text-slate-500 text-sm">
          Questions? Email us at{' '}
          <a href="mailto:hello@financetracker.com.au" className="text-slate-300 hover:text-white transition-colors underline underline-offset-2">
            hello@financetracker.com.au
          </a>
        </p>
        <p className="text-slate-600 text-xs mt-4">
          256-bit encrypted · Your data is never sold · Cancel anytime
        </p>
      </div>
    </div>
  );
}
