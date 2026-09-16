import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  isMonospace?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightAction,
      isMonospace = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-white dark:bg-slate-950 border ${
              error
                ? 'border-red-500/60 focus:border-red-500'
                : 'border-slate-300 dark:border-slate-800 focus:border-emerald-500'
            } rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 ${
              error ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
            } transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightAction ? 'pr-12' : ''} ${isMonospace ? 'font-mono' : 'font-sans'} ${className}`}
            {...props}
          />

          {rightAction && (
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
              {rightAction}
            </div>
          )}
        </div>

        {error && <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-slate-500 dark:text-slate-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
