import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const labelClass = 'block text-xs font-medium text-slate-400 mb-1.5';
const fieldClass =
  'w-full rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...rest }, ref) => (
    <div className="flex flex-col gap-0">
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={clsx(fieldClass, error && 'border-rose-500', className)}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...rest }, ref) => (
    <div className="flex flex-col gap-0">
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        ref={ref}
        rows={4}
        className={clsx(fieldClass, 'resize-none', error && 'border-rose-500', className)}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';
