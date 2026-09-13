// A player's face in a circle. The photo sits over the coloured initials,
// which stay behind it as the fallback while it loads or if it fails.
import { PL, colour, initials, playerIdx, type Player } from '../data/trip';
import type { ReactNode } from 'react';

// Photos are optional: drop <player id>.webp into src/assets/avatars and it's
// picked up; a player without one keeps their coloured initials.
const PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/avatars/*.webp', { eager: true, import: 'default' }) as Record<string, string>)
    .map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.webp$/, ''), url]),
);

export function Avatar({ p, size, badge }: { p: Player; size?: 'sm'; badge?: ReactNode }) {
  const photo = PHOTOS[p.id];
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} style={{ background: colour(playerIdx(p.id)) }}>
      {initials(p)}
      {photo && <img src={photo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      {badge}
    </span>
  );
}

// A scramble team: both faces set diagonally in one avatar-sized footprint.
// No letter — wherever this appears the team's name is right beside it.
export function TeamAvatar({ players, size }: { players: string[]; size?: 'sm' | 'lg' }) {
  return (
    <span className={`team-av${size ? ' ' + size : ''}`} role="img" aria-label={players.map((pid) => PL(pid).name).join(' & ')}>
      {players.slice(0, 2).map((pid) => <Avatar key={pid} p={PL(pid)} />)}
    </span>
  );
}
