// ─── Email Job ───────────────────────────────────────────────────────────────
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface EmailJob {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  delayMs: number;
  hourlyLimit: number;
  bullJobId: string | null;
  createdAt: string;
  sender?: { emailAddress: string };
}

// ─── Schedule Payload ─────────────────────────────────────────────────────────
export interface ScheduleEmailPayload {
  recipients?: string[];
  subject: string;
  body: string;
  senderEmail?: string;
  startTime?: string;
  delayMs?: number;
  hourlyLimit?: number;
  file?: File;
}

export interface ScheduleBatchResult {
  success: boolean;
  totalScheduled: number;
  firstScheduledAt: string;
  lastScheduledAt: string;
  jobs: EmailJob[];
}

// ─── API Response Wrappers ────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  status: 'success';
  data: T;
  results?: number;
}

export interface ApiError {
  status: 'error';
  statusCode: number;
  message: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

// ─── Search Result ────────────────────────────────────────────────────────────
export interface SearchResult extends EmailJob {
  _id: string;
  _score: number;
}
