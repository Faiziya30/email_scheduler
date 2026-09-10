import React from 'react';

export const Login: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-8 shadow-2xl border border-slate-800 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">ReachInbox</h1>
        <p className="text-slate-400 mb-6">Email Scheduler Platform</p>
        <button className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg">
          Sign in with Google (Placeholder)
        </button>
      </div>
    </div>
  );
};

export default Login;
