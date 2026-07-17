import { useState } from 'react';
import { X, UploadCloud, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { ZoneWithSnapshot, Trend } from '../types/database';

interface CSVUploadModalProps {
    open: boolean;
    onClose: () => void;
    zones: ZoneWithSnapshot[];
    onUploaded: () => void;
}

interface RowResult {
    line: number;
    status: 'ok' | 'error';
    message: string;
}

const VALID_TRENDS: Trend[] = ['rising', 'falling', 'stable'];

/**
 * Minimal CSV line splitter. Handles simple quoted fields but is intentionally
 * lightweight — this app's CSV format has no commas inside field values
 * (zone names, numbers, trend keywords), so a full RFC4180 parser is not needed.
 */
function parseCSVLine(line: string): string[] {
    return line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
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
            const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

            if (lines.length < 2) {
                setGlobalError('The file has no data rows — only a header (or is empty).');
                setUploading(false);
                return;
            }

            const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
            const nameIdx = header.indexOf('zone_name');
            const densityIdx = header.indexOf('density_pct');
            const occupancyIdx = header.indexOf('current_occupancy');
            const trendIdx = header.indexOf('trend');

            if (nameIdx === -1) {
                setGlobalError('Missing required column: "zone_name".');
                setUploading(false);
                return;
            }
            if (densityIdx === -1 && occupancyIdx === -1) {
                setGlobalError('File must include either a "density_pct" or "current_occupancy" column.');
                setUploading(false);
                return;
            }

            const rowResults: RowResult[] = [];
            const toInsert: { zone_id: string; density_pct: number; trend: Trend }[] = [];

            for (let i = 1; i < lines.length; i++) {
                const lineNum = i + 1; // 1-indexed, accounting for header
                const cells = parseCSVLine(lines[i]);
                const rawName = cells[nameIdx]?.trim();

                if (!rawName) {
                    rowResults.push({ line: lineNum, status: 'error', message: 'Missing zone_name.' });
                    continue;
                }

                const zone = zones.find((z) => z.name.toLowerCase() === rawName.toLowerCase());
                if (!zone) {
                    rowResults.push({
                        line: lineNum,
                        status: 'error',
                        message: `Unknown zone "${rawName}" — no matching zone in the system.`,
                    });
                    continue;
                }

                let densityPct: number | null = null;

                if (densityIdx !== -1 && cells[densityIdx]) {
                    const parsed = parseFloat(cells[densityIdx]);
                    if (isNaN(parsed)) {
                        rowResults.push({
                            line: lineNum,
                            status: 'error',
                            message: `Invalid density_pct value "${cells[densityIdx]}" for ${zone.name}.`,
                        });
                        continue;
                    }
                    densityPct = parsed;
                } else if (occupancyIdx !== -1 && cells[occupancyIdx]) {
                    const parsedCount = parseFloat(cells[occupancyIdx]);
                    if (isNaN(parsedCount)) {
                        rowResults.push({
                            line: lineNum,
                            status: 'error',
                            message: `Invalid current_occupancy value "${cells[occupancyIdx]}" for ${zone.name}.`,
                        });
                        continue;
                    }
                    if (!zone.capacity || zone.capacity <= 0) {
                        rowResults.push({
                            line: lineNum,
                            status: 'error',
                            message: `Cannot compute percentage for ${zone.name} — zone has no valid capacity on record.`,
                        });
                        continue;
                    }
                    densityPct = (parsedCount / zone.capacity) * 100;
                } else {
                    rowResults.push({
                        line: lineNum,
                        status: 'error',
                        message: `No density_pct or current_occupancy value provided for ${zone.name}.`,
                    });
                    continue;
                }

                // Clamp to a sane 0-100 range rather than silently accepting bad data
                if (densityPct < 0 || densityPct > 100) {
                    rowResults.push({
                        line: lineNum,
                        status: 'error',
                        message: `${zone.name}: occupancy ${densityPct.toFixed(1)}% is out of valid range (0-100).`,
                    });
                    continue;
                }

                let trend: Trend = 'stable';
                if (trendIdx !== -1 && cells[trendIdx]) {
                    const rawTrend = cells[trendIdx].toLowerCase() as Trend;
                    if (VALID_TRENDS.includes(rawTrend)) {
                        trend = rawTrend;
                    } else {
                        rowResults.push({
                            line: lineNum,
                            status: 'error',
                            message: `Invalid trend "${cells[trendIdx]}" for ${zone.name} — must be rising, falling, or stable. Defaulted to "stable".`,
                        });
                        trend = 'stable';
                    }
                }

                toInsert.push({ zone_id: zone.id, density_pct: densityPct, trend });
                rowResults.push({
                    line: lineNum,
                    status: 'ok',
                    message: `${zone.name} updated to ${densityPct.toFixed(1)}% (${trend}).`,
                });
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
                className="w-full max-w-lg rounded-t-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15">
                            <UploadCloud className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-100">Upload Crowd Data</h2>
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

                {uploading && <p className="mt-3 text-sm text-slate-400">Processing…</p>}

                {globalError && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{globalError}</span>
                    </div>
                )}

                {results && (
                    <div className="mt-4">
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