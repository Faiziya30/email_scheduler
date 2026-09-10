import React from 'react';
import { clsx } from 'clsx';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

const spinnerSizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
  xl: 'h-12 w-12 border-4',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  color = 'border-indigo-500',
}) => {
  return (
    <div
      role="status"
      aria-label="loading"
      className={clsx(
        'rounded-full border-t-transparent animate-spin inline-block',
        color,
        spinnerSizes[size],
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  circle = false,
  ...rest
}) => {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'animate-pulse bg-slate-800/80',
        circle ? 'rounded-full' : 'rounded-md',
        className
      )}
      {...rest}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-6 py-4 bg-slate-900/90">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
};

export default Spinner;
