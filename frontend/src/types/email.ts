export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface EmailSender {
  id: string;
  emailAddress: string;
}

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
  sender?: EmailSender;
}

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

export interface SearchResult extends EmailJob {
  _id: string;
  _score: number;
}

export interface ApiSuccess<T> {
  status: 'success';
  data: T;
  results?: number;
  message?: string;
}

export interface ApiErrorResponse {
  status: 'error';
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}
