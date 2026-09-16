import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isMonospace?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, isMonospace = false, className = '', id, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`w-full bg-white dark:bg-slate-950 border ${
            error
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-slate-300 dark:border-slate-800 focus:border-emerald-500'
          } rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 ${
            error ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
          } transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none leading-relaxed ${
            isMonospace ? 'font-mono' : 'font-sans'
          } ${className}`}
          {...props}
        />

        {error && <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-slate-500 dark:text-slate-400">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
