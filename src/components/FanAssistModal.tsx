import { useEffect } from 'react';
import { Mic, X, Languages } from 'lucide-react';

interface FanAssistModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FanAssistModal({ open, onClose }: FanAssistModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15">
              <Mic className="h-5 w-5 text-cyan-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">Assist a Fan</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 py-10 text-center">
          <Languages className="h-10 w-10 text-slate-600" />
          <p className="mt-4 text-sm text-slate-300">Language detection coming soon</p>
          <p className="mt-1.5 max-w-xs text-xs text-slate-500">
            Real-time multilingual translation will be available here once the language
            layer is connected.
          </p>
        </div>
      </div>
    </div>
  );
}
