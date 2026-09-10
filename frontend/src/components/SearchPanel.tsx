import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import { emailApi } from '../api';
import { StatusBadge } from './StatusBadge';

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const SearchPanel: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query],
    queryFn: () => emailApi.search(query),
    enabled: query.trim().length >= 2,
    staleTime: 5_000,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(val), 350);
  };

  const clear = () => {
    setInputValue('');
    setQuery('');
    inputRef.current?.focus();
  };

  const results = data?.data ?? [];
  const showResults = query.trim().length >= 2;

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-800">
        <h2 className="mb-3 text-base font-semibold text-white flex items-center gap-2">
          <Search className="h-4 w-4 text-indigo-400" />
          Elasticsearch Search
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            id="search-input"
            ref={inputRef}
            type="search"
            value={inputValue}
            onChange={handleChange}
            placeholder="Search by subject, recipient, or sender…"
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 py-2.5 pl-9 pr-9 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition"
          />
          {inputValue && (
            <button
              onClick={clear}
              type="button"
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {showResults && (
          <p className="mt-2 text-xs text-slate-500">
            {isLoading
              ? 'Searching…'
              : isError
              ? 'Search error'
              : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
          </p>
        )}
      </div>

      {/* Results */}
      {showResults && (
        <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            </div>
          ) : isError ? (
            <p className="px-6 py-8 text-center text-sm text-rose-400">
              Search failed — check that Elasticsearch is running.
            </p>
          ) : results.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No results found.</p>
          ) : (
            results.map((hit) => (
              <div key={hit._id} className="flex items-start justify-between gap-4 px-6 py-3.5 hover:bg-slate-800/30 transition">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{hit.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-400 truncate font-mono">{hit.recipient}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={hit.status} />
                  <span className="text-xs text-slate-500">{fmt(hit.scheduledAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};
