'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';

interface ProGateProps {
  children: React.ReactNode;
  feature?: string;
}

export function ProGate({ children, feature = 'This feature' }: ProGateProps) {
  const { isPro, isLoading } = usePlan();

  if (isLoading) return <>{children}</>;
  if (isPro) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-8 py-6 text-center max-w-xs mx-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl mb-3">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Pro Feature</h3>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            {feature} is available on the Pro plan. Upgrade to unlock AI-powered insights.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-purple-200"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Pro
          </Link>
          <p className="text-xs text-slate-400 mt-3">$19/month · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

// Inline badge for nav items
export function ProBadge() {
  return (
    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full">
      Pro
    </span>
  );
}
