import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Send, Clock, Activity } from 'lucide-react';
import { emailApi } from '../api';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex items-start gap-4">
    <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  </div>
);

export const StatsBar: React.FC = () => {
  const { data: scheduledData } = useQuery({
    queryKey: ['scheduled'],
    queryFn: () => emailApi.scheduled(500),
    refetchInterval: 10_000,
  });
  const { data: sentData } = useQuery({
    queryKey: ['sent'],
    queryFn: () => emailApi.sent(500),
  });

  const scheduled = scheduledData?.data ?? [];
  const sentAll = sentData?.data ?? [];
  const sent = sentAll.filter((j) => j.status === 'SENT');
  const failed = sentAll.filter((j) => j.status === 'FAILED');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Clock className="h-5 w-5 text-amber-400" />}
        label="Scheduled"
        value={scheduled.length}
        sub="pending delivery"
        color="bg-amber-500/10"
      />
      <StatCard
        icon={<Send className="h-5 w-5 text-emerald-400" />}
        label="Sent"
        value={sent.length}
        sub="delivered successfully"
        color="bg-emerald-500/10"
      />
      <StatCard
        icon={<Activity className="h-5 w-5 text-rose-400" />}
        label="Failed"
        value={failed.length}
        sub="delivery errors"
        color="bg-rose-500/10"
      />
      <StatCard
        icon={<Mail className="h-5 w-5 text-indigo-400" />}
        label="Total"
        value={scheduled.length + sentAll.length}
        sub="all time"
        color="bg-indigo-500/10"
      />
    </div>
  );
};
