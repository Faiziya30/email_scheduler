import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Inbox, Send, AlertTriangle } from 'lucide-react';
import { emailApi } from '../api';
import type { EmailJob } from '../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';

interface Props {
  mode: 'scheduled' | 'sent';
}

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const EmptyState: React.FC<{ mode: Props['mode'] }> = ({ mode }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
    {mode === 'scheduled' ? (
      <Inbox className="h-10 w-10 opacity-30" />
    ) : (
      <Send className="h-10 w-10 opacity-30" />
    )}
    <p className="text-sm">
      {mode === 'scheduled' ? 'No scheduled emails yet.' : 'No emails sent yet.'}
    </p>
  </div>
);

export const EmailList: React.FC<Props> = ({ mode }) => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [mode],
    queryFn: () => (mode === 'scheduled' ? emailApi.scheduled() : emailApi.sent()),
    refetchInterval: mode === 'scheduled' ? 10_000 : false, // auto-refresh pending list every 10s
  });

  const emails: EmailJob[] = data?.data ?? [];

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          {mode === 'scheduled' ? (
            <Inbox className="h-4 w-4 text-amber-400" />
          ) : (
            <Send className="h-4 w-4 text-emerald-400" />
          )}
          {mode === 'scheduled' ? 'Scheduled' : 'Sent / Failed'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          id={`refresh-${mode}`}
          onClick={() => refetch()}
          isLoading={isFetching}
          className="gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-14 text-rose-400 text-sm">
            <AlertTriangle className="h-7 w-7 opacity-60" />
            Failed to load emails. Is the backend running?
          </div>
        ) : emails.length === 0 ? (
          <EmptyState mode={mode} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Recipient</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Subject</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">
                  {mode === 'scheduled' ? 'Scheduled At' : 'Sent At'}
                </th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Sender</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((job, i) => (
                <tr
                  key={job.id}
                  className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                    i === emails.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3.5 text-slate-200 font-mono text-xs max-w-[160px] truncate">
                    {job.recipient}
                  </td>
                  <td className="px-4 py-3.5 text-slate-300 max-w-[200px] truncate hidden sm:table-cell">
                    {job.subject}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap hidden md:table-cell">
                    {mode === 'scheduled' ? fmt(job.scheduledAt) : fmt(job.sentAt)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 font-mono text-xs hidden lg:table-cell">
                    {job.sender?.emailAddress ?? '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={job.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
