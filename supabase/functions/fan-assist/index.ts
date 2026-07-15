// Supabase Edge Function: fan-assist
// Powers the "Assist a Fan" modal — translates + detects context for volunteer-fan communication.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestInput {
    fan_message: string;
    volunteer_language: string;
    volunteer_id?: string;
}

const SYSTEM_PROMPT = `You are a translation and context assistant helping a stadium volunteer communicate with a fan during the FIFA World Cup 2026. The volunteer only speaks volunteer_language. The fan has spoken in an unknown language.

Your job:
1. Detect the fan's language.
2. Detect the context/urgency of their message: "general" (directions, food, basic questions), "medical" (injury, illness, distress — anything suggesting urgent physical need), or "accessibility" (wheelchair access, hearing/vision assistance, mobility needs).
3. Translate the fan's message into volunteer_language so the volunteer understands what was said.
4. Generate a suggested response IN THE FAN'S DETECTED LANGUAGE that the volunteer can read aloud or show on their phone. Match tone to context: calm and reassuring for medical, warm and helpful for general, clear and respectful for accessibility. Use an appropriately formal or informal register based on how the fan phrased their message — do not default to a generic tone.
5. If the message clearly indicates a medical emergency (not just "medical" context but active distress), flag urgency as "high" so the UI can visually emphasize it.

Return ONLY valid JSON, no markdown, no preamble:
{
  "detected_language": string (language name, e.g. "Spanish"),
  "detected_language_code": string (ISO 639-1, e.g. "es"),
  "context_tag": "general" | "medical" | "accessibility",
  "urgency": "low" | "medium" | "high",
  "translated_message": string (fan's message, translated to volunteer_language),
  "suggested_response": string (response in the fan's own language)
}`;

Deno.serve(async (req) => {
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
        const { fan_message, volunteer_language, volunteer_id } = body;

        if (!fan_message || typeof fan_message !== 'string' || fan_message.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'fan_message is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const langTarget = volunteer_language || 'en';
        const apiKey = Deno.env.get('GEMINI_API_KEY');

        let result: Record<string, unknown>;
        let usedFallback = false;

        if (!apiKey) {
            console.warn('GEMINI_API_KEY not set. Using fallback.');
            result = fallbackResult(fan_message);
            usedFallback = true;
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const userPrompt = JSON.stringify({ fan_message, volunteer_language: langTarget });

                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: userPrompt }] }],
                        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        generationConfig: { responseMimeType: 'application/json' },
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

                try {
                    result = JSON.parse(rawText);
                } catch {
                    let cleaned = rawText.trim();
                    if (cleaned.startsWith('```')) {
                        cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
                    }
                    try {
                        result = JSON.parse(cleaned);
                    } catch {
                        const firstBrace = rawText.indexOf('{');
                        const lastBrace = rawText.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1) {
                            result = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
                        } else {
                            throw new Error('No JSON structure found in Gemini response');
                        }
                    }
                }
            } catch (geminiErr) {
                clearTimeout(timeoutId);
                console.error('Gemini call failed or timed out for fan-assist. Using fallback.', geminiErr);
                result = fallbackResult(fan_message);
                usedFallback = true;
            }
        }

        // Log to fan_interactions only for real (non-fallback) Gemini responses
        if (!usedFallback) {
            try {
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
                if (supabaseUrl && serviceKey) {
                    const supabase = createClient(supabaseUrl, serviceKey);
                    await supabase.from('fan_interactions').insert({
                        volunteer_id: volunteer_id ?? null,
                        detected_language: result.detected_language ?? null,
                        context_tag: result.context_tag ?? null,
                        transcript: fan_message,
                        translated_response: result.suggested_response ?? null,
                    });
                }
            } catch (logErr) {
                // Logging failure should never break the response to the volunteer
                console.error('Failed to log fan_interaction:', logErr);
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Unhandled internal error in fan-assist:', err);
        return new Response(
            JSON.stringify({
                detected_language: 'Unknown',
                context_tag: 'general',
                urgency: 'low',
                translated_message: '',
                suggested_response: "I'm sorry, I'm having trouble understanding. Let me get another volunteer to help.",
                error: err instanceof Error ? err.message : String(err),
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

function fallbackResult(fan_message: string) {
    return {
        detected_language: 'Unknown',
        detected_language_code: 'und',
        context_tag: 'general',
        urgency: 'low',
        translated_message: fan_message,
        suggested_response: "I'm sorry, I'm having trouble understanding. Let me get another volunteer to help.",
    };
}