import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'line' | 'telegram';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  pulse = false,
  className = '',
  ...props
}) => {
  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    info: 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    line: 'bg-[#06C755]/10 dark:bg-[#06C755]/15 text-[#06C755] border-[#06C755]/30',
    telegram: 'bg-[#229ED9]/10 dark:bg-[#229ED9]/15 text-[#229ED9] border-[#229ED9]/30',
  };

  const dotColors: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-red-500 dark:bg-red-400',
    info: 'bg-sky-500 dark:bg-sky-400',
    neutral: 'bg-slate-500 dark:bg-slate-400',
    line: 'bg-[#06C755]',
    telegram: 'bg-[#229ED9]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      {children}
    </span>
  );
};
