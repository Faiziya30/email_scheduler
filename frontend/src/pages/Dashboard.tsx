import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Send,
  Search,
  Filter,
  RefreshCw,
  Star,
  MessageSquare,
  ExternalLink,
  LogOut,
  ChevronDown,
  CheckCircle2,
  X,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context';
import { useToast } from '../context/ToastContext';
import { ComposeModal } from '../components/ComposeModal';
import { EmailDetailModal } from '../components/EmailDetailModal';
import { getScheduledEmails, getSentEmails, searchEmails, deleteEmail, getSlackStatus, getSlackConnectUrl } from '../api/emails';
import type { EmailJob } from '../types';

type TabType = 'scheduled' | 'sent';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [slackJustConnected, setSlackJustConnected] = useState(false);
  const toast = useToast();

  // ── Scheduled Emails Query ───────────────────────────────────────────────
  const {
    data: scheduledJobs,
    isLoading: isScheduledLoading,
    refetch: refetchScheduled,
  } = useQuery({
    queryKey: ['emails', 'scheduled'],
    queryFn: () => getScheduledEmails(100),
    refetchInterval: 4000,
  });

  // ── Sent Emails Query ────────────────────────────────────────────────────
  const {
    data: sentJobs,
    isLoading: isSentLoading,
    refetch: refetchSent,
  } = useQuery({
    queryKey: ['emails', 'sent'],
    queryFn: () => getSentEmails(100),
    refetchInterval: 5000,
  });

  // ── Elasticsearch Search Query ───────────────────────────────────────────
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['emails', 'search', searchQuery],
    queryFn: () => searchEmails(searchQuery),
    enabled: searchQuery.trim().length > 1,
  });

  // ── Slack Status Query ───────────────────────────────────────────────────
  const { data: slackStatus, refetch: refetchSlack } = useQuery({
    queryKey: ['slack', 'status'],
    queryFn: getSlackStatus,
    refetchInterval: 10_000,
  });

  // Handle ?slack=connected redirect parameter from Slack OAuth
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') {
      // Show immediate success feedback
      setSlackJustConnected(true);
      toast.success(
        'Your Slack workspace is now connected! You will receive real-time rate-limit alerts in your Slack channel.',
        'Slack Connected Successfully'
      );
      refetchSlack();
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      // Auto-dismiss the banner after 8 seconds
      setTimeout(() => setSlackJustConnected(false), 8000);
    }
    const slackError = params.get('slack_error');
    if (slackError) {
      toast.error(
        `Slack connection failed: ${decodeURIComponent(slackError)}. Please try again.`,
        'Slack Connection Error'
      );
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const scheduledCount = scheduledJobs?.length ?? 0;
  const sentCount = sentJobs?.length ?? 0;

  const handleScheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
    queryClient.invalidateQueries({ queryKey: ['emails', 'sent'] });
  };

  const handleDeleteEmail = async (id: string) => {
    // 1. Optimistic instant UI update
    queryClient.setQueryData<EmailJob[]>(['emails', 'scheduled'], (old) => old ? old.filter((j) => j.id !== id) : []);
    queryClient.setQueryData<EmailJob[]>(['emails', 'sent'], (old) => old ? old.filter((j) => j.id !== id) : []);
    if (selectedEmail?.id === id) {
      setSelectedEmail(null);
    }

    try {
      await deleteEmail(id);
      toast.success('Email deleted successfully', 'Deleted');
      queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'sent'] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'search'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete email', 'Delete Error');
      queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'sent'] });
    }
  };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Format scheduled time matching Figma: "Tue 9:15:12 AM"
  const formatScheduledTime = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${day} ${time}`;
  };

  // Display list: if searching, use search results; else active tab
  const activeJobs = searchQuery.trim().length > 1
    ? (searchResults || []) as unknown as EmailJob[]
    : activeTab === 'scheduled'
    ? scheduledJobs || []
    : sentJobs || [];

  const userDisplayName = user?.name || (user?.email ? user.email.split('@')[0] : 'Oliver Brown');
  const userDisplayEmail = user?.email || 'oliver.brown@domain.io';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen w-full bg-white font-sans overflow-hidden">
      {/* ───────────────────────────────────────────────────────────────────
          1. LEFT SIDEBAR matching Figma Images 2 & 3
      ─────────────────────────────────────────────────────────────────── */}
      <aside className="w-60 sm:w-64 h-full border-r border-gray-150 flex flex-col justify-between p-5 shrink-0 bg-white select-none">
        <div className="space-y-6">
          {/* Logo: ONB */}
          <div className="flex items-center gap-2 pt-1 px-1">
            <span className="font-mono text-2xl font-black tracking-wider text-gray-900">
              ONB
            </span>
          </div>

          {/* User Profile Card */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full rounded-2xl bg-[#F3F4F6] hover:bg-gray-200/70 p-2.5 flex items-center justify-between transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={userDisplayName}
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                    {userDisplayName}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
                    {userDisplayEmail}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu for Logout / Bull Board */}
            {userMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-30 text-xs text-gray-700">
                <a
                  href={`${(import.meta.env.VITE_API_BASE_URL || 'https://reachinbox-backend-vvu3.onrender.com/api').replace(/\/api$/, '')}/admin/queues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <span>Bull Board Queues</span>
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </a>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setUserMenuOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer text-left"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}

          </div>

          {/* Primary Action Button: "Compose" with green outline pill */}
          <button
            id="sidebar-compose-btn"
            onClick={() => setIsComposeOpen(true)}
            className="w-full py-2 px-4 rounded-full border-2 border-[#00A854] text-[#00A854] hover:bg-[#E8F5E9]/50 active:scale-[0.99] font-semibold text-sm transition-all shadow-none flex items-center justify-center cursor-pointer"
          >
            Compose
          </button>

          {/* Navigation Section: CORE */}
          <div className="space-y-1.5 pt-2">
            <p className="text-[10px] font-semibold tracking-wider text-gray-400 px-3 uppercase">
              CORE
            </p>

            {/* 1. Scheduled Emails Tab */}
            <button
              id="nav-scheduled"
              onClick={() => {
                setActiveTab('scheduled');
                setSearchQuery('');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'scheduled' && !searchQuery
                  ? 'bg-[#E8F5E9] text-[#00A854] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Scheduled</span>
              </div>
              <span className="text-xs text-gray-400 font-normal">
                {scheduledCount}
              </span>
            </button>

            {/* 2. Sent Emails Tab */}
            <button
              id="nav-sent"
              onClick={() => {
                setActiveTab('sent');
                setSearchQuery('');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'sent' && !searchQuery
                  ? 'bg-[#E8F5E9] text-[#00A854] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="h-4 w-4 shrink-0" />
                <span>Sent</span>
              </div>
              <span className="text-xs text-gray-400 font-normal">
                {sentCount}
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Slack Integration Status */}
        <div className="pt-4 border-t border-gray-150">
          {slackStatus?.connected ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] text-xs font-medium text-[#16A34A]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="truncate text-[11px] font-semibold text-emerald-800">Slack Alerts Active</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-white/90 px-1.5 py-0.5 rounded border border-emerald-200">
                Live
              </span>
            </div>
          ) : (
            <a
              href={getSlackConnectUrl()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 text-xs font-medium text-gray-600 transition"
              title="Connect Slack for rate-limit notifications"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#E01E5A] shrink-0" />
              <span className="truncate">Connect Slack</span>
            </a>
          )}
        </div>

      </aside>

      {/* ───────────────────────────────────────────────────────────────────
          2. MAIN CONTENT AREA matching Figma Images 2 & 3
      ─────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 h-full flex flex-col min-w-0 bg-white">
        {/* Top Header Bar: Search Pill + Filter + Refresh */}
        <header className="px-6 py-4 flex items-center justify-between gap-4 border-b border-gray-150 shrink-0">
          {/* Search Pill matching Figma: Q Search */}
          <div className="relative flex-1 max-w-lg">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full bg-[#F3F4F6] border-0 pl-10 pr-4 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A854]/40 transition"
            />
          </div>

          {/* Right Action Icons: Filter & Refresh */}
          <div className="flex items-center gap-2 text-gray-400">
            <button
              className="p-2 rounded-full hover:bg-gray-100 hover:text-gray-700 transition"
              title="Filter"
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                refetchScheduled();
                refetchSent();
              }}
              className="p-2 rounded-full hover:bg-gray-100 hover:text-gray-700 transition"
              title="Refresh inbox"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Slack Connection Success Banner */}
        {slackJustConnected && (
          <div className="mx-4 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-900">Slack Connected Successfully!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {slackStatus?.teamName
                  ? `Workspace "${slackStatus.teamName}" is now linked.`
                  : 'Your workspace is now linked.'}{' '}
                You will receive real-time alerts when rate limits are hit.
              </p>
            </div>
            <button
              onClick={() => setSlackJustConnected(false)}
              className="p-1 text-emerald-400 hover:text-emerald-700 rounded transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Email Rows List matching Figma Images 2 & 3 */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {((!scheduledJobs && isScheduledLoading && activeTab === 'scheduled') ||
          (!sentJobs && isSentLoading && activeTab === 'sent') ||
          (searchQuery.trim().length > 1 && isSearching)) ? (
            <div className="p-8 text-center text-xs text-gray-400">
              Loading emails...
            </div>
          ) : activeJobs.length === 0 ? (
            <div className="p-12 text-center text-xs sm:text-sm text-gray-400">
              {searchQuery
                ? `No emails matching "${searchQuery}"`
                : activeTab === 'scheduled'
                ? 'No scheduled emails in queue.'
                : 'No sent emails yet.'}
            </div>
          ) : (
            activeJobs.map((job) => {
              const isJobScheduled = job.status === 'PENDING';
              const isStarred = starredIds.has(job.id);
              const recipientName = job.recipient.split('@')[0];

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedEmail(job)}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors group text-xs sm:text-sm"
                >
                  {/* Left Column: To: Recipient */}
                  <div className="w-36 sm:w-44 shrink-0 font-semibold text-gray-900 truncate">
                    To: {recipientName}
                  </div>

                  {/* Middle Column: Status Badge + Subject & Snippet inline */}
                  <div className="flex-1 min-w-0 flex items-center gap-3 px-2">
                    {/* Status Pill Badge */}
                    {isJobScheduled ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] text-[11px] font-medium shrink-0">
                        <Clock className="h-3 w-3" />
                        <span>{formatScheduledTime(job.scheduledAt)}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-gray-600 text-[11px] font-medium shrink-0">
                        Sent
                      </span>
                    )}

                    {/* Subject & Body Snippet matching Figma */}
                    <div className="truncate text-gray-700">
                      <span className="font-bold text-gray-900">{job.subject}</span>
                      <span className="text-gray-400 font-normal">
                        {' '}- {job.body.replace(/\n+/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actions (Delete on hover + Star) */}
                  <div className="shrink-0 pl-3 flex items-center gap-1.5 text-gray-300 group-hover:text-gray-400">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEmail(job.id);
                      }}
                      className="p-1 hover:text-red-500 hover:bg-red-50 rounded-md transition opacity-0 group-hover:opacity-100"
                      title="Delete email"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleStar(job.id, e)}
                      className="p-1 hover:text-amber-500 transition"
                      title={isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          isStarred ? 'text-amber-400 fill-amber-400' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Compose Email Modal matching Figma Image 5 */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleScheduleSuccess}
        userEmail={userDisplayEmail}
      />

      {/* Email Detail Modal matching Figma Image 4 */}
      <EmailDetailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onDelete={handleDeleteEmail}
      />
    </div>
  );
};

export default Dashboard;
