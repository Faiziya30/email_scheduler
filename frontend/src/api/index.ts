export * from './client';
export * from './auth';

import { apiClient } from './client';
import type { ApiSuccess, EmailJob, ScheduleEmailPayload, ScheduleBatchResult, SearchResult } from '../types';

// ─── Email Jobs ───────────────────────────────────────────────────────────────
export const emailApi = {
  schedule: async (payload: ScheduleEmailPayload): Promise<ApiSuccess<ScheduleBatchResult>> => {
    if (payload.file) {
      const form = new FormData();
      form.append('file', payload.file);
      form.append('subject', payload.subject);
      form.append('body', payload.body);
      if (payload.senderEmail) form.append('senderEmail', payload.senderEmail);
      if (payload.startTime) form.append('startTime', payload.startTime);
      if (payload.delayMs !== undefined) form.append('delayMs', String(payload.delayMs));
      if (payload.hourlyLimit !== undefined) form.append('hourlyLimit', String(payload.hourlyLimit));

      return apiClient<ApiSuccess<ScheduleBatchResult>>('/emails/schedule', {
        method: 'POST',
        body: form,
      });
    }

    return apiClient<ApiSuccess<ScheduleBatchResult>>('/emails/schedule', {
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
    apiClient<ApiSuccess<EmailJob[]>>(`/emails/scheduled?limit=${limit}`),

  sent: (limit = 100) =>
    apiClient<ApiSuccess<EmailJob[]>>(`/emails/sent?limit=${limit}`),

  search: (q: string) =>
    apiClient<ApiSuccess<SearchResult[]>>(`/emails/search?q=${encodeURIComponent(q)}`),
};
