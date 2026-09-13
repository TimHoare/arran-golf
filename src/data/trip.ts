// Everything fixed about the trip. Course data is the real thing: men's yellow
// tees from each club's published scorecard (par / yards / SI verified to sum).
// Tee times are confirmed for Elsham, Ganton, Cave Castle and York;
// Beverley's are TBC. All groups are placeholders — check the tee sheet.
import type { BitKind } from '../lib/state';

// The trip itself: names the app, keys this phone's storage and the shared
// realtime channel (so two trips on one phone never mix), and starts the
// countdown. slug is also the bit that tells one trip's database from another's.
export const TRIP = {
  slug: 'yorkshire-golf-2026',
  name: 'Yorkshire',
  year: '2026',
  dates: 'Mon 7 – Fri 11 September',
  firstTee: new Date(2026, 8, 7, 12, 28),   // Elsham, 12:28
};

export interface Hole { n: number; par: number; si: number; yds: number | null }
export interface Group { tee: string; name?: string; players: string[] }
// An alternative tee set for a course: rating/slope drive the handicaps, per-hole
// yards (front-to-back) are display only and may be unknown. Hole pars and stroke
// indexes are the same across the men's tees at all five clubs.
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

export const ROUNDS: Round[] = [
  { id: 'd1', n: 1, dow: 'Mon', dnum: 7,  mon: 'Sept', club: 'Elsham Golf Club',      short: 'Elsham',      town: 'Elsham, near Brigg',       format: 'stableford', pairs: true,  par: 71, cr: 71.2, slope: 132, tees: 'yellow',
    address: 'Barton Road, Elsham, Brigg, DN20 0LS',
    holes: card([4,4,4,5,5,3,4,4,3, 5,4,3,4,3,4,4,4,4], [14,6,4,8,12,16,18,2,10, 15,7,11,1,17,5,9,3,13], [311,340,354,506,462,149,297,439,164, 503,362,168,420,163,389,391,411,331]),
    altTees: [{ key: 'white', label: 'white', cr: 72.4, slope: 140, yds: [345,366,365,515,483,160,304,452,172, 516,374,193,431,190,401,414,418,342] }],
    groups: [{ tee: '12:28', players: ['p1','p2','p3','p4'] }, { tee: '12:36', players: ['p5','p6','p7','p8'] }] },
  { id: 'd2', n: 2, dow: 'Tue', dnum: 8,  mon: 'Sept', club: 'Ganton Golf Club',      short: 'Ganton',      town: 'Ganton, near Scarborough', format: 'stableford', pairs: false, par: 71, cr: 72.2, slope: 133, tees: 'yellow',
    address: 'Ganton, Scarborough, YO12 4PA',
    holes: card([4,4,4,4,3,4,4,4,5, 3,4,4,5,4,4,4,3,4], [11,5,15,3,17,1,7,13,9, 18,4,12,6,16,2,8,14,10], [360,398,290,369,150,442,423,372,476, 165,402,357,499,280,429,429,208,391]),
    altTees: [
      { key: 'white', label: 'white', cr: 73.6, slope: 138, yds: [370,419,317,408,159,448,436,392,503, 169,417,365,535,282,461,447,232,401] },
      { key: 'blue',  label: 'blue',  cr: 74.7, slope: 138, yds: [370,447,349,419,170,469,436,413,503, 181,427,398,565,282,493,447,246,440] },
    ],
    groups: [{ tee: '14:00', players: ['p1','p5','p2','p6'] }, { tee: '14:07', players: ['p3','p7','p4','p8'] }] },
  { id: 'd3', n: 3, dow: 'Wed', dnum: 9,  mon: 'Sept', club: 'Cave Castle Golf Club', short: 'Cave Castle', town: 'South Cave, East Riding',   format: 'scramble',   pairs: false, par: 72, cr: 69.6, slope: 122, tees: 'yellow',
    address: 'Church Hill, South Cave, HU15 2EU',
    holes: card([4,5,5,4,3,4,4,4,4, 4,4,4,5,3,4,4,3,4], [18,16,10,4,12,2,6,14,8, 1,3,7,9,15,13,11,17,5], [274,459,459,357,187,396,341,367,386, 453,453,383,513,137,326,315,136,327]),
    // White CR/slope from the source set that matches our verified yellow; some
    // aggregators say 71.8/137 — confirm against the card in the clubhouse.
    altTees: [{ key: 'white', label: 'white', cr: 71.2, slope: 123, yds: [278,469,491,394,190,397,403,372,382, 449,424,396,522,137,329,328,146,336] }],
    groups: [
      { tee: '12:36', name: 'Team A', players: ['p1','p3'] }, { tee: '12:36', name: 'Team B', players: ['p5','p7'] },
      { tee: '12:44', name: 'Team C', players: ['p2','p4'] }, { tee: '12:44', name: 'Team D', players: ['p6','p8'] },
    ] },
  // Beverley yellow CR/slope from the club's posted WHS table (Apr 2024): 67.8/123.
  { id: 'd4', n: 4, dow: 'Thu', dnum: 10, mon: 'Sept', club: 'Beverley & East Riding Golf Club', short: 'Beverley', town: 'Beverley, East Riding',  format: 'stableford', pairs: false, par: 69, cr: 67.8, slope: 123, tees: 'yellow',
    address: 'Anti Mill, The Westwood, Beverley, HU17 8RG',
    holes: card([4,4,5,3,4,3,4,3,4, 4,4,4,4,4,5,3,4,3], [11,3,13,7,9,17,1,15,5, 14,16,10,8,2,12,6,4,18], [333,435,558,183,319,178,402,171,362, 320,315,316,301,337,477,186,324,136]),
    altTees: [{ key: 'white', label: 'white', cr: 69.4, slope: 125, yds: [340,463,568,185,326,181,410,179,392, 348,317,334,340,377,481,215,369,141] }],
    groups: [{ tee: '11:20', players: ['p1','p6','p4','p7'] }, { tee: '11:30', players: ['p2','p5','p3','p8'] }] },
  { id: 'd5', n: 5, dow: 'Fri', dnum: 11, mon: 'Sept', club: 'York Golf Club',        short: 'York',        town: 'Strensall, York',          format: 'stableford', pairs: false, par: 70, cr: 69.6, slope: 123, tees: 'yellow',
    address: 'Lords Moor Lane, Strensall, York, YO32 5XF',
    holes: card([4,3,5,4,4,4,3,4,4, 4,3,4,4,4,5,4,3,4], [7,17,9,11,1,5,13,3,15, 4,18,12,2,16,6,10,14,8], [431,140,500,345,392,414,145,450,336, 394,115,352,367,370,503,379,176,373]),
    altTees: [{ key: 'white', label: 'white', cr: 70.6, slope: 128, yds: [434,150,514,344,403,420,153,463,347, 404,119,362,372,373,517,404,184,383] }],
    groups: [{ tee: '11:03', players: ['p1','p2','p3','p4'] }, { tee: '11:12', players: ['p5','p6','p7','p8'] }] },
];

