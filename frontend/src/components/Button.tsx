import React from 'react';
import { clsx } from 'clsx';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variants = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 focus-visible:ring-indigo-500',
  ghost:
    'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 focus-visible:ring-slate-500',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 focus-visible:ring-rose-500',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: React.FC<Props> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || isLoading}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
      'disabled:pointer-events-none disabled:opacity-40',
      variants[variant],
      sizes[size],
      className,
    )}
  >
    {isLoading && (
      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
    )}
    {children}
  </button>
);
