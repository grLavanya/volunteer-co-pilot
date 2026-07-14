import { Radio, ChevronRight } from 'lucide-react';
import type { Volunteer } from '../types/database';

interface EntryScreenProps {
  onSignIn: (volunteer: Volunteer) => void;
}

export default function EntryScreen({ onSignIn }: EntryScreenProps) {
  function handleSignIn() {
    // Mock volunteer profile — stored in app state, not Supabase auth.
    // Matches the seeded "Alex Rivera" record.
    onSignIn({
      id: 'f9249afd-246e-47fc-84dd-7e7f8c1a6ba7',
      name: 'Alex Rivera',
      assigned_zone_id: 'e635e96d-ee50-453f-b1e0-345a996536f9',
      languages: ['English', 'Spanish'],
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-500/30">
          <Radio className="h-8 w-8 text-cyan-400" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
          Volunteer Co-Pilot
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          FIFA World Cup 2026 — real-time stadium crowd operations for field volunteers.
        </p>

        <button
          onClick={handleSignIn}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 active:scale-[0.99]"
        >
          Sign in as Volunteer
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <footer className="mt-16 text-xs text-slate-600">
        FIFA World Cup 2026 · Stadium Operations
      </footer>
    </div>
  );
}
