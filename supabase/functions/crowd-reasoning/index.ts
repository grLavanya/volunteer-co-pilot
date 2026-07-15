// Supabase Edge Function: crowd-reasoning
// Powers the AI Recommendation card on the Volunteer Dashboard.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ZoneInput {
  id: string;
  name: string;
  occupancy_pct: number;
  capacity: number;
  trend: 'rising' | 'falling' | 'stable';
}

interface RequestInput {
  zones: ZoneInput[];
  connected_zone_ids: Record<string, string[]>;
  threshold_pct: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestInput = await req.json();
    const { zones, connected_zone_ids, threshold_pct } = body;

    // 1. Basic validation
    if (!zones || !Array.isArray(zones)) {
      return new Response(JSON.stringify({ error: 'Invalid input: zones must be an array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const threshold = typeof threshold_pct === 'number' ? threshold_pct : 80;

    // Rule 1: Only recommend action if at least one zone's occupancy_pct meets or exceeds the given threshold_pct.
    const hasZoneOverThreshold = zones.some((z) => z.occupancy_pct >= threshold);
    if (!hasZoneOverThreshold) {
      // Rule 6: If no zone crosses the threshold, return only { "has_recommendation": false }
      return new Response(JSON.stringify({ has_recommendation: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('GEMINI_API_KEY secret is not set. Executing rule-based fallback.');
      const fallback = runFallback(zones, connected_zone_ids, threshold);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Gemini API (gemini-2.5-flash)
    const systemPrompt = `You are a crowd-management reasoning assistant for stadium volunteers during the FIFA World Cup 2026. You are given live occupancy data for stadium zones and their adjacency (which zones connect to which). Your job is NOT to just detect high occupancy — that's already computed for you as occupancy_pct. Your job is to REASON about what a volunteer should do about it, and explain WHY in plain English.

Rules:
1. Only recommend action if at least one zone's occupancy_pct meets or exceeds the given threshold_pct.
2. When recommending a redirect, the target zone must be reachable via connected_zone_ids (directly or via one intermediate zone) and must have meaningfully lower occupancy_pct than the affected zone.
3. Your "reasoning" field must reference the actual numbers (occupancy %, trend) — do not give generic advice. Be specific: which zone, what percentage, what trend, why the alternative is better.
4. Prefer zones with a "falling" trend as redirect targets over "stable" ones, and avoid recommending a zone that is itself near threshold.
5. Generate suggested_scripts in English, Spanish, and French. Keep the tone calm, brief, and directive — this will be read aloud or shown to a volunteer speaking to a stressed fan.
6. If no zone crosses the threshold, return only { "has_recommendation": false } — never invent a recommendation to seem useful.
7. Return ONLY valid JSON matching the schema below. No preamble, no markdown formatting, no explanation outside the JSON.

Output schema:
{
  "has_recommendation": boolean,
  "urgency": "low" | "medium" | "high",
  "affected_zone": string,
  "recommendation": string,
  "reasoning": string,
  "suggested_scripts": { "en": string, "es": string, "fr": string }
}`;

    const userPrompt = JSON.stringify({ zones, connected_zone_ids, threshold_pct: threshold }, null, 2);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gemini API returned HTTP status ${response.status}`);
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini API returned an empty text field');
      }

      // Handle the case where Gemini's response isn't valid JSON (strip markdown fences if present, retry parse once, then fall back)
      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('First JSON parse failed, attempting markdown cleanup. Raw response:', rawText, parseErr);
        try {
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
          }
          parsedData = JSON.parse(cleaned);
        } catch (retryErr) {
          console.warn('Markdown cleanup parse failed, attempting braces extraction:', retryErr);
          const firstBrace = rawText.indexOf('{');
          const lastBrace = rawText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            parsedData = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
          } else {
            throw new Error('No JSON structure found in Gemini response');
          }
        }
      }

      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (geminiErr) {
      clearTimeout(timeoutId);
      console.error('Gemini call failed or timed out. Running rule-based fallback.', geminiErr);
      const fallback = runFallback(zones, connected_zone_ids, threshold);
      return new Response(JSON.stringify({
        ...fallback,
        gemini_error: geminiErr instanceof Error ? geminiErr.message : String(geminiErr)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    console.error('Unhandled internal error in edge function:', err);
    // Even in unhandled internal errors, we want to return a clean error object without crashing
    return new Response(
      JSON.stringify({
        has_recommendation: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function runFallback(zones: ZoneInput[], connected_zone_ids: Record<string, string[]>, threshold_pct: number) {
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
