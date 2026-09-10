import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Mail, LogOut, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context';
import { Button } from './Button';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  const userDisplayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const userInitial = (userDisplayName || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top persistent header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-md shadow-indigo-600/30 ring-1 ring-white/10">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  ReachInbox
                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                    Scheduler
                  </span>
                </span>
              </div>
            </Link>
          </div>

          {/* Right: User Profile + Bull Board Link + Logout */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Bull Board Quick Link */}
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 transition-colors py-1 px-2.5 rounded-md hover:bg-slate-800/60"
              title="BullMQ Real-Time Monitoring Dashboard"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bull Board</span>
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            {/* User Profile info */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span
                    id="user-name"
                    className="text-xs font-semibold text-slate-100 max-w-[150px] truncate"
                    title={userDisplayName}
                  >
                    {userDisplayName}
                  </span>
                  <span
                    id="user-email"
                    className="text-[11px] text-slate-400 max-w-[180px] truncate"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                </div>

                {/* Avatar */}
                <div id="user-avatar" className="relative flex-shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={userDisplayName}
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-700 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-xs font-bold text-white ring-2 ring-indigo-500/40 shadow-sm">
                      {userInitial}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0B0F19]" />
                </div>
              </div>
            )}

            {/* Logout Button */}
            <Button
              id="logout-button"
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-xs gap-1.5 border-slate-700 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/40"
              title="Sign out and clear session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default Layout;
