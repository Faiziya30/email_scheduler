import React from 'react';
import { Chrome, Zap } from 'lucide-react';
import { useAuth } from '../context';
import { Button } from '../components';

export const Login: React.FC = () => {
  const { login, devLogin, isLoading } = useAuth();
  const [devLoading, setDevLoading] = React.useState(false);
  const [devError, setDevError] = React.useState('');

  const handleDevLogin = async () => {
    setDevLoading(true);
    setDevError('');
    try {
      await devLogin();
    } catch (e: any) {
      setDevError(e.message ?? 'Dev login failed');
    } finally {
      setDevLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <span className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-950 overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-600/40 ring-1 ring-indigo-500/30">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">ReachInbox</h1>
            <p className="mt-1 text-sm text-slate-400">Production-grade Email Scheduler</p>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
          <h2 className="mb-1 text-center text-lg font-semibold text-white">Sign in</h2>
          <p className="mb-6 text-center text-xs text-slate-500">
            Sign in with your Google account to manage campaigns
          </p>

          <Button
            id="google-login-button"
            onClick={login}
            size="lg"
            className="w-full gap-3"
          >
            <Chrome className="h-5 w-5" />
            Continue with Google
          </Button>

          <div className="mt-4 flex items-center gap-3 text-xs text-slate-600">
            <div className="flex-1 h-px bg-slate-800" />
            dev only
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <Button
            id="dev-login-button"
            variant="ghost"
            size="md"
            onClick={handleDevLogin}
            isLoading={devLoading}
            className="mt-4 w-full gap-2 text-xs"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Dev Quick Login (no Google credentials needed)
          </Button>

          {devError && (
            <p className="mt-2 text-center text-xs text-rose-400">{devError}</p>
          )}

          <p className="mt-6 text-center text-xs text-slate-600 leading-relaxed">
            By signing in you agree to use this tool responsibly.
            <br />
            All emails are sent via Ethereal in development.
          </p>
        </div>

        {/* Feature bullets */}
        <ul className="mt-6 grid grid-cols-2 gap-2 text-xs text-slate-500">
          {[
            '⏱ Delayed scheduling',
            '📊 Rate limiting',
            '🔍 Elasticsearch search',
            '🔔 Slack alerts',
          ].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

export default Login;
