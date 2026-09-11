import React from 'react';
import { ArrowLeft, Star, Trash2, Archive } from 'lucide-react';
import type { EmailJob } from '../types';

interface EmailDetailModalProps {
  email: EmailJob | null;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ email, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!email) return null;

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    if (window.confirm('Are you sure you want to delete this email?')) {
      setIsDeleting(true);
      try {
        await onDelete(email.id);
        onClose();
      } catch (err) {
        console.error('Failed to delete email:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const isSent = email.status === 'SENT';
  const displayDate = email.sentAt
    ? new Date(email.sentAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : new Date(email.scheduledAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  const senderEmail = email.sender?.emailAddress || 'sender@reachinbox.ai';
  const senderInitial = senderEmail.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        {/* Top Header matching Figma Image 4 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
              title="Back to inbox"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate max-w-xl">
              {email.subject}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-gray-400">
            <button className="p-1.5 hover:text-amber-500 transition" title="Star">
              <Star className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:text-gray-700 transition" title="Archive">
              <Archive className="h-4 w-4" />
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-gray-400 disabled:opacity-50"
                title="Delete email"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Email Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Sender & Recipient Info */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#00A854] text-white flex items-center justify-center font-bold text-sm">
                {senderInitial}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{senderEmail.split('@')[0]}</span>
                  <span className="text-xs text-gray-500">&lt;{senderEmail}&gt;</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  to {email.recipient} &bull; <span className="font-medium text-gray-600">{email.status}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400 font-medium">
              {displayDate}
            </div>
          </div>

          {/* Email Subject / Header */}
          <div className="pt-2">
            <h3 className="text-base font-semibold text-gray-800">
              {email.subject}
            </h3>
          </div>

          {/* Highlight Offer Banner (matching Figma Image 4 style) */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              ⚡ ReachInbox Automated Scheduler Notice ⚡
            </p>
            <p className="text-amber-800/90 text-xs">
              This message was processed via BullMQ delayed queue with Redis rate-limiting.
            </p>
          </div>

          {/* Email Body text */}
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-normal">
            {email.body}
          </div>

          {/* Ethereal SMTP Link if Sent */}
          {isSent && (
            <div className="pt-4 border-t border-gray-150 flex items-center justify-between">
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                ✓ Delivered via Ethereal SMTP (Test Sandbox)
              </span>
              <a
                href="https://ethereal.email/messages"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#00A854] hover:underline font-semibold"
              >
                <span>View in Ethereal Mailbox</span>
                <span className="text-[10px]">↗</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
