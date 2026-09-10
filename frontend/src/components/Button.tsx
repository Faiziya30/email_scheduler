import React from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:bg-indigo-700 focus-visible:ring-indigo-500',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80 active:bg-slate-750 focus-visible:ring-slate-500',
  outline:
    'bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700 hover:border-slate-600 active:bg-slate-800 focus-visible:ring-slate-500',
  ghost:
    'bg-transparent hover:bg-slate-800/80 text-slate-300 hover:text-white focus-visible:ring-slate-500',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:bg-rose-700 focus-visible:ring-rose-500',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl font-semibold',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  leftIcon,
  rightIcon,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || isLoading}
    className={clsx(
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
      'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      className,
    )}
  >
    {isLoading ? (
      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
    ) : (
      leftIcon
    )}
    {children}
    {!isLoading && rightIcon}
  </button>
);

export default Button;
