import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function Card({ title, subtitle, children, className, headerAction }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-slate-200', className)}>
      {(title || subtitle || headerAction) && (
        <div className="flex items-start justify-between p-6 pb-0">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="ml-4 shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={cn(title || subtitle || headerAction ? 'p-6 pt-4' : 'p-6')}>
        {children}
      </div>
    </div>
  );
}
