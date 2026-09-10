import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Zap, Shield, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context';
import { Button } from '../components/Button';
import { Spinner } from '../components/Loader';

export const Login: React.FC = () => {
  const { user, isLoading, isAuthenticated, login, devLogin } = useAuth();
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  // If already authenticated, redirect straight to dashboard
  if (isAuthenticated || user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDevLogin = async () => {
    setDevLoading(true);
    setDevError(null);
    try {
      await devLogin();
    } catch (err: any) {
      setDevError(err?.message || 'Dev login failed. Check backend status.');
    } finally {
      setDevLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090D16]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="xl" color="border-indigo-500" />
          <p className="text-xs text-slate-400 font-medium">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#090D16] px-4 py-12 overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute -bottom-40 right-10 h-[400px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-xl shadow-indigo-600/30 ring-1 ring-white/15 mb-4">
            <Mail className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            ReachInbox <span className="text-indigo-400">Scheduler</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            High-throughput email scheduling platform backed by BullMQ, Redis, and Elasticsearch.
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl bg-[#0F1422]/95 border border-slate-800/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-slate-100">Sign in to your account</h2>
            <p className="mt-1 text-xs text-slate-400">
              Authenticate via Google OAuth 2.0 to access the scheduler
            </p>
          </div>

          {/* Google OAuth Button */}
          <Button
            id="google-login-button"
            type="button"
            variant="secondary"
            size="lg"
            onClick={login}
            className="w-full gap-3 bg-white hover:bg-slate-100 text-slate-900 border-none font-semibold shadow-md transition-transform active:scale-[0.99]"
          >
            {/* Google SVG Logo */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Dev Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0F1422] px-3 text-slate-500 font-medium">Local Dev Testing</span>
            </div>
          </div>

          {/* Dev Quick Login Button */}
          <Button
            id="dev-login-button"
            type="button"
            variant="outline"
            size="md"
            onClick={handleDevLogin}
            isLoading={devLoading}
            className="w-full gap-2 text-xs border-dashed border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/5 text-slate-300 hover:text-amber-300"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Dev Quick Login (Instant Test Session)</span>
          </Button>

          {devError && (
            <p className="mt-3 text-center text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-lg">
              {devError}
            </p>
          )}

          {/* Security & note */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Shield className="h-3.5 w-3.5 text-slate-400" />
            <span>JWT session stored in secure httpOnly cookie</span>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 rounded-xl bg-slate-900/40 border border-slate-800/60 p-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>BullMQ Delayed Queue</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Redis Sliding Rate Limiter</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Elasticsearch Indexing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Slack Rate Limit Alerts</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
