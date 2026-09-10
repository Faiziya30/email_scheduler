import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Send,
  Plus,
  Activity,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { ScheduledEmailsTable } from '../components/ScheduledEmailsTable';
import { SentEmailsTable } from '../components/SentEmailsTable';
import { SearchBox } from '../components/SearchBox';
import { ComposeModal } from '../components/ComposeModal';
import { getScheduledEmails, getSentEmails, getSlackStatus, getSlackConnectUrl } from '../api/emails';

type TabType = 'scheduled' | 'sent';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // ── Scheduled Emails Query (auto-polls every 4 seconds) ───────────────────
  const {
    data: scheduledJobs,
    isLoading: isScheduledLoading,
    refetch: refetchScheduled,
  } = useQuery({
    queryKey: ['emails', 'scheduled'],
    queryFn: () => getScheduledEmails(100),
    refetchInterval: 4000,
  });

  // ── Sent Emails Query (auto-polls every 5 seconds) ────────────────────────
  const {
    data: sentJobs,
    isLoading: isSentLoading,
    refetch: refetchSent,
  } = useQuery({
    queryKey: ['emails', 'sent'],
    queryFn: () => getSentEmails(100),
    refetchInterval: 5000,
  });

  // ── Slack Status Query ───────────────────────────────────────────────────
  const { data: slackStatus } = useQuery({
    queryKey: ['slack', 'status'],
    queryFn: getSlackStatus,
    staleTime: 60_000,
  });

  const scheduledCount = scheduledJobs?.length ?? 0;
  const sentCount = sentJobs?.filter((j) => j.status === 'SENT').length ?? 0;
  const failedCount = sentJobs?.filter((j) => j.status === 'FAILED').length ?? 0;

  const handleScheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
    queryClient.invalidateQueries({ queryKey: ['emails', 'sent'] });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Email Outreach & Scheduler
              <span className="text-xs font-semibold py-0.5 px-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                BullMQ Active
              </span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Welcome back,{' '}
              <span className="text-slate-200 font-medium">{user?.name || user?.email}</span>.
              Manage high-volume scheduled outreach with automated rate limiting.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Slack Connection Button */}
            {slackStatus?.connected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Slack Connected</span>
              </div>
            ) : (
              <a
                href={getSlackConnectUrl()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4A154B]/30 hover:bg-[#4A154B]/50 border border-[#E01E5A]/40 text-xs font-medium text-slate-200 hover:text-white transition shadow-sm"
                title="Connect Slack to receive real-time rate limit notifications"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#E01E5A]" />
                <span>Connect Slack</span>
              </a>
            )}

            {/* Compose New Email Primary Action */}
            <Button
              id="dashboard-compose-btn"
              variant="primary"
              size="md"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsComposeOpen(true)}
              className="shadow-lg shadow-indigo-600/30 font-semibold"
            >
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-[#0F1422]/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Scheduled Queue</span>
              <Clock className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{scheduledCount}</p>
            <span className="text-[11px] text-slate-500">Delayed BullMQ jobs</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0F1422]/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Delivered</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-400">{sentCount}</p>
            <span className="text-[11px] text-slate-500">Sent via Ethereal SMTP</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0F1422]/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Failed</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-400">{failedCount}</p>
            <span className="text-[11px] text-slate-500">Delivery exceptions</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0F1422]/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Rate Limiter</span>
              <Activity className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-200">Redis Sliding Cap</p>
            <span className="text-[11px] text-amber-400/80">Auto-rescheduling active</span>
          </div>
        </div>

        {/* Tab Navigation & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          {/* Tabs */}
          <nav className="-mb-3 flex space-x-6" aria-label="Campaign tabs">
            <button
              id="tab-scheduled"
              role="tab"
              aria-selected={activeTab === 'scheduled'}
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'scheduled'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Scheduled Emails</span>
              <span
                className={`ml-1 rounded-full py-0.5 px-2 text-xs font-semibold ${
                  activeTab === 'scheduled'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {scheduledCount}
              </span>
            </button>

            <button
              id="tab-sent"
              role="tab"
              aria-selected={activeTab === 'sent'}
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'sent'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>Sent Emails</span>
              <span
                className={`ml-1 rounded-full py-0.5 px-2 text-xs font-semibold ${
                  activeTab === 'sent'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {sentCount + failedCount}
              </span>
            </button>
          </nav>

          {/* Search Box */}
          <SearchBox />
        </div>

        {/* Tab Content Tables */}
        <div>
          {activeTab === 'scheduled' ? (
            <ScheduledEmailsTable
              jobs={scheduledJobs}
              isLoading={isScheduledLoading}
              onRefresh={refetchScheduled}
              onComposeClick={() => setIsComposeOpen(true)}
            />
          ) : (
            <SentEmailsTable
              jobs={sentJobs}
              isLoading={isSentLoading}
              onRefresh={refetchSent}
            />
          )}
        </div>
      </div>

      {/* Compose & Schedule Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleScheduleSuccess}
      />
    </Layout>
  );
};

export default Dashboard;
