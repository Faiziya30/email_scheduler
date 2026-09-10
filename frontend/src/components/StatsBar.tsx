import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Send, Clock, Activity } from 'lucide-react';
import { getScheduledEmails, getSentEmails } from '../api/emails';
import type { EmailJob } from '../types';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub, color }) => (
  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex items-start gap-3.5 shadow-sm">
    <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  </div>
);

export const StatsBar: React.FC = () => {
  const { data: scheduled = [] } = useQuery<EmailJob[]>({
    queryKey: ['emails', 'scheduled'],
    queryFn: () => getScheduledEmails(500),
    refetchInterval: 10_000,
  });

  const { data: sentAll = [] } = useQuery<EmailJob[]>({
    queryKey: ['emails', 'sent'],
    queryFn: () => getSentEmails(500),
    refetchInterval: 10_000,
  });

  const sent = sentAll.filter((j: EmailJob) => j.status === 'SENT');
  const failed = sentAll.filter((j: EmailJob) => j.status === 'FAILED');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Clock className="h-4 w-4 text-indigo-400" />}
        label="Scheduled"
        value={scheduled.length}
        sub="pending delivery"
        color="bg-indigo-500/10"
      />
      <StatCard
        icon={<Send className="h-4 w-4 text-emerald-400" />}
        label="Delivered"
        value={sent.length}
        sub="delivered successfully"
        color="bg-emerald-500/10"
      />
      <StatCard
        icon={<Activity className="h-4 w-4 text-rose-400" />}
        label="Failed"
        value={failed.length}
        sub="delivery errors"
        color="bg-rose-500/10"
      />
      <StatCard
        icon={<Mail className="h-4 w-4 text-indigo-400" />}
        label="Total Processed"
        value={scheduled.length + sentAll.length}
        sub="across all campaigns"
        color="bg-indigo-500/10"
      />
    </div>
  );
};

export default StatsBar;
