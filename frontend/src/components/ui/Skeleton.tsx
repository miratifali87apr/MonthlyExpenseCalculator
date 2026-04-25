import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-slate-200', className)} style={style} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 shadow-sm">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <Skeleton className="h-4 w-32 mb-4" />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-slate-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${[15, 25, 15, 12, 18][i] ?? 15}%` }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 rounded" style={{ width: `${[15, 25, 15, 12, 18][j] ?? 15}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <Skeleton className="h-1.5 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-6 w-20 ml-auto" />
                <Skeleton className="h-3 w-14 ml-auto" />
              </div>
            </div>
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Skeleton className="h-3 w-12" />
              <div className="ml-auto flex gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
