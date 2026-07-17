import { describe, it, expect } from 'vitest';
import { parseAndValidateCSV, parseCSVLine, type CSVZoneLike } from './csvParser';

const mockZones: CSVZoneLike[] = [
    { id: 'zone-1', name: 'Central Concourse', capacity: 5000 },
    { id: 'zone-2', name: 'Gate A', capacity: 2000 },
    { id: 'zone-3', name: 'Gate B', capacity: 1800 },
];

describe('parseCSVLine', () => {
    it('splits a simple comma-separated line', () => {
        expect(parseCSVLine('Gate A,75,rising')).toEqual(['Gate A', '75', 'rising']);
    });

    it('strips surrounding quotes from quoted fields', () => {
        expect(parseCSVLine('"Gate A","75","rising"')).toEqual(['Gate A', '75', 'rising']);
    });

    it('trims whitespace around cells', () => {
        expect(parseCSVLine(' Gate A , 75 , rising ')).toEqual(['Gate A', '75', 'rising']);
    });
});

describe('parseAndValidateCSV — file-level errors', () => {
    it('rejects a file with only a header row', () => {
        const result = parseAndValidateCSV('zone_name,density_pct', mockZones);
        expect(result.globalError).toMatch(/no data rows/i);
        expect(result.toInsert).toHaveLength(0);
    });

    it('rejects a completely empty file', () => {
        const result = parseAndValidateCSV('', mockZones);
        expect(result.globalError).toMatch(/no data rows/i);
    });

    it('rejects a file missing the zone_name column', () => {
        const csv = 'density_pct,trend\n75,rising';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.globalError).toMatch(/zone_name/i);
    });

    it('rejects a file with neither density_pct nor current_occupancy columns', () => {
        const csv = 'zone_name,trend\nGate A,rising';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.globalError).toMatch(/density_pct.*current_occupancy/i);
    });

    it('accepts a file that has current_occupancy but no density_pct column', () => {
        const csv = 'zone_name,current_occupancy\nGate A,1000';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.globalError).toBeNull();
    });
});

describe('parseAndValidateCSV — row-level: zone matching', () => {
    it('flags an unknown zone name', () => {
        const csv = 'zone_name,density_pct\nGate Z,50';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/Unknown zone "Gate Z"/);
        expect(result.toInsert).toHaveLength(0);
    });

    it('matches zone names case-insensitively', () => {
        const csv = 'zone_name,density_pct\ngate a,50';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('ok');
        expect(result.toInsert[0].zone_id).toBe('zone-2');
    });

    it('flags a row with a missing zone_name value', () => {
        const csv = 'zone_name,density_pct\n,50';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/Missing zone_name/);
    });
});

describe('parseAndValidateCSV — row-level: density_pct validation', () => {
    it('accepts a valid density_pct value', () => {
        const csv = 'zone_name,density_pct\nGate A,73.5';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('ok');
        expect(result.toInsert[0].density_pct).toBe(73.5);
    });

    it('rejects a non-numeric density_pct value', () => {
        const csv = 'zone_name,density_pct\nGate A,not-a-number';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/Invalid density_pct/);
    });

    it('rejects a negative density_pct value', () => {
        const csv = 'zone_name,density_pct\nGate A,-15';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/out of valid range/);
    });

    it('rejects a density_pct value over 100', () => {
        const csv = 'zone_name,density_pct\nGate A,150';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/out of valid range/);
    });

    it('accepts boundary values 0 and 100', () => {
        const csv = 'zone_name,density_pct\nGate A,0\nGate B,100';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('ok');
        expect(result.rowResults[1].status).toBe('ok');
    });
});

