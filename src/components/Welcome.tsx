// First-open "Who's this?" screen. Picking a name personalises the app and
// defaults score entry to your group; remembered per phone.
import { PLAYERS, TRIP, first } from '../data/trip';
import { fmt1 } from '../lib/scoring';
import { setMe } from '../lib/store';
import { toast } from '../lib/toast';
import { Avatar } from './Avatar';

export function Welcome() {
  const pick = (id: string) => {
    setMe(id);
    toast(`Welcome, ${first(id)}`);
  };
  return (
    <div className="welcome">
      <div className="welcome-card">
        <span className="eyebrow">{TRIP.name} {TRIP.year} · {TRIP.dates}</span>
        <h2>Who's this?</h2>
        <p className="small muted">Pick your name once — score entry opens on your group each day, and this phone remembers you.</p>
        <div className="welcome-list">
          {PLAYERS.map((p) => (
            <button key={p.id} onClick={() => pick(p.id)}>
              <Avatar p={p} size="sm" />
              <span><b>{p.name}</b><small>Index {fmt1(p.start)}</small></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
