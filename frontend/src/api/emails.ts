import { apiClient, API_BASE_URL } from './client';
import type {
  EmailJob,
  ScheduleEmailPayload,
  ScheduleBatchResult,
  SearchResult,
  ApiSuccess,
} from '../types';

export const emailApi = {
  /**
   * Schedule emails immediately or in batch via recipients array or CSV/txt file
   */
  scheduleEmail: async (payload: ScheduleEmailPayload): Promise<ScheduleBatchResult> => {
    // If a CSV or text file is uploaded, transmit as multipart/form-data
    if (payload.file) {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('subject', payload.subject);
      formData.append('body', payload.body);
      if (payload.senderEmail) formData.append('senderEmail', payload.senderEmail);
      if (payload.startTime) formData.append('startTime', payload.startTime);
      if (payload.delayMs !== undefined) formData.append('delayMs', String(payload.delayMs));
      if (payload.hourlyLimit !== undefined) formData.append('hourlyLimit', String(payload.hourlyLimit));

      const res = await apiClient<ApiSuccess<ScheduleBatchResult>>('/emails/schedule', {
        method: 'POST',
        body: formData,
      });
      return res.data;
    }

    // Otherwise transmit as JSON
    const res = await apiClient<ApiSuccess<ScheduleBatchResult>>('/emails/schedule', {
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
    return res.data;
  },

  /**
   * Fetch all queued/pending scheduled jobs
   */
  getScheduledEmails: async (limit = 100): Promise<EmailJob[]> => {
    const res = await apiClient<ApiSuccess<EmailJob[]>>(`/emails/scheduled?limit=${limit}`);
    return res.data;
  },

  /**
   * Fetch all sent and failed email jobs
   */
  getSentEmails: async (limit = 100): Promise<EmailJob[]> => {
    const res = await apiClient<ApiSuccess<EmailJob[]>>(`/emails/sent?limit=${limit}`);
    return res.data;
  },

  /**
   * Full-text search across scheduled, sent, and failed emails using Elasticsearch
   */
  searchEmails: async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) return [];
    const res = await apiClient<ApiSuccess<SearchResult[]>>(
      `/emails/search?q=${encodeURIComponent(query.trim())}`
    );
    return res.data;
  },

  /**
   * Delete an email job
   */
  deleteEmail: async (id: string): Promise<void> => {
    await apiClient<ApiSuccess<{ id: string }>>(`/emails/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get current Slack integration connection status
   */
  getSlackStatus: async (): Promise<{ connected: boolean; teamId?: string; teamName?: string; channelName?: string }> => {
    try {
      const res = await apiClient<ApiSuccess<{ connected: boolean; teamId?: string; teamName?: string; channelName?: string }>>('/slack/status');
      return res.data;
    } catch {
      return { connected: false };
    }
  },

  /**
   * Returns Slack OAuth authorization URL
   */
  getSlackConnectUrl: (): string => {
    return `${API_BASE_URL}/slack/connect`;
  },

  // Aliases for compatibility
  schedule: (payload: ScheduleEmailPayload) => emailApi.scheduleEmail(payload),
  scheduled: (limit = 100) => emailApi.getScheduledEmails(limit),
  sent: (limit = 100) => emailApi.getSentEmails(limit),
  search: (query: string) => emailApi.searchEmails(query),
  delete: (id: string) => emailApi.deleteEmail(id),
};

export const {
  scheduleEmail,
  getScheduledEmails,
  getSentEmails,
  searchEmails,
  deleteEmail,
  getSlackStatus,
  getSlackConnectUrl,
} = emailApi;

