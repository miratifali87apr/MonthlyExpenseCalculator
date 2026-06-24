'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CreditCard, TrendingUp, Home, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard',  label: 'Overview',   icon: LayoutDashboard },
  { href: '/expenses',   label: 'Bills',      icon: CreditCard },
  { href: '/income',     label: 'Income',     icon: TrendingUp },
  { href: '/properties', label: 'Properties', icon: Home },
  { href: '/insights',   label: 'Insights',   icon: Sparkles },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
              isActive ? 'text-white' : 'text-slate-500'
            )}
          >
            <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
