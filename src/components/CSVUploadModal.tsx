import { useState } from 'react';
import { X, UploadCloud, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { ZoneWithSnapshot } from '../types/database';
import { parseAndValidateCSV, type RowResult } from '../lib/csvParser';

interface CSVUploadModalProps {
    open: boolean;
    onClose: () => void;
    zones: ZoneWithSnapshot[];
    onUploaded: () => void;
}

export default function CSVUploadModal({ open, onClose, zones, onUploaded }: CSVUploadModalProps) {
    const [fileName, setFileName] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<RowResult[] | null>(null);
    const [globalError, setGlobalError] = useState<string | null>(null);

    if (!open) return null;

    function resetState() {
        setFileName(null);
        setResults(null);
        setGlobalError(null);
    }

    function handleClose() {
        resetState();
        onClose();
    }

    function downloadSampleCSV() {
        const sampleRows = [
            ['zone_name', 'density_pct', 'trend'],
            ...zones.slice(0, 3).map((z) => [z.name, '75', 'rising']),
        ];
        const csv = sampleRows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample-crowd-data.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    async function handleFile(file: File) {
        setFileName(file.name);
        setResults(null);
        setGlobalError(null);
        setUploading(true);

        try {
            const text = await file.text();
            const { globalError: parseError, rowResults, toInsert } = parseAndValidateCSV(text, zones);

            if (parseError) {
                setGlobalError(parseError);
                setUploading(false);
                return;
            }

            if (toInsert.length > 0) {
                const { error: insertErr } = await supabase.from('crowd_snapshots').insert(toInsert);
                if (insertErr) {
                    setGlobalError(`Database error while saving: ${insertErr.message}`);
                    setUploading(false);
                    return;
                }
                onUploaded();
            }

            setResults(rowResults);
        } catch (err) {
            setGlobalError(err instanceof Error ? err.message : 'Failed to read or parse the file.');
        } finally {
            setUploading(false);
        }
    }

    const okCount = results?.filter((r) => r.status === 'ok').length ?? 0;
    const errorCount = results?.filter((r) => r.status === 'error').length ?? 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
            onClick={handleClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="csv-upload-title"
                className="w-full max-w-lg rounded-t-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15">
                            <UploadCloud className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 id="csv-upload-title" className="text-base font-semibold text-slate-100">
                                Upload Crowd Data
                            </h2>
                            <p className="text-xs text-slate-400">For judges to test with real datasets</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-400">
                    <p className="mb-1 font-medium text-slate-300">Expected CSV format</p>
                    <p>
                        Required column: <code className="text-cyan-400">zone_name</code>. Plus either{' '}
                        <code className="text-cyan-400">density_pct</code> (0-100) or{' '}
                        <code className="text-cyan-400">current_occupancy</code> (a raw headcount).
                        Optional: <code className="text-cyan-400">trend</code> (rising / falling / stable).
                    </p>
                    <button
                        onClick={downloadSampleCSV}
                        className="mt-2 flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download sample CSV
                    </button>
                </div>

                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 py-8 text-center transition-colors hover:border-cyan-500/50">
                    <UploadCloud className="h-8 w-8 text-slate-500" />
                    <span className="mt-2 text-sm text-slate-300">
                        {fileName ? fileName : 'Click to select a .csv file'}
                    </span>
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                    />
                </label>

                {uploading && (
                    <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-400">
                        Processing…
                    </p>
                )}

                {globalError && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="mt-4 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{globalError}</span>
                    </div>
                )}

                {results && (
                    <div className="mt-4" role="status" aria-live="polite">
                        <div className="mb-2 flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="h-4 w-4" /> {okCount} applied
                            </span>
                            {errorCount > 0 && (
                                <span className="flex items-center gap-1 text-amber-400">
                                    <AlertCircle className="h-4 w-4" /> {errorCount} skipped
                                </span>
                            )}
                        </div>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/30 p-2">
                            {results.map((r, i) => (
                                <p
                                    key={i}
                                    className={`text-xs ${r.status === 'ok' ? 'text-slate-400' : 'text-amber-400'}`}
                                >
                                    Line {r.line}: {r.message}
                                </p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}