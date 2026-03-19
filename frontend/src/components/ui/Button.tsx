import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: 'bg-slate-800 hover:bg-slate-700 text-white focus:ring-slate-500',
      secondary:
        'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-slate-400',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      ghost: 'hover:bg-slate-100 text-slate-700 focus:ring-slate-400',
      success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
      info: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full shrink-0" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export { Button };
