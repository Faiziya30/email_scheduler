import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Users, Clock, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { emailApi } from '../api';
import type { ScheduleEmailPayload } from '../types';
import { Button } from './Button';
import { Input, Textarea } from './Input';

interface FormState {
  recipients: string;
  subject: string;
  body: string;
  senderEmail: string;
  startTime: string;
  delayMs: string;
  hourlyLimit: string;
}

const DEFAULT_FORM: FormState = {
  recipients: '',
  subject: '',
  body: '',
  senderEmail: '',
  startTime: '',
  delayMs: '1000',
  hourlyLimit: '100',
};

export const EmailScheduleForm: React.FC = () => {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  };

  const mutation = useMutation({
    mutationFn: (payload: ScheduleEmailPayload) => emailApi.schedule(payload),
    onSuccess: (res) => {
      showToast(
        'success',
        `✅ Scheduled ${res.data.totalScheduled} email${res.data.totalScheduled !== 1 ? 's' : ''} successfully!`,
      );
      setForm(DEFAULT_FORM);
      setFile(null);
      setDetectedCount(null);
      qc.invalidateQueries({ queryKey: ['scheduled'] });
    },
    onError: (err: Error) => showToast('error', err.message),
  });

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!f) { setDetectedCount(null); return; }

    const text = await f.text();
    // Count lines/tokens that look like email addresses
    const emails = text
      .split(/[\r\n,;]+/)
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter((t) => t.includes('@') && t.includes('.'));
    setDetectedCount(emails.length);
  };

  const removeFile = () => {
    setFile(null);
    setDetectedCount(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!file && !form.recipients.trim()) errs.recipients = 'Provide recipients or upload a file';
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.body.trim()) errs.body = 'Email body is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: ScheduleEmailPayload = {
      subject: form.subject.trim(),
      body: form.body.trim(),
      senderEmail: form.senderEmail.trim() || undefined,
      startTime: form.startTime || undefined,
      delayMs: form.delayMs ? Number(form.delayMs) : undefined,
      hourlyLimit: form.hourlyLimit ? Number(form.hourlyLimit) : undefined,
    };

    if (file) {
      payload.file = file;
    } else {
      // Parse recipients: comma-separated or newline-separated
      payload.recipients = form.recipients
        .split(/[\r\n,]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));
    }

    mutation.mutate(payload);
  };

  return (
    <section id="schedule-form" className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
      <h2 className="mb-5 text-lg font-semibold text-white flex items-center gap-2">
        <Mail className="h-5 w-5 text-indigo-400" />
        Schedule Email Campaign
      </h2>

      {toast && (
        <div
          className={`mb-5 flex items-start gap-2 rounded-lg p-3 text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipients */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Recipients
            </span>
          </label>
          {!file ? (
            <>
              <Textarea
                id="recipients"
                placeholder="alice@example.com, bob@example.com&#10;(comma or newline separated)"
                value={form.recipients}
                onChange={set('recipients')}
                error={errors.recipients}
                rows={3}
              />
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-slate-500">or upload</span>
                <label
                  htmlFor="file-upload"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-600 px-3 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500 hover:text-indigo-400"
                >
                  <Upload className="h-3.5 w-3.5" />
                  CSV / TXT file
                </label>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-indigo-300">
                <Upload className="h-4 w-4" />
                <span className="font-medium">{file.name}</span>
                {detectedCount !== null && (
                  <span className="ml-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                    {detectedCount} recipients detected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={removeFile}
                className="text-slate-400 hover:text-rose-400 transition"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Subject */}
        <Input
          id="subject"
          label="Subject"
          placeholder="Your email subject line"
          value={form.subject}
          onChange={set('subject')}
          error={errors.subject}
        />

        {/* Body */}
        <Textarea
          id="body"
          label="Email Body"
          placeholder="Write your email content here..."
          value={form.body}
          onChange={set('body')}
          error={errors.body}
          rows={5}
        />

        {/* Advanced settings */}
        <details className="group">
          <summary className="cursor-pointer list-none text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 select-none">
            <Clock className="h-3.5 w-3.5" />
            Advanced scheduling options
            <span className="ml-auto group-open:rotate-180 transition-transform text-slate-600">▾</span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              id="senderEmail"
              label="Sender Email (optional)"
              type="email"
              placeholder="sender@yourdomain.com"
              value={form.senderEmail}
              onChange={set('senderEmail')}
            />
            <Input
              id="startTime"
              label="Start Time (optional)"
              type="datetime-local"
              value={form.startTime}
              onChange={set('startTime')}
            />
            <Input
              id="delayMs"
              label="Delay between emails (ms)"
              type="number"
              min="100"
              step="100"
              placeholder="1000"
              value={form.delayMs}
              onChange={set('delayMs')}
            />
            <Input
              id="hourlyLimit"
              label="Hourly limit per sender"
              type="number"
              min="1"
              placeholder="100"
              value={form.hourlyLimit}
              onChange={set('hourlyLimit')}
            />
          </div>
        </details>

        <Button
          id="schedule-submit"
          type="submit"
          size="lg"
          isLoading={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? 'Scheduling…' : 'Schedule Campaign'}
        </Button>
      </form>
    </section>
  );
};
