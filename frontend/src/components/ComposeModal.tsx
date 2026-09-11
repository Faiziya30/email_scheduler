import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  X,
  Plus,
} from 'lucide-react';
import { scheduleEmail } from '../api/emails';
import { useToast } from '../context/ToastContext';
import { Spinner } from './Loader';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userEmail?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail = 'sender@reachinbox.ai',
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>(['candidate@example.com']);
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);

  // Scheduling options
  const defaultStartTime = new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delaySec, setDelaySec] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Handle CSV / TXT file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          toast.error('No valid email addresses detected in this file.');
        } else {
          // Merge unique emails
          const merged = Array.from(new Set([...recipients, ...detectedEmails]));
          setRecipients(merged);
          toast.success(
            `Imported ${detectedEmails.length} recipient(s) from "${file.name}"`,
            'Leads Uploaded'
          );
        }
      },
      error: (err) => {
        toast.error(`Failed to parse file: ${err.message}`);
      },
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddRecipient = () => {
    const trimmed = newRecipientInput.trim();
    if (trimmed && EMAIL_REGEX.test(trimmed)) {
      if (!recipients.includes(trimmed)) {
        setRecipients([...recipients, trimmed]);
      }
      setNewRecipientInput('');
      setIsAddingRecipient(false);
    } else if (trimmed) {
      toast.error('Please enter a valid email address.');
    }
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((r) => r !== emailToRemove));
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (recipients.length === 0) {
      toast.error('Please add at least one recipient or upload a leads list.');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please provide an email subject.');
      return;
    }

    if (!body.trim()) {
      toast.error('Please provide an email body.');
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleEmail({
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        senderEmail: userEmail,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayMs: Math.max(1000, Number(delaySec) * 1000),
        hourlyLimit: Math.max(1, Number(hourlyLimit)),
      });

      toast.success(
        `Successfully queued ${recipients.length} email(s) into BullMQ!`,
        'Campaign Scheduled'
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to schedule emails.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedRecipients = recipients.slice(0, 3);
  const remainingCount = recipients.length - displayedRecipients.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Hidden File Input for CSV / TXT Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Top Header matching Figma Image 5 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-700 hover:bg-gray-100 transition"
              title="Close compose"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Compose New Email
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Paperclip attachment */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-gray-400 hover:text-[#00A854] hover:bg-green-50 rounded-full transition"
              title="Attach files / CSV"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Clock / Schedule toggle */}
            <button
              type="button"
              onClick={() => setShowScheduleDatePicker(!showScheduleDatePicker)}
              className={`p-1.5 rounded-full transition ${
                showScheduleDatePicker
                  ? 'text-[#00A854] bg-green-50'
                  : 'text-gray-400 hover:text-[#00A854] hover:bg-green-50'
              }`}
              title="Set scheduled start time"
            >
              <Clock className="h-4 w-4" />
            </button>

            {/* Primary Action Button: "Send Later" with green outline */}
            <button
              id="send-later-btn"
              type="button"
              onClick={handleScheduleSubmit}
              disabled={isSubmitting}
              className="px-5 py-1.5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E8F5E9] active:scale-[0.98] font-medium text-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" color="border-[#00A854]" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>Send Later</span>
              )}
            </button>
          </div>
        </div>

        {/* Schedule Time Expandable Picker */}
        {showScheduleDatePicker && (
          <div className="px-6 py-2.5 bg-green-50/50 border-b border-green-100 flex items-center gap-3 text-xs text-gray-700">
            <span className="font-medium text-[#007A3D]">Schedule Start Date & Time:</span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="px-3 py-1 rounded-lg border border-green-200 bg-white text-gray-800 text-xs focus:ring-2 focus:ring-[#00A854] outline-none"
            />
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-4">
          {/* Row 1: From */}
          <div className="flex items-center gap-6 text-sm">
            <span className="w-16 text-gray-400 font-medium">From</span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
              <span>{userEmail}</span>
              <span className="text-gray-400 text-[10px]">⌄</span>
            </div>
          </div>

          <div className="border-b border-gray-100" />

          {/* Row 2: To with Recipient Pills + Upload List button */}
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-6 flex-1 flex-wrap">
              <span className="w-16 text-gray-400 font-medium">To</span>
              <div className="flex items-center gap-2 flex-wrap">
                {displayedRecipients.map((recip) => (
                  <span
                    key={recip}
                    className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-[#00A854] bg-[#E8F5E9]/50 text-[#007A3D] text-xs font-mono"
                  >
                    <span>{recip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(recip)}
                      className="hover:text-red-500 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {remainingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full border border-[#00A854] bg-[#E8F5E9] text-[#007A3D] text-xs font-bold font-mono">
                    +{remainingCount}
                  </span>
                )}

                {isAddingRecipient ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="email"
                      placeholder="recipient@domain.com"
                      value={newRecipientInput}
                      onChange={(e) => setNewRecipientInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRecipient())}
                      className="px-2.5 py-0.5 text-xs rounded-full border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#00A854]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="text-xs text-[#00A854] font-medium px-2 py-0.5 hover:bg-green-50 rounded"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingRecipient(true)}
                    className="text-gray-400 hover:text-[#00A854] p-1 rounded-full hover:bg-gray-100 transition"
                    title="Add recipient manually"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Upload List Button matching Figma Image 5 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#00A854] hover:text-[#007A3D] transition shrink-0 px-2 py-1 hover:bg-green-50 rounded-lg"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload List</span>
            </button>
          </div>

          <div className="border-b border-gray-100" />

          {/* Row 3: Subject */}
          <div className="flex items-center gap-6 text-sm">
            <span className="w-16 text-gray-400 font-medium">Subject</span>
            <input
              id="compose-subject"
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 border-0 p-0 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0"
            />
          </div>

          <div className="border-b border-gray-100" />

          {/* Row 4: Delay between 2 emails & Hourly Limit controls */}
          <div className="flex items-center gap-8 text-xs text-gray-600 pt-1">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-medium">Delay between 2 emails</span>
              <input
                type="number"
                min="1"
                max="60"
                value={delaySec}
                onChange={(e) => setDelaySec(Number(e.target.value))}
                className="w-14 rounded-lg border border-gray-200 px-2.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-[#00A854] outline-none"
              />
              <span className="text-gray-400">sec</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-medium">Hourly Limit</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-14 rounded-lg border border-gray-200 px-2.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-[#00A854] outline-none"
              />
            </div>
          </div>

          {/* Row 5: Large Body Container with Toolbar matching Figma Image 5 */}
          <div className="rounded-2xl bg-[#F9FAFB] border border-gray-200/90 overflow-hidden mt-4">
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 sm:gap-2 px-4 py-2.5 border-b border-gray-200/80 bg-white/70 text-gray-400 text-xs overflow-x-auto">
              <button type="button" className="p-1 hover:text-gray-700 rounded"><Undo2 className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded"><Redo2 className="h-3.5 w-3.5" /></button>
              <div className="h-4 w-px bg-gray-200 mx-1" />
              <button type="button" className="p-1 hover:text-gray-700 rounded font-bold"><Bold className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded italic"><Italic className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded underline"><Underline className="h-3.5 w-3.5" /></button>
              <div className="h-4 w-px bg-gray-200 mx-1" />
              <button type="button" className="p-1 hover:text-gray-700 rounded"><AlignLeft className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded"><List className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded"><ListOrdered className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded"><Quote className="h-3.5 w-3.5" /></button>
              <button type="button" className="p-1 hover:text-gray-700 rounded"><LinkIcon className="h-3.5 w-3.5" /></button>
            </div>

            {/* Main Textarea */}
            <textarea
              id="compose-body"
              rows={8}
              placeholder="Type Your Reply..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-transparent p-5 text-sm text-gray-800 placeholder-gray-400 border-0 focus:outline-none focus:ring-0 resize-none font-normal leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
