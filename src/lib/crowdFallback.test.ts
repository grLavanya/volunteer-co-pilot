import { describe, it, expect } from 'vitest';
import { runFallback, type ZoneInput } from './crowdFallback';

const baseZones: ZoneInput[] = [
    { id: 'a', name: 'Gate A', occupancy_pct: 40, capacity: 2000, trend: 'stable' },
    { id: 'b', name: 'Gate B', occupancy_pct: 92, capacity: 1800, trend: 'rising' },
    { id: 'c', name: 'Central Concourse', occupancy_pct: 64, capacity: 5000, trend: 'stable' },
];

describe('runFallback — no zones over threshold', () => {
    it('returns has_recommendation: false when nothing is over threshold', () => {
        const zones: ZoneInput[] = [
            { id: 'a', name: 'Gate A', occupancy_pct: 40, capacity: 2000, trend: 'stable' },
        ];
        const result = runFallback(zones, {}, 80);
        expect(result).toEqual({ has_recommendation: false });
    });
});

describe('runFallback — zero connected zones', () => {
    it('returns a monitor-only recommendation when the affected zone has no connections', () => {
        const result = runFallback(baseZones, {}, 80);
        expect(result.has_recommendation).toBe(true);
        expect(result.affected_zone).toBe('Gate B');
        expect(result.recommendation).toMatch(/Monitor crowd levels in Gate B/);
        expect(result.reasoning).toMatch(/^\[Rule-based Fallback\]/);
        expect(result.reasoning).toMatch(/No connected zones are available/);
    });

    it('produces suggested_scripts in en/es/fr even with no connected zones', () => {
        const result = runFallback(baseZones, {}, 80);
        expect(result.suggested_scripts?.en).toMatch(/Gate B/);
        expect(result.suggested_scripts?.es).toMatch(/Gate B/);
        expect(result.suggested_scripts?.fr).toMatch(/Gate B/);
    });

    it('treats an explicitly empty connected-zone array the same as a missing entry', () => {
        const result = runFallback(baseZones, { b: [] }, 80);
        expect(result.recommendation).toMatch(/Monitor crowd levels in Gate B/);
    });
});

describe('runFallback — with connected zones', () => {
    it('redirects to the connected zone with the lowest occupancy', () => {
        const result = runFallback(baseZones, { b: ['a', 'c'] }, 80);
        expect(result.affected_zone).toBe('Gate B');
        // Gate A (40%) is lower than Central Concourse (64%), so Gate A should be picked
        expect(result.recommendation).toMatch(/Redirect fans from Gate B to Gate A/);
        expect(result.reasoning).toMatch(/lowest occupancy \(40%\)/);
    });

    it('ignores connected_zone_ids entries that reference a zone not present in the zones array', () => {
        const result = runFallback(baseZones, { b: ['nonexistent-id', 'a'] }, 80);
        expect(result.recommendation).toMatch(/Redirect fans from Gate B to Gate A/);
    });
});

describe('runFallback — multiple zones over threshold', () => {
    it('picks the single highest-occupancy zone as the affected zone', () => {
        const zones: ZoneInput[] = [
            { id: 'a', name: 'Gate A', occupancy_pct: 85, capacity: 2000, trend: 'rising' },
            { id: 'b', name: 'Gate B', occupancy_pct: 92, capacity: 1800, trend: 'rising' },
            { id: 'c', name: 'Gate C', occupancy_pct: 88, capacity: 2200, trend: 'rising' },
            { id: 'd', name: 'Central Concourse', occupancy_pct: 64, capacity: 5000, trend: 'stable' },
        ];
        // Mirrors the real 4-over-threshold scenario from the CSV bug — fallback should
        // still resolve to exactly one clear, well-formed recommendation, not error out.
        const result = runFallback(zones, { b: ['d'] }, 80);
        expect(result.affected_zone).toBe('Gate B'); // 92% is the highest
        expect(result.recommendation).toMatch(/Redirect fans from Gate B to Central Concourse/);
    });
});

describe('runFallback — threshold boundary', () => {
    it('includes a zone exactly at the threshold', () => {
        const zones: ZoneInput[] = [
            { id: 'a', name: 'Gate A', occupancy_pct: 80, capacity: 2000, trend: 'stable' },
        ];
        const result = runFallback(zones, {}, 80);
        expect(result.has_recommendation).toBe(true);
        expect(result.affected_zone).toBe('Gate A');
    });

    it('excludes a zone just below the threshold', () => {
        const zones: ZoneInput[] = [
            { id: 'a', name: 'Gate A', occupancy_pct: 79.9, capacity: 2000, trend: 'stable' },
        ];
        const result = runFallback(zones, {}, 80);
        expect(result).toEqual({ has_recommendation: false });
    });
});