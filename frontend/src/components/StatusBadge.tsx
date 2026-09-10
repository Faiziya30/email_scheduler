import React from 'react';
import { clsx } from 'clsx';
import type { EmailStatus } from '../types';

interface StatusBadgeProps {
  status: EmailStatus;
  className?: string;
}

const config: Record<EmailStatus, { label: string; classes: string; dot: string }> = {
  PENDING: {
    label: 'Scheduled',
    classes: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30',
    dot: 'bg-amber-400 animate-pulse',
  },
  SENT: {
    label: 'Sent',
    classes: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  FAILED: {
    label: 'Failed',
    classes: 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const { label, classes, dot } = config[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        classes,
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
};
