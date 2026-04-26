'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Home,
  RefreshCw,
  DollarSign,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { ProBadge } from '@/components/ui/ProGate';
import { usePlan } from '@/hooks/usePlan';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/expenses', label: 'Bills & Payments', icon: CreditCard },
  { href: '/income', label: 'Income', icon: TrendingUp },
  { href: '/properties', label: 'My Properties', icon: Home },
  { href: '/recurring', label: 'Auto Bills', icon: RefreshCw },
  { href: '/insights', label: 'Insights', icon: Sparkles },
];

interface SidebarProps {
  userEmail?: string;
  userName?: string;
}

export function Sidebar({ userEmail, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPro } = usePlan();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 flex-col h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
          <DollarSign className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm leading-tight">
          Finance<br />Tracker
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
              {item.href === '/insights' && !isPro && <ProBadge />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
            <User size={14} className="text-slate-300" />
          </div>
          <div className="min-w-0 flex-1">
            {userName && (
              <p className="text-white text-xs font-medium truncate">{userName}</p>
            )}
            {userEmail && (
              <p className="text-slate-400 text-xs truncate">{userEmail}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}
