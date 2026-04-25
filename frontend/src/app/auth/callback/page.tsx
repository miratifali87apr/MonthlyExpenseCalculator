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
    const type = searchParams.get('type'); // 'recovery' for password reset emails

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          router.replace('/login?error=callback_failed');
          return;
        }
        if (type === 'recovery') {
          router.replace('/auth/reset-password');
        } else {
          router.replace('/dashboard');
        }
      });
    } else {
      router.replace('/login');
    }
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
