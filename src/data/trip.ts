// Everything fixed about the trip. PLACEHOLDERS throughout until the trip is
// settled — search for "TBC" to find them: the name and dates, every course
// (one made-up par-72 card stands in for all seven), the players' names and
// starting indexes, and the tee times.
import type { BitKind } from '../lib/state';

// The trip itself: names the app, keys this phone's storage and the shared
// realtime channel (so two trips on one phone never mix), and starts the
// countdown. slug is also the bit that tells one trip's database from another's.
export const TRIP = {
  slug: 'arran-golf-2026',
  name: 'Arran',
  year: '2026',
  dates: 'Wed 23 – Sat 26 September',
  firstTee: new Date(2026, 8, 23, 9, 0),   // TBC: Lochranza tee time on the Wednesday
};

export interface Hole { n: number; par: number; si: number; yds: number | null }
export interface Group { tee: string; name?: string; players: string[] }
// An alternative tee set for a course: rating/slope drive the handicaps, per-hole
// yards (front-to-back) are display only and may be unknown.
export interface TeeSet { key: string; label: string; cr: number; slope: number; yds: (number | null)[] | null }
export interface Round {
  id: string; n: number; dow: string; dnum: number; mon: string;
  slot?: 'am' | 'pm';   // two rounds on one day: which this is (labels only)
  club: string; short: string; town: string; address: string;
  format: 'stableford' | 'scramble'; pairs: boolean;
  par: number; cr: number; slope: number; tees: string;
  holes: Hole[]; groups: Group[];
  altTees?: TeeSet[];   // besides the default tees above; selectable in settings
}
export interface Player { id: string; name: string; start: number }

function card(pars: number[], sis: number[], yds: number[]): Hole[] {
  return pars.map((par, i) => ({ n: i + 1, par, si: sis[i], yds: yds[i] ?? null }));
}

// TBC: a stand-in par 72 until each club's published card goes in (par / SI /
// yards per hole, and the CR and slope for the tees being played).
const PLACEHOLDER = card([4,4,3,5,4,3,4,5,4, 4,3,5,4,4,3,4,5,4], [7,3,15,11,1,17,9,13,5, 8,16,10,2,4,18,6,12,14], []);

// Seven stableford rounds over four days: one on the first day, then two a day.
// Everyone plays together, so each round is a single group off one tee.
const ALL = ['p1', 'p2', 'p3', 'p4'];
const round = (n: number, dow: string, dnum: number, slot?: 'am' | 'pm'): Round => ({
  id: `r${n}`, n, dow, dnum, mon: 'TBC', slot,
  club: `Course ${n} (TBC)`, short: `Course ${n}`, town: 'TBC', address: 'TBC',
  format: 'stableford', pairs: false, par: 72, cr: 70.0, slope: 125, tees: 'yellow',
  holes: PLACEHOLDER,
  groups: [{ tee: 'TBC', players: ALL }],
});
export const ROUNDS: Round[] = [
  round(1, 'Thu', 1),
  round(2, 'Fri', 2, 'am'), round(3, 'Fri', 2, 'pm'),
  round(4, 'Sat', 3, 'am'), round(5, 'Sat', 3, 'pm'),
  round(6, 'Sun', 4, 'am'), round(7, 'Sun', 4, 'pm'),
];

// Handicap index each player starts the trip on.
export const PLAYERS: Player[] = [
  { id: 'p1', name: 'Liam Cameron',   start: 8.8 },
  { id: 'p2', name: 'Jonny Bidewell', start: 5.6 },
  { id: 'p3', name: 'Adam Gooch',     start: 16.2 },
  { id: 'p4', name: 'George Pledger', start: 14.7 },
];

// How a player's index moves after each completed stableford round:
//   points — ±perPoint for every stableford point away from par (a 36 off a
//            par of 32 with perPoint 0.5 cuts the index by 2.0);
//   place  — a fixed step by finishing position in the round, byPlace[0] for
//            the winner; ties after countback share the steps between them, and
//            nothing moves until every player's card for the round is in.
export type IndexAdjust =
  | { mode: 'points'; par: number; perPoint: number }
  | { mode: 'place'; byPlace: number[] };

export const RULES = {
  placePoints: [6, 4, 2, 0],               // stableford, 1st–4th, every round
  pairPoints: [6, 4, 2, 0],                // hidden pairs — not played this trip (no round sets pairs)
  scramblePoints: [6, 4, 2, 0],            // scramble — not played this trip (every round is stableford)
  bonusBalls: false,                       // no bonus balls this trip
  bonusKeep: 1,
  sideBets: false,                         // no cuckoos, camels or fish this trip
  allowance: 100,
  // Index moves by finishing place, after every round: −1 for the winner,
  // −0.5 for 2nd, +0.5 for 3rd, +1 for last. Ties after countback share.
  indexAdjust: { mode: 'place', byPlace: [-1, -0.5, 0.5, 1] } as IndexAdjust,
  scrambleAllowance: [35, 15],
};

// Side-bet menagerie: labels for the things logged hole by hole. Off this
// trip (RULES.sideBets), kept so the engine and database shapes stay shared.
export const BITS: Record<BitKind, { label: string; one: string; icon: string; desc: string; max?: number }> = {
  cuckoo:    { label: 'Cuckoos',     one: 'cuckoo',     icon: '🐦', desc: 'Hit a tree' },
  camel:     { label: 'Camels',      one: 'camel',      icon: '🐫', desc: 'In a bunker' },
  fish:      { label: 'Fish',        one: 'fish',       icon: '🐟', desc: 'In the water' },
  threeputt: { label: 'Three-putts', one: 'three-putt', icon: '⛳', desc: '3 or more putts', max: 1 },
  lostball:  { label: 'Lost balls',  one: 'lost ball',  icon: '🔍', desc: 'Lost a ball' },
};

// Trip organiser — the only player who can wipe the shared database.
export const ORGANISER = 'p1';

export const AVATAR_COLOURS = ['#22402F', '#5F4E8C', '#8A4A2F', '#3A5A6E', '#A8894B', '#4E6E4E', '#7A3A55', '#54604A'];

export const R = (rid: string) => ROUNDS.find((x) => x.id === rid);
export const playerIdx = (pid: string) => PLAYERS.findIndex((p) => p.id === pid);
export const PL = (pid: string) => PLAYERS[playerIdx(pid)];
export const pName = (pid: string) => PL(pid)?.name || '?';
export const first = (pid: string) => {
  const parts = pName(pid).split(/\s+/);
  const shared = PLAYERS.filter((p) => p.name.split(/\s+/)[0] === parts[0]).length > 1;
  return shared && parts[1] ? `${parts[0]} ${parts[1][0]}` : parts[0];
};
export const initials = (p: Player) => {
  const parts = p.name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};
export const colour = (i: number) => AVATAR_COLOURS[((i % AVATAR_COLOURS.length) + AVATAR_COLOURS.length) % AVATAR_COLOURS.length];
export const gname = (grp: Group, t: number) => grp.name || `Group ${t + 1}`;
// The day a round is on, as a short label: 'Fri', or 'Fri am' when the day has two.
export const dayLabel = (r: Round) => r.dow + (r.slot ? ` ${r.slot}` : '');
export const ord = (n: number) => n + (['st', 'nd', 'rd'][n - 1] || 'th');
