import { RefreshCw, CheckCircle, ExternalLink } from 'lucide-react';
import type { EmailJob } from '../types';
import { StatusBadge } from './StatusBadge';
import { TableSkeleton } from './Loader';
import { EmptyState } from './EmptyState';

interface SentEmailsTableProps {
  jobs: EmailJob[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  jobs,
  isLoading,
  onRefresh,
}) => {
  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (!jobs || jobs.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="h-10 w-10 text-emerald-400 stroke-[1.5]" />}
        title="No sent emails yet"
        description="Delivered emails with Ethereal SMTP delivery receipts and status outcomes will appear here."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0F1422]/70 backdrop-blur-md overflow-hidden shadow-xl">
      {/* Table toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Delivery History
          </span>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
            {jobs.length} processed
          </span>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition py-1 px-2.5 rounded-lg hover:bg-slate-800/60"
          title="Refresh history"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase font-semibold tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3.5">
                Recipient Email
              </th>
              <th scope="col" className="px-6 py-3.5">
                Subject
              </th>
              <th scope="col" className="px-6 py-3.5">
                Sent At / Timestamp
              </th>
              <th scope="col" className="px-6 py-3.5">
                Status
              </th>
              <th scope="col" className="px-6 py-3.5 text-right">
                Delivery Receipt
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-normal">
            {jobs.map((job) => {
              const sentDate = job.sentAt ? new Date(job.sentAt) : new Date(job.scheduledAt);
              const isSuccess = job.status === 'SENT';

              return (
                <tr
                  key={job.id}
                  className="hover:bg-slate-800/40 transition-colors duration-100 group"
                >
                  {/* Recipient */}
                  <td className="px-6 py-4 font-mono font-medium text-slate-100 flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isSuccess ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    <span>{job.recipient}</span>
                  </td>

                  {/* Subject */}
                  <td className="px-6 py-4 max-w-xs">
                    <span className="font-medium text-slate-200 block truncate" title={job.subject}>
                      {job.subject}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                      {job.body.replace(/<[^>]*>?/gm, '')}
                    </span>
                  </td>

                  {/* Sent Time */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-slate-200">
                      {sentDate.toLocaleTimeString()}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {sentDate.toLocaleDateString()}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={job.status} />
                  </td>

                  {/* Receipt link */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <a
                      href="https://ethereal.email/messages"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1 px-2 rounded hover:bg-indigo-500/10 transition"
                      title="View inbox on Ethereal Mail"
                    >
                      <span>Ethereal Mail</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SentEmailsTable;
