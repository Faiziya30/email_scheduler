import React, { useState } from 'react';
import { Navbar, StatsBar, EmailScheduleForm, EmailList, SearchPanel } from '../components';

type Tab = 'scheduled' | 'sent';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Schedule, monitor, and search your email campaigns in real-time.
          </p>
        </div>

        {/* Stats row */}
        <StatsBar />

        {/* Main grid: form + list */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Schedule form — fixed left column */}
          <div className="xl:col-span-2">
            <EmailScheduleForm />
          </div>

          {/* Email list + search — right column */}
          <div className="xl:col-span-3 flex flex-col gap-6">
            {/* Search panel */}
            <SearchPanel />

            {/* Tabs */}
            <div>
              <div className="flex border-b border-slate-800 mb-4" role="tablist" aria-label="Email status tabs">
                {(['scheduled', 'sent'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    id={`tab-${tab}`}
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'scheduled' ? 'Scheduled' : 'Sent / Failed'}
                  </button>
                ))}
              </div>
              <EmailList mode={activeTab} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
