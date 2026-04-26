'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';

export function usePlan() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    staleTime: 5 * 60 * 1000, // cache for 5 mins
  });

  return {
    plan: user?.plan ?? 'free',
    isPro: user?.plan === 'pro',
    isLoading,
    user,
  };
}
