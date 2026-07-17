export type Trend = 'rising' | 'falling' | 'stable';

export interface RowResult {
    line: number;
    status: 'ok' | 'error';
    message: string;
}

export interface CSVZoneLike {
    id: string;
    name: string;
    capacity: number;
}

export interface CSVInsertRow {
    zone_id: string;
    density_pct: number;
    trend: Trend;
}

export interface ParseCSVResult {
    globalError: string | null;
    rowResults: RowResult[];
    toInsert: CSVInsertRow[];
}

export const VALID_TRENDS: Trend[] = ['rising', 'falling', 'stable'];

/**
 * Minimal CSV line splitter. Handles simple quoted fields but is intentionally
 * lightweight — this app's CSV format has no commas inside field values
 * (zone names, numbers, trend keywords), so a full RFC4180 parser is not needed.
 */
export function parseCSVLine(line: string): string[] {
    return line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

/**
 * Parses and validates an uploaded crowd-data CSV against the known zones.
 * Pure function — no file I/O, no network calls, no React state — so it can
 * be unit tested directly against arbitrary CSV strings and zone lists.
 */
export function parseAndValidateCSV(text: string, zones: CSVZoneLike[]): ParseCSVResult {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
        return {
            globalError: 'The file has no data rows — only a header (or is empty).',
            rowResults: [],
            toInsert: [],
        };
    }

    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    const nameIdx = header.indexOf('zone_name');
    const densityIdx = header.indexOf('density_pct');
    const occupancyIdx = header.indexOf('current_occupancy');
    const trendIdx = header.indexOf('trend');

    if (nameIdx === -1) {
        return {
            globalError: 'Missing required column: "zone_name".',
            rowResults: [],
            toInsert: [],
        };
    }
    if (densityIdx === -1 && occupancyIdx === -1) {
        return {
            globalError: 'File must include either a "density_pct" or "current_occupancy" column.',
            rowResults: [],
            toInsert: [],
        };
    }

    const rowResults: RowResult[] = [];
    const toInsert: CSVInsertRow[] = [];

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

    return { globalError: null, rowResults, toInsert };
}