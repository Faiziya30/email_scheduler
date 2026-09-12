import React from 'react';
import { LayoutDashboard, LogOut, ExternalLink } from 'lucide-react';
import { useAuth } from '../context';
import { Button } from './Button';
import { API_BASE_URL } from '../api/client';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">
            ReachInbox <span className="text-indigo-400">Scheduler</span>
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <a
            href={`${API_BASE_URL.replace(/\/api$/, '')}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition"
          >
            Bull Board <ExternalLink className="h-3 w-3" />
          </a>

          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-slate-200">{user.name ?? user.email}</span>
                <span className="text-xs text-slate-500">{user.email}</span>
              </div>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? user.email}
                  className="h-8 w-8 rounded-full ring-1 ring-slate-700"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white ring-1 ring-indigo-500">
                  {(user.name ?? user.email).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}

          <Button
            id="logout-button"
            variant="ghost"
            size="sm"
            onClick={logout}
            className="gap-1.5 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
