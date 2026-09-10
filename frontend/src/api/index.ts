import type { ApiSuccess, EmailJob, ScheduleEmailPayload, ScheduleBatchResult, SearchResult, User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

// ─── Generic fetch helper ─────────────────────────────────────────────────────
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // send httpOnly cookie
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }

  return body as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  /** For dev/testing without real Google credentials */
  devToken: () =>
    request<ApiSuccess<User> & { token: string; user: User }>(`${API_BASE}/auth/dev-token`, {
      method: 'POST',
    }),

  me: () => request<ApiSuccess<User>>(`${API_BASE}/auth/me`),

  logout: () => request<ApiSuccess<null>>(`${API_BASE}/auth/logout`, { method: 'POST' }),

  googleLoginUrl: () => `${API_BASE}/auth/google`,
};

// ─── Email Jobs ───────────────────────────────────────────────────────────────
export const emailApi = {
  schedule: async (payload: ScheduleEmailPayload): Promise<ApiSuccess<ScheduleBatchResult>> => {
    // If a file is present we need multipart/form-data instead of JSON
    if (payload.file) {
      const form = new FormData();
      form.append('file', payload.file);
      form.append('subject', payload.subject);
      form.append('body', payload.body);
      if (payload.senderEmail) form.append('senderEmail', payload.senderEmail);
      if (payload.startTime) form.append('startTime', payload.startTime);
      if (payload.delayMs !== undefined) form.append('delayMs', String(payload.delayMs));
      if (payload.hourlyLimit !== undefined) form.append('hourlyLimit', String(payload.hourlyLimit));

      const res = await fetch(`${API_BASE}/emails/schedule`, {
        method: 'POST',
        credentials: 'include',
        body: form, // no Content-Type header — browser sets multipart boundary automatically
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
      return data;
    }

    return request<ApiSuccess<ScheduleBatchResult>>(`${API_BASE}/emails/schedule`, {
      method: 'POST',
      body: JSON.stringify({
        recipients: payload.recipients,
        subject: payload.subject,
        body: payload.body,
        senderEmail: payload.senderEmail,
        startTime: payload.startTime,
        delayMs: payload.delayMs,
        hourlyLimit: payload.hourlyLimit,
      }),
    });
  },

  scheduled: (limit = 100) =>
    request<ApiSuccess<EmailJob[]>>(`${API_BASE}/emails/scheduled?limit=${limit}`),

  sent: (limit = 100) =>
    request<ApiSuccess<EmailJob[]>>(`${API_BASE}/emails/sent?limit=${limit}`),

  search: (q: string) =>
    request<ApiSuccess<SearchResult[]>>(`${API_BASE}/emails/search?q=${encodeURIComponent(q)}`),
};
