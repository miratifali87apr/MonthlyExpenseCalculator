'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const [isChecking, setIsChecking] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);

  // Warm up the Render backend immediately on mount — it sleeps after inactivity
  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`).catch(() => {});
  }, []);

  // Show "warming up" message if auth check takes > 5s (backend cold start)
  useEffect(() => {
    if (!isChecking) return;
    const timer = setTimeout(() => setSlowLoad(true), 5000);
    return () => clearTimeout(timer);
  }, [isChecking]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) {
          router.replace('/login');
        } else {
          setUserEmail(session.user.email ?? undefined);
          setUserName(session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0]);
          setIsChecking(false);
        }
      } else if (event === 'SIGNED_OUT') {
        router.replace('/login');
      } else if (event === 'SIGNED_IN' && session) {
        setUserEmail(session.user.email ?? undefined);
        setUserName(session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0]);
        setIsChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin h-10 w-10 border-[3px] border-slate-300 border-t-slate-700 rounded-full" />
        {slowLoad && (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Warming up server…</p>
            <p className="text-xs text-slate-400 mt-1">First load can take up to 30 seconds</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={userEmail} userName={userName} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-slate-50 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
      <MobileNav onLogout={handleLogout} />
    </div>
  );
}