describe('parseAndValidateCSV — row-level: current_occupancy validation', () => {
    it('computes density_pct correctly from current_occupancy and zone capacity', () => {
        const csv = 'zone_name,current_occupancy\nGate B,900'; // capacity 1800
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('ok');
        expect(result.toInsert[0].density_pct).toBeCloseTo(50, 5);
    });

    it('rejects a non-numeric current_occupancy value', () => {
        const csv = 'zone_name,current_occupancy\nGate A,lots';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/Invalid current_occupancy/);
    });

    it('rejects current_occupancy for a zone with zero capacity', () => {
        const zonesWithZeroCapacity: CSVZoneLike[] = [{ id: 'zone-x', name: 'Zone X', capacity: 0 }];
        const csv = 'zone_name,current_occupancy\nZone X,500';
        const result = parseAndValidateCSV(csv, zonesWithZeroCapacity);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/no valid capacity/);
    });

    it('rejects current_occupancy that pushes computed density_pct over 100', () => {
        const csv = 'zone_name,current_occupancy\nGate B,5000'; // capacity 1800, way over
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/out of valid range/);
    });

    it('prefers density_pct over current_occupancy when both columns are present and both have values', () => {
        const csv = 'zone_name,density_pct,current_occupancy\nGate A,60,999999';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.toInsert[0].density_pct).toBe(60);
    });
});

describe('parseAndValidateCSV — row-level: trend validation', () => {
    it('accepts each valid trend value', () => {
        const csv = 'zone_name,density_pct,trend\nGate A,50,rising\nGate B,50,falling\nCentral Concourse,50,stable';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.toInsert.map((r) => r.trend)).toEqual(['rising', 'falling', 'stable']);
    });

    it('defaults to stable and flags an error message when trend column is present but invalid', () => {
        const csv = 'zone_name,density_pct,trend\nGate A,50,sideways';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults[0].status).toBe('error');
        expect(result.rowResults[0].message).toMatch(/Invalid trend "sideways"/);
        // Still gets inserted with the safe default, since only the label was bad
        expect(result.toInsert[0].trend).toBe('stable');
    });

    it('defaults to stable when trend column is absent entirely', () => {
        const csv = 'zone_name,density_pct\nGate A,50';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.toInsert[0].trend).toBe('stable');
        expect(result.rowResults[0].status).toBe('ok');
    });

    it('matches trend values case-insensitively', () => {
        const csv = 'zone_name,density_pct,trend\nGate A,50,RISING';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.toInsert[0].trend).toBe('rising');
    });
});

describe('parseAndValidateCSV — mixed valid/invalid rows (realistic judge-upload scenario)', () => {
    it('processes valid rows and skips invalid ones independently, preserving line numbers', () => {
        const csv = [
            'zone_name,density_pct,trend',
            'Gate A,73,rising', // line 2 — ok
            'Gate Z,50,rising', // line 3 — unknown zone
            'Gate B,-10,stable', // line 4 — out of range
            'Central Concourse,64,falling', // line 5 — ok
        ].join('\n');

        const result = parseAndValidateCSV(csv, mockZones);

        expect(result.globalError).toBeNull();
        expect(result.toInsert).toHaveLength(2);
        expect(result.rowResults).toHaveLength(4);
        expect(result.rowResults.map((r) => r.line)).toEqual([2, 3, 4, 5]);
        expect(result.rowResults.map((r) => r.status)).toEqual(['ok', 'error', 'error', 'ok']);
    });

    it('handles four simultaneous over-threshold zones without error (mirrors the crowd-reasoning bug scenario)', () => {
        const csv = [
            'zone_name,density_pct,trend',
            'Gate A,92,rising',
            'Gate B,86,rising',
            'Central Concourse,85,rising',
            'Gate B,88,rising', // duplicate zone name is allowed — last value wins downstream at insert time
        ].join('\n');

        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.toInsert).toHaveLength(4);
        expect(result.rowResults.every((r) => r.status === 'ok')).toBe(true);
    });

    it('ignores blank lines in the file', () => {
        const csv = 'zone_name,density_pct\n\nGate A,50\n\n';
        const result = parseAndValidateCSV(csv, mockZones);
        expect(result.rowResults).toHaveLength(1);
        expect(result.toInsert).toHaveLength(1);
    });
});