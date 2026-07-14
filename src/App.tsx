import { useState } from 'react';
import EntryScreen from './components/EntryScreen';
import Dashboard from './components/Dashboard';
import type { Volunteer } from './types/database';

function App() {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);

  if (!volunteer) {
    return <EntryScreen onSignIn={setVolunteer} />;
  }

  return <Dashboard volunteer={volunteer} onSignOut={() => setVolunteer(null)} />;
}

export default App;
