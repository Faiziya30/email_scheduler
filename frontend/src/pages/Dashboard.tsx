import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="flex justify-between items-center pb-6 mb-8 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">ReachInbox Email Scheduler</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold">
            RI
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl text-center">
        <p className="text-slate-400">Dashboard content placeholder — Phase 1</p>
      </main>
    </div>
  );
};

export default Dashboard;
