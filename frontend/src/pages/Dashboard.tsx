import React, { useState } from 'react';
import { Clock, Send, Plus, Inbox, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';

type TabType = 'scheduled' | 'sent';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Email Campaigns
              <span className="text-xs font-normal py-0.5 px-2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Phase 5 Active
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Welcome back, <span className="text-slate-200 font-medium">{user?.name || user?.email}</span>. Manage and monitor your scheduled outreach.
            </p>
          </div>

          {/* Primary Action Button (Compose placeholder for Phase 6) */}
          <div className="flex items-center gap-3">
            <Button
              id="compose-button"
              variant="primary"
              size="md"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                alert('Compose modal and full scheduling will be activated in Phase 6!');
              }}
              className="shadow-indigo-600/30 font-semibold"
            >
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Tab Navigation & Status Filter */}
        <div className="flex items-center justify-between border-b border-slate-800">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
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
                0
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
              <span>Sent & Delivered</span>
              <span
                className={`ml-1 rounded-full py-0.5 px-2 text-xs font-semibold ${
                  activeTab === 'sent'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                0
              </span>
            </button>
          </nav>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Shared Layout & Auth Verified</span>
          </div>
        </div>

        {/* Tab Content Placeholders (Ready for Phase 6 real tables) */}
        <div className="mt-6">
          {activeTab === 'scheduled' ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10 text-indigo-400 stroke-[1.5]" />}
              title="No scheduled emails queued"
              description="Your pending BullMQ jobs with countdown timers, rate limits, and delay parameters will appear in this table once scheduled in Phase 6."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => alert('Compose modal is scheduled for Phase 6!')}
                >
                  Schedule an email campaign
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CheckCircle className="h-10 w-10 text-emerald-400 stroke-[1.5]" />}
              title="No sent emails yet"
              description="Delivered emails with Ethereal preview links, timestamps, and status metrics will appear here after execution."
            />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
