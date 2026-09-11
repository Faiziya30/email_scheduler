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
  FileText,
  Calendar,
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

interface AttachedFile {
  id: string;
  file: File;
  name: string;
  sizeFormatted: string;
  isImage: boolean;
  previewUrl?: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail = 'sender@reachinbox.ai',
}) => {
  const toast = useToast();
  const leadsFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipientInput, setNewRecipientInput] = useState('');

  // Attachments (PDFs, Images, Word docs, etc.)
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

  // Scheduling options
  const [startTime, setStartTime] = useState<string>('');
  const [delaySec, setDelaySec] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);
  const [showSendLaterPopover, setShowSendLaterPopover] = useState(false);
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Preset calculation helper
  const getTomorrowPreset = (hour = 9, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const presets = [
    { label: 'Tomorrow', value: getTomorrowPreset(9, 0) },
    { label: 'Tomorrow, 10:00 AM', value: getTomorrowPreset(10, 0) },
    { label: 'Tomorrow, 11:00 AM', value: getTomorrowPreset(11, 0) },
    { label: 'Tomorrow, 3:00 PM', value: getTomorrowPreset(15, 0) },
  ];

  // 1. Leads list upload (CSV / TXT)
  const handleLeadsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          toast.error('No valid email addresses detected in this CSV/TXT file.');
        } else {
          const merged = Array.from(new Set([...recipients, ...detectedEmails]));
          setRecipients(merged);
          toast.success(
            `Imported ${detectedEmails.length} recipient lead(s) from "${file.name}"`,
            'Leads List Uploaded'
          );
        }
      },
      error: (err) => {
        toast.error(`Failed to parse file: ${err.message}`);
      },
    });

    if (leadsFileInputRef.current) leadsFileInputRef.current.value = '';
  };

  // 2. Email Attachments upload (PDF, PNG, JPG, DOC, etc.)
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const isImage = file.type.startsWith('image/');

      newAttachments.push({
        id: `${file.name}-${Date.now()}-${i}`,
        file,
        name: file.name,
        sizeFormatted: file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} KB` : `${sizeMB} MB`,
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    toast.info(`Attached ${newAttachments.length} file(s) to email.`, 'Attachment Added');

    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const addCurrentInputAsRecipient = () => {
    const trimmed = newRecipientInput.trim().replace(/,$/, '');
    if (trimmed) {
      if (EMAIL_REGEX.test(trimmed)) {
        if (!recipients.includes(trimmed)) {
          setRecipients((prev) => [...prev, trimmed]);
        }
        setNewRecipientInput('');
      } else {
        toast.error(`"${trimmed}" is not a valid email address.`);
      }
    }
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addCurrentInputAsRecipient();
    }
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((r) => r !== emailToRemove));
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalRecipients = [...recipients];
    const pendingInput = newRecipientInput.trim().replace(/,$/, '');
    if (pendingInput && EMAIL_REGEX.test(pendingInput) && !finalRecipients.includes(pendingInput)) {
      finalRecipients.push(pendingInput);
      setRecipients(finalRecipients);
      setNewRecipientInput('');
    }

    if (finalRecipients.length === 0) {
      toast.error('Please enter at least one recipient email address or upload a leads list.');
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
        recipients: finalRecipients,
        senderEmail: userEmail,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayMs: Math.max(1000, Number(delaySec) * 1000),
        hourlyLimit: Math.max(1, Number(hourlyLimit)),
      });

      toast.success(
        `Successfully queued ${finalRecipients.length} email(s) into BullMQ!`,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-visible flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Hidden File Input for Leads CSV / TXT */}
        <input
          ref={leadsFileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleLeadsFileUpload}
          className="hidden"
        />

        {/* Hidden File Input for Attachments */}
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
          onChange={handleAttachmentUpload}
          className="hidden"
        />

        {/* Top Header matching Figma */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-white rounded-t-2xl relative">
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

          <div className="flex items-center gap-3 relative">
            {/* Paperclip attachment icon */}
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="p-1.5 text-gray-400 hover:text-[#00A854] hover:bg-green-50 rounded-full transition flex items-center gap-1"
              title="Attach documents, PDFs, pictures, or files"
            >
              <Paperclip className="h-4 w-4" />
              {attachments.length > 0 && (
                <span className="h-4 w-4 rounded-full bg-[#00A854] text-white text-[10px] font-bold flex items-center justify-center">
                  {attachments.length}
                </span>
              )}
            </button>

            {/* Clock icon: Toggles "Send Later" Popover matching latest Figma screenshot */}
            <button
              id="clock-schedule-btn"
              type="button"
              onClick={() => setShowSendLaterPopover(!showSendLaterPopover)}
              className={`p-1.5 rounded-full transition ${
                showSendLaterPopover || startTime
                  ? 'text-[#00A854] bg-green-50'
                  : 'text-gray-400 hover:text-[#00A854] hover:bg-green-50'
              }`}
              title="Schedule Send Later"
            >
              <Clock className="h-4 w-4" />
            </button>

            {/* Primary Action Button: "Send" with green outline matching screenshot */}
            <button
              id="send-btn"
              type="button"
              onClick={handleScheduleSubmit}
              disabled={isSubmitting}
              className="px-6 py-1.5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E8F5E9] active:scale-[0.98] font-medium text-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" color="border-[#00A854]" />
                  <span>Sending...</span>
                </>
              ) : (
                <span>{startTime ? 'Send Later' : 'Send'}</span>
              )}
            </button>

            {/* ─────────────────────────────────────────────────────────────
                "Send Later" Popover Card matching exact latest Figma screenshot
            ───────────────────────────────────────────────────────────── */}
            {showSendLaterPopover && (
              <div className="absolute top-12 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50 text-left space-y-4 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">Send Later</h3>
                  {startTime && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartTime('');
                        setSelectedPresetLabel(null);
                      }}
                      className="text-[11px] text-gray-400 hover:text-red-500"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Pick date & time Input */}
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setSelectedPresetLabel(null);
                    }}
                    placeholder="Pick date & time"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-[#00A854] outline-none"
                  />
                </div>

                {/* Preset List matching screenshot */}
                <div className="space-y-1 text-xs text-gray-700 pt-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setStartTime(preset.value);
                        setSelectedPresetLabel(preset.label);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition text-xs flex items-center justify-between ${
                        selectedPresetLabel === preset.label || startTime === preset.value
                          ? 'bg-green-50 text-[#00A854] font-semibold'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {selectedPresetLabel === preset.label && (
                        <span className="text-[#00A854] text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Popover Footer Actions matching screenshot: Cancel & Done */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowSendLaterPopover(false)}
                    className="text-xs text-gray-500 hover:text-gray-800 font-medium px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!startTime) {
                        setStartTime(getTomorrowPreset(9, 0));
                      }
                      setShowSendLaterPopover(false);
                      toast.info('Scheduled release time set.', 'Send Later');
                    }}
                    className="px-4 py-1 rounded-full border border-[#00A854] text-[#00A854] hover:bg-green-50 text-xs font-semibold transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Notification Tag if active */}
        {startTime && (
          <div className="px-6 py-2 bg-green-50/70 border-b border-green-100 flex items-center justify-between text-xs text-gray-700">
            <span className="flex items-center gap-1.5 text-[#007A3D] font-medium">
              <Calendar className="h-3.5 w-3.5" />
              Scheduled for: {new Date(startTime).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => {
                setStartTime('');
                setSelectedPresetLabel(null);
              }}
              className="text-gray-400 hover:text-red-500 text-xs"
            >
              Send Immediately instead
            </button>
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

          {/* Row 2: To */}
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-4 flex-1 flex-wrap">
              <span className="w-16 text-gray-400 font-medium">To</span>
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {recipients.map((recip) => (
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

                <input
                  type="email"
                  placeholder={recipients.length === 0 ? "recipient@example.com" : "add more..."}
                  value={newRecipientInput}
                  onChange={(e) => setNewRecipientInput(e.target.value)}
                  onKeyDown={handleRecipientKeyDown}
                  onBlur={addCurrentInputAsRecipient}
                  className="flex-1 min-w-[200px] border-0 p-1 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => leadsFileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#00A854] hover:text-[#007A3D] transition shrink-0 px-2 py-1 hover:bg-green-50 rounded-lg"
              title="Upload CSV or TXT file of email leads"
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

          {/* Row 5: Large Body Container with Toolbar */}
          <div className="rounded-2xl bg-[#F9FAFB] border border-gray-200/90 overflow-hidden mt-4">
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

            <textarea
              id="compose-body"
              rows={7}
              placeholder="Type Your Reply..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-transparent p-5 text-sm text-gray-800 placeholder-gray-400 border-0 focus:outline-none focus:ring-0 resize-none font-normal leading-relaxed"
            />

            {/* Attachments Preview Gallery */}
            {attachments.length > 0 && (
              <div className="p-4 bg-white border-t border-gray-200/80 flex items-center gap-3 overflow-x-auto">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group flex items-center gap-2 p-2 rounded-xl border border-gray-200 bg-gray-50/80 shrink-0 max-w-[200px]"
                  >
                    {att.isImage && att.previewUrl ? (
                      <img
                        src={att.previewUrl}
                        alt={att.name}
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 truncate" title={att.name}>
                        {att.name}
                      </p>
                      <p className="text-[10px] text-gray-400">{att.sizeFormatted}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="text-gray-400 hover:text-red-500 p-0.5 rounded transition"
                      title="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
