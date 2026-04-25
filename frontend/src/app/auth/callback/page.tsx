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
    const type = searchParams.get('type');
    const errorParam = searchParams.get('error');
    const redirectTo = type === 'recovery' ? '/auth/reset-password' : '/dashboard';

    if (errorParam) {
      router.replace('/login?error=callback_failed');
      return;
    }

    // Implicit flow: Supabase detects the #access_token hash and fires SIGNED_IN.
    // Wait for that event, then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        router.replace(redirectTo);
      } else if (event === 'INITIAL_SESSION' && session) {
        subscription.unsubscribe();
        router.replace(redirectTo);
      }
    });

    // Fallback: if no auth event fires within 5s, check session directly
    const fallback = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      subscription.unsubscribe();
      router.replace(session ? redirectTo : '/login');
    }, 5000);

    return () => {
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
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
