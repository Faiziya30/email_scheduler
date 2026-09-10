import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  X,
  Upload,
  FileText,
  Clock,
  Send,
  Users,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Gauge,
  Timer,
} from 'lucide-react';
import { scheduleEmail } from '../api/emails';
import { Button } from './Button';
import { useToast } from '../context/ToastContext';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [senderEmail, setSenderEmail] = useState('');

  // Scheduling options
  // Default to 2 minutes in future
  const defaultStartTime = new Date(Date.now() + 2 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delaySec, setDelaySec] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(10);

  // CSV/File Upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedCsvRecipients, setParsedCsvRecipients] = useState<string[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Extract manual emails from text
  const manualList = manualRecipients
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => EMAIL_REGEX.test(e));

  // Total detected recipients
  const totalRecipients = uploadedFile
    ? parsedCsvRecipients.length
    : manualList.length;

  // Client-side CSV / TXT parsing with papaparse
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingError(null);
    setUploadedFile(file);

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const detectedEmails: string[] = [];

        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              const str = String(cell).trim();
              if (EMAIL_REGEX.test(str) && !detectedEmails.includes(str)) {
                detectedEmails.push(str);
              }
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((cell) => {
              const str = String(cell).trim();
              if (EMAIL_REGEX.test(str) && !detectedEmails.includes(str)) {
                detectedEmails.push(str);
              }
            });
          }
        });

        if (detectedEmails.length === 0) {
          setParsingError('No valid email addresses detected in this file.');
          setParsedCsvRecipients([]);
        } else {
          setParsedCsvRecipients(detectedEmails);
          toast.info(
            `Detected ${detectedEmails.length} recipient(s) in "${file.name}"`,
            'CSV Parsed'
          );
        }
      },
      error: (err) => {
        setParsingError(`Failed to parse file: ${err.message}`);
        setParsedCsvRecipients([]);
      },
    });
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setParsedCsvRecipients([]);
    setParsingError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('Email subject is required.');
      return;
    }

    if (!body.trim()) {
      toast.error('Email body content is required.');
      return;
    }

    if (totalRecipients === 0) {
      toast.error('Please specify at least one recipient email address or upload a CSV file.');
      return;
    }

    setIsSubmitting(true);

    try {
      const delayMs = delaySec * 1000;
      const isoStartTime = startTime ? new Date(startTime).toISOString() : undefined;

      const result = await scheduleEmail({
        subject: subject.trim(),
        body: body.trim(),
        senderEmail: senderEmail.trim() || undefined,
        startTime: isoStartTime,
        delayMs,
        hourlyLimit,
        file: uploadedFile || undefined,
        recipients: !uploadedFile ? manualList : undefined,
      });

      toast.success(
        `Scheduled ${result.totalScheduled} email(s) successfully! First send: ${new Date(
          result.firstScheduledAt
        ).toLocaleTimeString()}`,
        'Campaign Queued'
      );

      // Reset form
      setSubject('');
      setBody('');
      setManualRecipients('');
      handleClearFile();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule campaign.', 'Submission Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0F1422] border border-slate-800 shadow-2xl z-10 my-8 overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Compose & Schedule Campaign</h2>
              <p className="text-xs text-slate-400">
                Configure recipients, delayed queueing, and hourly rate limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {/* Subject Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Subject Line <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="compose-subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Partnership discussion with ReachInbox"
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          {/* Sender Email (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Sender Email Address <span className="text-slate-500 font-normal">(Optional default)</span>
            </label>
            <input
              type="email"
              id="compose-sender"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="sender@outreach.reachinbox.ai"
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          {/* Recipients Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recipients <span className="text-rose-400">*</span>
              </label>
              {totalRecipients > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  {totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''} detected
                </span>
              )}
            </div>

            {/* CSV Upload Card */}
            <div className="rounded-xl border border-dashed border-slate-700/90 bg-slate-900/40 p-4 transition hover:border-slate-600">
              <input
                ref={fileInputRef}
                type="file"
                id="compose-file-upload"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              {!uploadedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center cursor-pointer py-2 text-center"
                >
                  <Upload className="h-6 w-6 text-indigo-400 mb-2" />
                  <p className="text-xs font-medium text-slate-200">
                    Click to upload CSV or text file of recipients
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Client-side validation via PapaParse with real-time count
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">{uploadedFile.name}</p>
                      <p className="text-[11px] text-emerald-400">
                        {parsedCsvRecipients.length} valid recipient(s) found
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFile}
                    className="text-xs text-rose-400 hover:bg-rose-500/10"
                  >
                    Remove
                  </Button>
                </div>
              )}

              {parsingError && (
                <p className="mt-2 text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {parsingError}
                </p>
              )}
            </div>

            {/* Manual Recipients Input (if no file uploaded) */}
            {!uploadedFile && (
              <div>
                <textarea
                  id="compose-manual-recipients"
                  rows={2}
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  placeholder="Or enter recipient emails separated by comma or new lines (e.g. alice@example.com, bob@example.com)"
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition font-mono"
                />
              </div>
            )}
          </div>

          {/* Email Body Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Body Content <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="compose-body"
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here (supports HTML or plain text)..."
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          {/* Queue & Rate Limit Controls (3-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Start Time */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                Start Time
              </label>
              <input
                type="datetime-local"
                id="compose-starttime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Delay Between Sends */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                <Timer className="h-3.5 w-3.5 text-indigo-400" />
                Min Delay (sec)
              </label>
              <input
                type="number"
                id="compose-delay"
                min="0"
                max="3600"
                value={delaySec}
                onChange={(e) => setDelaySec(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Hourly Rate Limit */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                <Gauge className="h-3.5 w-3.5 text-indigo-400" />
                Hourly Limit
              </label>
              <input
                type="number"
                id="compose-hourly-limit"
                min="1"
                max="10000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="h-3.5 w-3.5 text-slate-500" />
            <span>
              {totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''} queued
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              id="compose-submit-btn"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              leftIcon={<Clock className="h-4 w-4" />}
            >
              Schedule Campaign
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
