'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const Spinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
    <div className="animate-spin h-10 w-10 border-[3px] border-slate-400 border-t-white rounded-full" />
  </div>
);

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    const errorParam = searchParams.get('error');
    const redirectTo = type === 'recovery' ? '/auth/reset-password' : '/dashboard';

    if (errorParam) {
      router.replace('/login?error=callback_failed');
      return;
    }

    if (code) {
      // PKCE flow — exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          router.replace('/login?error=callback_failed');
        } else {
          router.replace(redirectTo);
        }
      });
      return;
    }

    // Implicit flow — Supabase processes the hash fragment automatically.
    // Listen for auth state change and redirect once session is confirmed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        router.replace(redirectTo);
      } else if (event === 'INITIAL_SESSION') {
        if (session) {
          subscription.unsubscribe();
          router.replace(redirectTo);
        } else {
          subscription.unsubscribe();
          router.replace('/login');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router, searchParams]);

  return <Spinner />;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
