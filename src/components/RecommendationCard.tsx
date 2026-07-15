import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { useCrowdReasoning } from '../hooks/useCrowdReasoning';
import type { ZoneWithSnapshot } from '../types/database';

interface RecommendationCardProps {
  zones: ZoneWithSnapshot[];
}

const urgencyConfig = {
  high: {
    bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  },
  medium: {
    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  },
  low: {
    bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  },
};

export default function RecommendationCard({ zones }: RecommendationCardProps) {
  const { recommendation, loading, error } = useCrowdReasoning(zones);
  const [activeLang, setActiveLang] = useState<'en' | 'es' | 'fr'>('en');
  const [copied, setCopied] = useState(false);

  const scripts = recommendation?.suggested_scripts || { en: '', es: '', fr: '' };
  const availableLangs = (['en', 'es', 'fr'] as const).filter((lang) => !!scripts[lang]);

  // Adjust active language if current selection is not available
  useEffect(() => {
    if (availableLangs.length > 0 && !availableLangs.includes(activeLang)) {
      setActiveLang(availableLangs[0]);
    }
  }, [availableLangs, activeLang]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasRec = recommendation && recommendation.has_recommendation;
  const urgency = recommendation?.urgency || 'medium';
  const cfg = urgencyConfig[urgency];

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
            AI Recommendation
          </h2>
        </div>
        {hasRec && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badge}`}>
            {urgency} Priority
          </span>
        )}
      </div>

      {loading && (
        <div className="mt-6 flex flex-col items-center justify-center py-6 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          <span className="mt-2 text-xs text-slate-400 font-medium">Analyzing crowd distribution…</span>
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 flex gap-2 rounded-md border border-red-800 bg-red-950/20 p-3 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div>
            <span className="font-semibold block mb-0.5">Analysis failed</span>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && hasRec && recommendation && (
        <div className="mt-4 space-y-4">
          {/* Main Action Block */}
          <div className={`rounded-md border p-3.5 ${cfg.bg}`}>
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-75">
              Suggested Action for {recommendation.affected_zone}
            </span>
            <p className="mt-1 text-sm font-semibold text-white">
              {recommendation.recommendation}
            </p>
          </div>

          {/* Reasoning Explanation */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Reasoning</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed font-medium">
              {recommendation.reasoning}
            </p>
          </div>

          {/* Multilingual Suggested Scripts */}
          {availableLangs.length > 0 && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Suggested Script</h3>
                <div className="flex gap-1">
                  {availableLangs.includes('en') && (
                    <button
                      onClick={() => setActiveLang('en')}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        activeLang === 'en' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      EN
                    </button>
                  )}
                  {availableLangs.includes('es') && (
                    <button
                      onClick={() => setActiveLang('es')}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        activeLang === 'es' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ES
                    </button>
                  )}
                  {availableLangs.includes('fr') && (
                    <button
                      onClick={() => setActiveLang('fr')}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        activeLang === 'fr' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      FR
                    </button>
                  )}
                </div>
              </div>

              <div className="relative mt-2 rounded-md border border-slate-700 bg-slate-900/60 p-3 pr-9 text-xs text-slate-300 font-medium italic leading-relaxed">
                "{scripts[activeLang]}"
                <button
                  onClick={() => handleCopy(scripts[activeLang] || '')}
                  className="absolute top-2 right-2 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                  title="Copy script"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !hasRec && (
        <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-dashed border-slate-600 py-8 text-center">
          <Sparkles className="h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No active recommendations</p>
          <p className="mt-1 text-xs text-slate-500">
            Crowd-management suggestions will appear here when the AI layer is connected.
          </p>
        </div>
      )}
    </div>
  );
}

