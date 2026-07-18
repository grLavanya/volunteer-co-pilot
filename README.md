# Volunteer Co-Pilot

**Prompt Wars — Challenge 4: Smart Stadiums & Tournament Operations (FIFA World Cup 2026)**

A real-time GenAI-powered assistant for stadium volunteers, combining crowd management, indoor navigation, and multilingual fan assistance in a single tool built for the field.

**Live:** https://volunteer-co-pilot-beta.vercel.app/
**Repo:** https://github.com/grLavanya/volunteer-co-pilot

---

## Chosen Vertical

**Persona: Volunteer**

**Verticals: Indoor Navigation (backbone) + Crowd Management + Multilingual Assistance**

Rather than attempting all eight verticals shallowly, this solution picks one strong backbone — zone/gate-level indoor navigation — and layers crowd management and multilingual fan support on top as tightly integrated features, not parallel systems. This was a deliberate choice: a solo build on a two-week deadline favors depth on one core problem over breadth across many.

## Approach & Logic

The brief explicitly warned against the generic "map + chatbot" failure mode. The core design decision here was to make the AI layer **reason**, not just detect.

A rule-based system can trivially say "Gate B is at 92%, that's over 80%, alert." That's detection. What this app does instead: it feeds live zone occupancy, trend direction (rising/falling/stable), and zone adjacency into Gemini, and asks it to *reason* about which redirect target actually makes sense — explaining its logic in plain language, referencing the real numbers, and preferring targets with a falling trend over merely-currently-lower ones.

This distinction was tested directly: running the same input twice produced different urgency assessments ("High" vs "Medium") across runs — genuine reasoning that weighs context, not a deterministic script that would always return the identical output for identical input.

## How the Solution Works

**Core flow:**
1. Zone occupancy data (seeded, or uploaded via CSV) is read from Supabase
2. When any zone crosses an 80% threshold, an edge function (`crowd-reasoning`) sends the zone data, adjacency graph, and threshold to Gemini
3. Gemini returns a structured recommendation: affected zone, urgency, a redirect suggestion, plain-English reasoning referencing the actual numbers, and ready-to-use scripts in English, Spanish, and French
4. If Gemini fails or times out, a rule-based fallback (`runFallback`) computes a comparable recommendation locally, clearly labeled `[Rule-based Fallback]` so it's never presented as AI reasoning it isn't

**Fan Assist:** volunteers can paste what a fan said in any language. A second edge function (`fan-assist`) detects the language, tags the context (general / medical / accessibility), assesses urgency, translates it to English for the volunteer, and generates a tone-appropriate suggested response in the fan's own language (matching formal/informal register to how the fan phrased their message).

**Indoor navigation:** a BFS-based route planner over a zone adjacency graph — zone/gate-level (e.g. "Gate C → Gate D"), matching the granularity used in the challenge's own briefing example, rather than full pixel-coordinate pathfinding.

**Judge testing:** a CSV upload feature lets evaluators override the seeded dataset with their own scenario data, with per-row validation and a downloadable sample file showing the expected format.

## Stack

React 18, TypeScript, Vite, Tailwind CSS · Supabase (Postgres + Edge Functions) · Gemini API (`gemini-2.5-flash`) with rule-based fallback · Vitest · Vercel

## Assumptions Made

- **Volunteer identity is mocked, not authenticated.** Signing in loads a fixed seeded volunteer profile rather than integrating real Supabase Auth — reasonable for a demo/judging context where the focus is the crowd-reasoning and assistance logic, not identity management.
- **Zone/gate-level granularity is sufficient for "indoor navigation."** True pixel-coordinate pathfinding was scoped out deliberately; the challenge's own example ("Gate C → Gate D") operates at this same zone-level granularity.
- **Voice input for Fan Assist is not wired to speech-to-text.** The UI includes a mic control (visibly disabled, labeled as a future upgrade) so a volunteer can see the intended interaction, but text input is the fully working path for this submission.
- **Multilingual crowd scripts cover English, Spanish, and French** as a representative, judge-testable set. Fan Assist itself is not limited to these three — it detects and responds in any language Gemini recognizes.
- **The seeded dataset (Central Concourse + Gates A–F) represents the default state.** Judges are expected to primarily test via the in-app CSV upload feature to override this with their own scenario data, per the challenge's testing requirements.

## Testing

37 automated tests (Vitest) covering CSV upload validation (malformed rows, unmatched zones, out-of-range values, boundary cases) and the crowd-reasoning fallback branching logic (zero connected zones, multi-zone overload scenarios, threshold boundaries).

## Accessibility

Dialog semantics (`role="dialog"`, `aria-modal`, `aria-labelledby`) on both modals, `aria-live` regions on all dynamically-appearing content (recommendations, translation results, upload outcomes), accessible names on all icon-only controls, and programmatically linked form labels throughout.

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-lttnxtsy)
