import { Clock, RefreshCw, Mail, Calendar } from 'lucide-react';
import type { EmailJob } from '../types';
import { StatusBadge } from './StatusBadge';
import { TableSkeleton } from './Loader';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

interface ScheduledEmailsTableProps {
  jobs: EmailJob[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  onComposeClick: () => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  jobs,
  isLoading,
  onRefresh,
  onComposeClick,
}) => {
  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (!jobs || jobs.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-10 w-10 text-indigo-400 stroke-[1.5]" />}
        title="No scheduled emails queued"
        description="All pending BullMQ jobs with countdown timers and scheduled release times will appear here."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={onComposeClick}
            leftIcon={<Mail className="h-4 w-4" />}
          >
            Compose New Email
          </Button>
        }
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0F1422]/70 backdrop-blur-md overflow-hidden shadow-xl">
      {/* Table toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pending Queue
          </span>
          <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-400">
            {jobs.length} scheduled
          </span>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition py-1 px-2.5 rounded-lg hover:bg-slate-800/60"
          title="Refresh queue"
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
                Scheduled Time
              </th>
              <th scope="col" className="px-6 py-3.5">
                Rate Limit & Delay
              </th>
              <th scope="col" className="px-6 py-3.5">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-normal">
            {jobs.map((job) => {
              const scheduledDate = new Date(job.scheduledAt);
              const isPast = scheduledDate.getTime() <= Date.now();

              return (
                <tr
                  key={job.id}
                  className="hover:bg-slate-800/40 transition-colors duration-100 group"
                >
                  {/* Recipient */}
                  <td className="px-6 py-4 font-mono font-medium text-slate-100 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-400" />
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

                  {/* Scheduled Time */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-200">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{scheduledDate.toLocaleTimeString()}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {scheduledDate.toLocaleDateString()} {isPast ? '(Executing now)' : ''}
                    </span>
                  </td>

                  {/* Delay & Rate Limit */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-slate-300">
                      <span>Delay: {(job.delayMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Max: {job.hourlyLimit} / hr
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={job.status} />
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

export default ScheduledEmailsTable;