export const PLAYERS: Player[] = [
  { id: 'p1', name: 'Tim Hoare',         start: 14.0 },
  { id: 'p2', name: 'Matthew Braybrook', start: 19.3 },
  { id: 'p3', name: 'Adam Gooch',        start: 16.7 },
  { id: 'p4', name: 'Joshua Watts',      start: 17.2 },
  { id: 'p5', name: 'Liam Kevern',       start: 9.1 },
  { id: 'p6', name: 'Rob Ellis',         start: 3.8 },
  { id: 'p7', name: 'Harry Gooch',       start: 23.9 },
  { id: 'p8', name: 'Liam Cameron',      start: 9.1 },
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
  placePoints: [10, 8, 6, 4, 3, 2, 1, 0],  // individual stableford, 1st–8th
  pairPoints: [6, 4, 2, 0],                // hidden pairs, per player, 1st–4th
  scramblePoints: [6, 4, 2, 0],            // scramble teams, per player, 1st–4th
  bonusBalls: true,                        // one 2× ball per player for the trip
  bonusKeep: 1,                            // still holding your bonus ball at the end of the trip
  sideBets: true,                          // cuckoos, camels, fish… logged hole by hole
  allowance: 100,
  indexAdjust: { mode: 'points', par: 32, perPoint: 0.5 } as IndexAdjust,
  scrambleAllowance: [35, 15], // % of course handicaps, lowest first (2-man teams)
};

// Side-bet menagerie: labels for the four things logged hole by hole.
// Amounts (pence each) live in app settings and sync between phones.
// max = the most one player can log on one hole: you can find three bunkers
// on a hole, but you either three-putted it or you didn't.
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
// The day a round is on, as a short label: 'Tue', or 'Tue am' when the day has two.
export const dayLabel = (r: Round) => r.dow + (r.slot ? ` ${r.slot}` : '');
export const ord = (n: number) => n + (['st', 'nd', 'rd'][n - 1] || 'th');
