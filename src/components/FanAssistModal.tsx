import { useEffect, useState } from 'react';
import { Mic, X, Languages, Copy, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface FanAssistModalProps {
  open: boolean;
  onClose: () => void;
  volunteerId?: string;
}

interface FanAssistResult {
  detected_language: string;
  detected_language_code?: string;
  context_tag: 'general' | 'medical' | 'accessibility';
  urgency: 'low' | 'medium' | 'high';
  translated_message: string;
  suggested_response: string;
}

const contextStyles: Record<string, { badge: string; label: string }> = {
  medical: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Medical' },
  accessibility: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Accessibility' },
  general: { badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30', label: 'General' },
};

export default function FanAssistModal({ open, onClose, volunteerId }: FanAssistModalProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FanAssistResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset state each time the modal is opened fresh
  useEffect(() => {
    if (open) {
      setMessage('');
      setResult(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleTranslate() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('fan-assist', {
        body: {
          fan_message: message.trim(),
          volunteer_language: 'en',
          volunteer_id: volunteerId,
        },
      });

      if (invokeError) throw invokeError;
      setResult(data as FanAssistResult);
    } catch (err) {
      console.error('fan-assist call failed:', err);
      setError('Something went wrong reaching the assistant. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.suggested_response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const style = result ? contextStyles[result.context_tag] ?? contextStyles.general : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fan-assist-title"
        className="w-full max-w-md rounded-t-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15">
              <Languages className="h-5 w-5 text-cyan-400" />
            </div>
            <h2 id="fan-assist-title" className="text-base font-semibold text-slate-100">
              Assist a Fan
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <label htmlFor="fan-message" className="mb-1.5 block text-xs font-medium text-slate-400">
            Type or paste what the fan said
          </label>
          <div className="flex items-start gap-2">
            <textarea
              id="fan-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. ¿Dónde está el baño accesible para silla de ruedas?"
              rows={3}
              className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            {/* Voice input placeholder — not wired up yet, visual only */}
            <button
              type="button"
              disabled
              title="Voice input coming soon"
              aria-label="Voice input coming soon"
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-500 cursor-not-allowed"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleTranslate}
            disabled={!message.trim() || loading}
            className="mt-3 w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? 'Translating...' : 'Translate'}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && style && (
          <div className="mt-5 space-y-3" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
                {style.label}
              </span>
              {result.urgency === 'high' && (
                <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                  High urgency
                </span>
              )}
              <span className="text-xs text-slate-500">Detected: {result.detected_language}</span>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">What they said</p>
              <p className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-200">
                {result.translated_message}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">Suggested response</p>
              <div className="relative rounded-lg border border-cyan-700/40 bg-cyan-950/20 p-3 pr-10 text-sm italic text-slate-100">
                {result.suggested_response}
                <button
                  onClick={handleCopy}
                  title="Copy"
                  aria-label="Copy suggested response"
                  className="absolute right-2.5 top-2.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}