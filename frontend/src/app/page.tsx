import Link from 'next/link';
import {
  DollarSign, BarChart3, Brain, FileText, ArrowRight,
  Check, Shield, Zap, Building2, TrendingUp, Receipt,
  ChevronRight, Star,
} from 'lucide-react';

// ─── Section: Nav ─────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">CashflowWise</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-300 hover:text-white transition-colors hidden sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
          >
            Get started free
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Section: Hero ────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-slate-950">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[80px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-32">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-violet-300 text-xs font-semibold tracking-wide uppercase">Built for Australian property investors</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Know your cashflow{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              before your accountant does.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl">
            Track every property bill, see your net cashflow at a glance, and let AI pull data straight from your PM statements. No spreadsheets. No surprises.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all shadow-lg shadow-violet-900/40"
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 font-semibold px-7 py-3.5 rounded-xl text-base transition-all"
            >
              View pricing
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" /> Free to start — no credit card
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" /> Properties + personal bills
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" /> Australian tax categories
            </span>
          </div>
        </div>

        {/* Dashboard preview card */}
        <div className="mt-16 sm:mt-20 relative">
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-sm shadow-2xl shadow-black/50">
            {/* Mini dashboard preview */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-slate-500 text-xs">cashflowwise.com.au/dashboard</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Monthly Expenses', value: '$4,820', color: 'text-rose-400' },
                { label: 'Rental Income', value: '$6,240', color: 'text-emerald-400' },
                { label: 'Net Cashflow', value: '+$1,420', color: 'text-violet-400' },
                { label: 'Bills Due', value: '3 pending', color: 'text-amber-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800/60 rounded-xl p-3 border border-white/5">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Loan Repayment', 'Council Rates', 'PM Management Fee', 'Insurance', 'Water Bill', 'Maintenance'].map((name, i) => (
                <div key={name} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 border border-white/5">
                  <span className="text-xs text-slate-400 truncate">{name}</span>
                  <span className={`text-xs font-semibold ml-1 shrink-0 ${i === 0 ? 'text-emerald-400' : i === 3 ? 'text-slate-500' : 'text-slate-400'}`}>
                    {i === 0 ? 'Paid' : i === 3 ? 'Reserved' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Glow under the card */}
          <div className="absolute -bottom-10 inset-x-20 h-20 bg-violet-600/20 blur-2xl rounded-full" />
        </div>
      </div>
    </section>
  );
}

// ─── Section: Features ────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: <Building2 className="w-6 h-6" />,
      color: 'from-violet-500 to-indigo-500',
      title: 'Property Cashflow at a glance',
      description: 'See gross rent, PM fees, and net to owner side-by-side for every investment property. Know your real numbers, not the numbers your PM tells you.',
      points: ['Gross rent vs. PM fees vs. net', 'PPOR and Investment property types', 'Fixed costs vs rental income'],
    },
    {
      icon: <Brain className="w-6 h-6" />,
      color: 'from-purple-500 to-violet-500',
      title: 'AI reads your PM statements',
      description: 'Upload your property manager\'s PDF statement and AI extracts every line item automatically — maintenance, letting fees, repairs — all categorised.',
      points: ['PDF upload, zero typing', 'Auto-categorises expenses', 'Letting fees, maintenance, repairs'],
    },
    {
      icon: <Receipt className="w-6 h-6" />,
      color: 'from-indigo-500 to-blue-500',
      title: 'Auto Bills & recurring expenses',
      description: 'Set up your loan repayments, insurance, and council rates once. CashflowWise auto-generates them every month, quarter, or year.',
      points: ['Weekly, fortnightly, monthly, quarterly', 'Bulk mark paid in one tap', 'Reserve funds ahead of due date'],
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'from-emerald-500 to-teal-500',
      title: 'Income tracking built in',
      description: 'Track salary, rental income, and reimbursements together. See what\'s coming in vs. going out — all in one place.',
      points: ['Salary, rental, reimbursements', 'Reimbursement pending/received status', 'Monthly cashflow summary'],
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'from-amber-500 to-orange-500',
      title: 'Insights & tax-ready reports',
      description: 'Export to Excel or CSV for your accountant. Insights page shows AI-driven analysis of your portfolio with ATO-ready categories.',
      points: ['Excel & CSV export', 'ATO-relevant expense categories', 'AI portfolio analysis (Pro)'],
    },
    {
      icon: <Shield className="w-6 h-6" />,
      color: 'from-rose-500 to-pink-500',
      title: 'Secure & Australian',
      description: 'Your data is encrypted and stored securely. Australian dollar. Australian tax categories. Built for the ATO, not the IRS.',
      points: ['Supabase auth — Google sign-in', '256-bit encryption', 'AUD-native, AU tax categories'],
    },
  ];

  return (
    <section id="features" className="bg-slate-950 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-slate-400 text-xs font-semibold tracking-wide uppercase">Everything you need</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Stop guessing. Start knowing.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Every tool an Australian property investor needs — and none of the ones they don&apos;t.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon, color, title, description, points }) => (
            <div
              key={title}
              className="group bg-slate-900/60 border border-white/8 rounded-2xl p-6 hover:border-white/15 hover:bg-slate-900/80 transition-all"
            >
              <div className={`inline-flex items-center justify-center w-11 h-11 bg-gradient-to-br ${color} rounded-xl mb-4 text-white`}>
                {icon}
              </div>
              <h3 className="text-white font-bold text-base mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{description}</p>
              <ul className="space-y-1.5">
                {points.map(p => (
                  <li key={p} className="flex items-center gap-2 text-xs text-slate-500">
                    <ChevronRight className="w-3 h-3 text-violet-500 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: How it works ────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Sign up free with Google',
      body: 'One tap with your Google account. No forms, no credit card, no waiting. You\'re in your dashboard in 10 seconds.',
    },
    {
      n: '02',
      title: 'Add your properties & bills',
      body: 'Add investment properties or your PPOR. Set up recurring bills once and they auto-generate every month. Upload PM statements for instant data.',
    },
    {
      n: '03',
      title: 'See your real cashflow',
      body: 'Dashboard shows net cashflow, upcoming bills, and portfolio summary. Mark bills paid as you go. Export for your accountant at tax time.',
    },
  ];

  return (
    <section id="how-it-works" className="bg-slate-900 py-24 sm:py-32 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Up and running in minutes.
          </h2>
          <p className="text-slate-400 text-lg">No setup fee. No onboarding call. Just sign in and go.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
          {steps.map(({ n, title, body }) => (
            <div key={n} className="relative">
              <div className="text-6xl font-black text-white/5 mb-4 leading-none">{n}</div>
              <div className="absolute top-2 left-0 w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">{parseInt(n)}</span>
              </div>
              <div className="ml-2 pt-1">
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Pricing teaser ──────────────────────────────────────────────────
function PricingTeaser() {
  return (
    <section className="bg-slate-950 py-24 sm:py-32 border-t border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-900 border border-white/10 rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden">
          {/* Glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-600/15 rounded-full blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Free to start.<br />Upgrade when you&apos;re ready.
            </h2>
            <p className="text-slate-400 text-base mb-8 max-w-lg mx-auto">
              The free plan covers up to 2 properties with full bill and income tracking. Pro unlocks AI, unlimited properties, and tax-year exports for $19/month.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-900/40"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 border border-white/15 text-slate-300 hover:text-white hover:border-white/25 font-semibold px-8 py-3.5 rounded-xl transition-all"
              >
                Compare plans
              </Link>
            </div>

            <p className="text-slate-600 text-xs">No credit card required · Cancel anytime · 256-bit encrypted</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Footer ──────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/5 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-md flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-white" />
            </div>
            <span className="text-white font-bold text-sm">CashflowWise</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <Link href="/pricing" className="hover:text-slate-400 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-slate-400 transition-colors">Sign in</Link>
            <a href="mailto:hello@financetracker.com.au" className="hover:text-slate-400 transition-colors">Contact</a>
          </div>
          <p className="text-slate-700 text-xs">© 2025 CashflowWise · Australia</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="bg-slate-950">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingTeaser />
      <Footer />
    </div>
  );
}
