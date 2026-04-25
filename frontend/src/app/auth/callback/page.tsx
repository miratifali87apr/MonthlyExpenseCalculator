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
      // PKCE flow: Supabase auto-exchanges the code (detectSessionInUrl=true).
      // INITIAL_SESSION fires null while exchange is still in progress — ignore it.
      // Only act on SIGNED_IN which fires after the exchange succeeds.
      let done = false;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (done) return;
        if (event === 'SIGNED_IN' && session) {
          done = true;
          subscription.unsubscribe();
          router.replace(redirectTo);
        }
      });

      // Fallback: if SIGNED_IN never fires, exchange manually after 1s
      const fallback = setTimeout(() => {
        if (done) return;
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (done) return;
          done = true;
          subscription.unsubscribe();
          router.replace(error ? '/login?error=callback_failed' : redirectTo);
        });
      }, 1500);

      return () => {
        clearTimeout(fallback);
        subscription.unsubscribe();
      };
    }

    // No code — check for existing session (e.g. already signed in or hash fragment)
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? redirectTo : '/login');
    });
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
