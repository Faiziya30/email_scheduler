import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import { searchEmails } from '../api/emails';
import type { SearchResult } from '../types';
import { StatusBadge } from './StatusBadge';

export const SearchBox: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: results, isLoading } = useQuery<SearchResult[]>({
    queryKey: ['emails', 'search', debouncedQuery],
    queryFn: () => searchEmails(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-500">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        <input
          type="text"
          id="email-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search emails by subject, recipient, body..."
          className="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 pl-10 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setDebouncedQuery('');
            }}
            className="absolute right-3 text-slate-400 hover:text-slate-200"
            aria-label="Clear search query"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Floating Results Dropdown */}
      {debouncedQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-[#0F1422] border border-slate-700/90 shadow-2xl z-30 max-h-80 overflow-y-auto divide-y divide-slate-800">
          <div className="px-3.5 py-2 bg-slate-900/90 text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Elasticsearch Results</span>
            <span>{results?.length ?? 0} matches</span>
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Searching Elasticsearch cluster...
            </div>
          ) : results && results.length > 0 ? (
            results.map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-slate-800/60 transition cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-100 truncate max-w-[260px]">
                    {item.subject}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono truncate max-w-[200px]">
                    {item.recipient}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(item.scheduledAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              No emails matching "{debouncedQuery}" found in index.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBox;
