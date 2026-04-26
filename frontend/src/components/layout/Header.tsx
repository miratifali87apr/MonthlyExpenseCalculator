'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { expensesApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/expenses': 'Bills & Payments',
  '/income': 'Income',
  '/properties': 'My Properties',
  '/recurring': 'Auto Bills',
  '/insights': 'Insights',
};

type AlertState = {
  type: 'success' | 'error';
  message: string;
} | null;

export function Header() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const pageTitle = PAGE_TITLES[pathname] || 'Finance Tracker';
  const currentMonthYear = dayjs().format('MMMM YYYY');

  async function handleGenerateBills() {
    setIsGenerating(true);
    setAlert(null);
    try {
      const result = await expensesApi.generateUpcoming();
      setAlert({
        type: 'success',
        message: `Generated ${result.generated} upcoming bill${result.generated !== 1 ? 's' : ''} successfully.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => setAlert(null), 4000);
    } catch {
      setAlert({
        type: 'error',
        message: 'Failed to generate bills. Please try again.',
      });
      setTimeout(() => setAlert(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900 truncate">{pageTitle}</h1>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {alert && (
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                alert.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {alert.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {alert.message}
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 text-sm text-slate-500">
            <Calendar size={15} />
            <span>{currentMonthYear}</span>
          </div>

          <Button
            size="sm"
            onClick={handleGenerateBills}
            loading={isGenerating}
            className="gap-1.5"
          >
            <Zap size={14} />
            <span className="hidden md:inline">Sync Bills</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
