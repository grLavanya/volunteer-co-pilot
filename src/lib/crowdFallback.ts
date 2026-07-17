/**
 * This is a mirrored copy of the `runFallback` logic that lives in the deployed
 * edge function at supabase/functions/crowd-reasoning/index.ts.
 *
 * It is NOT imported by the edge function itself — Supabase edge functions run
 * on Deno and are deployed independently, while this file is tested under
 * Vitest/Node as part of the frontend build. This mirror exists purely so the
 * fallback's branching logic (which is pure, dependency-free TypeScript with
 * no Deno-specific APIs) can get automated edge-case coverage.
 *
 * IMPORTANT: if you ever change runFallback in the edge function, update this
 * file to match, or the tests will silently stop reflecting real behavior.
 */

export type Trend = 'rising' | 'falling' | 'stable';

export interface ZoneInput {
    id: string;
    name: string;
    occupancy_pct: number;
    capacity: number;
    trend: Trend;
}

export function runFallback(
    zones: ZoneInput[],
    connected_zone_ids: Record<string, string[]>,
    threshold_pct: number
) {
    // Find any zone with occupancy_pct >= threshold_pct
    const overCapacityZones = zones
        .filter((z) => z.occupancy_pct >= threshold_pct)
        .sort((a, b) => b.occupancy_pct - a.occupancy_pct);

    if (overCapacityZones.length === 0) {
        return { has_recommendation: false };
    }

    const affectedZone = overCapacityZones[0];
    const connectedIds = connected_zone_ids[affectedZone.id] || [];
    const connectedZones = zones.filter((z) => connectedIds.includes(z.id));

    if (connectedZones.length === 0) {
        return {
            has_recommendation: true,
            urgency: 'high' as const,
            affected_zone: affectedZone.name,
            recommendation: `Monitor crowd levels in ${affectedZone.name}.`,
            reasoning: `[Rule-based Fallback] Zone ${affectedZone.name} is over threshold at ${affectedZone.occupancy_pct}% (threshold: ${threshold_pct}%). No connected zones are available for redirection.`,
            suggested_scripts: {
                en: `Attention: Crowd levels in ${affectedZone.name} are high. Please monitor closely.`,
                es: `Atención: Los niveles de multitud en ${affectedZone.name} son altos. Controle de cerca.`,
                fr: `Attention : Les niveaux de foule dans ${affectedZone.name} sont élevés. Veuillez surveiller de près.`,
            },
        };
    }

    // Pick the connected zone with the lowest occupancy_pct as target
    const targetZone = connectedZones.reduce(
        (prev, curr) => (curr.occupancy_pct < prev.occupancy_pct ? curr : prev),
        connectedZones[0]
    );

    return {
        has_recommendation: true,
        urgency: 'high' as const,
        affected_zone: affectedZone.name,
        recommendation: `Redirect fans from ${affectedZone.name} to ${targetZone.name}.`,
        reasoning: `[Rule-based Fallback] Zone ${affectedZone.name} is over threshold at ${affectedZone.occupancy_pct}% (threshold: ${threshold_pct}%). Redirecting to adjacent zone ${targetZone.name} which has the lowest occupancy (${targetZone.occupancy_pct}%).`,
        suggested_scripts: {
            en: `Attention: Please guide fans away from ${affectedZone.name} and redirect them towards ${targetZone.name}.`,
            es: `Atención: Por favor, desvíe a los aficionados de ${affectedZone.name} y diríjanlos hacia ${targetZone.name}.`,
            fr: `Attention : Veuillez rediriger les supporters hors de ${affectedZone.name} et les diriger vers ${targetZone.name}.`,
        },
    };
}