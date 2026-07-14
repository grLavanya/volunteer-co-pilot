import { Sparkles } from 'lucide-react';

export default function RecommendationCard() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-cyan-400" />
        <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
          AI Recommendation
        </h2>
      </div>

      {/* Placeholder — structurally ready for GenAI, visually honest that it's empty */}
      <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-dashed border-slate-600 py-8 text-center">
        <Sparkles className="h-8 w-8 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No active recommendations</p>
        <p className="mt-1 text-xs text-slate-500">
          Crowd-management suggestions will appear here when the AI layer is connected.
        </p>
      </div>
    </div>
  );
}
