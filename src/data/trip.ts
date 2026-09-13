// Everything fixed about the trip: the Isle of Arran, 23–26 September 2026.
import type { BitKind } from '../lib/state';

// The trip itself: names the app, keys this phone's storage and the shared
// realtime channel (so two trips on one phone never mix), and starts the
// countdown. slug is also the bit that tells one trip's database from another's.
export const TRIP = {
  slug: 'arran-golf-2026',
  name: 'Arran',
  year: '2026',
  dates: 'Wed 23 – Sat 26 September',
  firstTee: new Date(2026, 8, 23),   // Wednesday — Lochranza is turn-up-and-play, so the day itself
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
  courseHoles?: number; // greens on the ground when fewer than the holes played: 9 played twice
  altTees?: TeeSet[];   // besides the default tees above; selectable in settings
}
export interface Player { id: string; name: string; start: number }

function card(pars: number[], sis: number[], yds: number[]): Hole[] {
  return pars.map((par, i) => ({ n: i + 1, par, si: sis[i], yds: yds[i] ?? null }));
}

// A nine-hole course played twice: the club card gives each hole two stroke
// indexes, odd first time round and even the second, so the nine SIs here are
// the first-loop ones and the second loop takes the next even number.
function twice(pars: number[], sis: number[], yds: number[]): Hole[] {
  const loop = (k: number) => pars.map((par, i) => ({ n: k * 9 + i + 1, par, si: sis[i] + k, yds: yds[i] ?? null }));
  return [...loop(0), ...loop(1)];
}
const twiceYds = (yds: number[]) => [...yds, ...yds];

// Seven rounds over four days, Wednesday to Saturday: one on the first day,
// then two a day. Everyone plays together, so each round is a single group off
// one tee; Lochranza, Corrie and Machrie Bay take no bookings, you turn up.
// Cards are the clubs' own where published, otherwise
// the aggregators that agree with each other — each round's comment says
// which, and what to double-check in the clubhouse.
const ALL = ['p1', 'p2', 'p3', 'p4'];
export const ROUNDS: Round[] = [
  // Lochranza: pay-and-play run by the campsite. No longer the 9-hole par 34
  // the aggregators still list — it's 11 par-3 holes, one tee set for
  // everyone, and we play the 11 (par 33). The only published figures are
  // for the 18-hole extension (52.1/87, par 54): the rating here is that
  // gap scaled to 11 holes, and the stroke indexes are the 18-hole card's
  // order re-ranked over these 11. CHECK THE CARD AT THE CAMPSITE — GolfPass
  // is the only source and its card looks generated rather than the club's.
  { id: 'r1', n: 1, dow: 'Wed', dnum: 23, mon: 'Sept', format: 'stableford', pairs: false,
    club: 'Lochranza Golf', short: 'Lochranza', town: 'Lochranza', address: 'Lochranza Campsite, Lochranza, Isle of Arran, KA27 8HL',
    par: 33, cr: 31.8, slope: 87, tees: 'white',
    holes: card(Array(11).fill(3), [1,5,4,11,7,3,8,10,9,2,6], [110,67,77,87,98,87,116,91,103,87,73]),
    groups: [{ tee: 'Turn up', players: ALL }] },
  // Brodick: 18 holes, par 64 off the yellows (the 2nd is a par 4 off the
  // whites, par 65 — so no white tee option here, the app can't change a
  // hole's par per tee). Card from the club's own scorecard PDF (Feb 2026).
  // Yellow CR/slope 63.2/109 is from aggregators (golfshake, golfnow), not the
  // club — check the card in the clubhouse.
  { id: 'r2', n: 2, dow: 'Thu', dnum: 24, mon: 'Sept', slot: 'am', format: 'stableford', pairs: false,
    club: 'Brodick Golf Club', short: 'Brodick', town: 'Brodick', address: 'Cloy Bridge, Brodick, Isle of Arran, KA27 8DL',
    par: 64, cr: 63.2, slope: 109, tees: 'yellow',
    holes: card([4,3,3,3,5,4,3,3,4, 4,4,4,3,3,3,4,4,3], [5,15,7,17,1,13,11,3,9, 10,2,16,6,18,8,14,4,12], [387,192,119,125,460,265,156,167,373, 365,356,251,185,162,118,272,295,220]),
    groups: [{ tee: '10:00', players: ALL }] },
  // Lamlash: 18 holes, par 64, steep and famous for long par 3s. Pars and
  // yards from the club's hole-by-hole page, SIs from three aggregators that
  // agree. Yellow 61.1/106 and white 63.9/109 are third-party figures (the
  // club publishes none). The club's own card is headed "White Medal Tees",
  // so white is the default here; yellows are in settings.
  { id: 'r3', n: 3, dow: 'Thu', dnum: 24, mon: 'Sept', slot: 'pm', format: 'stableford', pairs: false,
    club: 'Lamlash Golf Club', short: 'Lamlash', town: 'Lamlash', address: 'Lamlash, Isle of Arran, KA27 8JU',
    par: 64, cr: 63.9, slope: 109, tees: 'white',
    holes: card([4,3,4,3,3,4,4,4,4, 4,4,3,3,3,4,3,3,4], [9,5,1,15,3,7,13,17,11, 12,14,2,16,6,8,18,4,10], [346,184,387,174,201,330,283,256,349, 241,263,224,186,210,284,98,201,293]),
    altTees: [{ key: 'yellow', label: 'yellow', cr: 61.1, slope: 106, yds: [335,171,351,109,168,317,208,210,271, 198,221,219,178,204,239,94,165,287] }],
    groups: [{ tee: '14:44', players: ALL }] },
  // Corrie: 9 holes played twice, par 62. Card and ratings from the club's
  // course page (18-hole figures: yellow 58.4/90, white 60.6/96). The club
  // card gives each hole two stroke indexes — the odd ones first time round,
  // the even ones second. The club doesn't say which tee visitors play; the
  // yellows are very short (3,220 yds), the whites 3,830 — switch in settings.
  { id: 'r4', n: 4, dow: 'Fri', dnum: 25, mon: 'Sept', slot: 'am', format: 'stableford', pairs: false,
    club: 'Corrie Golf Club', short: 'Corrie', town: 'Sannox', address: 'Sannox, Isle of Arran, KA27 8JD',
    par: 62, cr: 58.4, slope: 90, tees: 'yellow', courseHoles: 9,
    holes: twice([3,3,4,3,3,4,4,3,4], [17,3,5,13,11,1,9,15,7], [127,134,219,130,97,238,302,138,225]),
    altTees: [{ key: 'white', label: 'white', cr: 60.6, slope: 96, yds: twiceYds([135,199,248,171,124,309,307,156,266]) }],
    groups: [{ tee: 'Turn up', players: ALL }] },
  // Whiting Bay: 18 holes, par 63, nine par 3s. Yellow 61.4/97 from the club's
  // Scottish Golf slope panel (Nov 2020); white 62.5/99. SI for holes 2 and 5
  // are 7 and 5 per the printed card and two other sources — the club's web
  // page misprints them as 9 and 13.
  { id: 'r5', n: 5, dow: 'Fri', dnum: 25, mon: 'Sept', slot: 'pm', format: 'stableford', pairs: false,
    club: 'Whiting Bay Golf Club', short: 'Whiting Bay', town: 'Whiting Bay', address: 'Golf Course Road, Whiting Bay, Isle of Arran, KA27 8QT',
    par: 63, cr: 61.4, slope: 97, tees: 'yellow',
    holes: card([4,3,3,3,3,4,3,4,4, 4,3,4,3,4,4,3,3,4], [17,7,3,13,5,15,11,1,9, 10,2,12,4,18,14,8,16,6], [218,186,150,83,207,252,229,346,212, 259,166,315,221,229,307,202,127,383]),
    altTees: [{ key: 'white', label: 'white', cr: 62.5, slope: 99, yds: [225,195,178,112,209,265,231,355,252, 313,201,322,249,254,323,203,131,433] }],
    groups: [{ tee: '14:45', players: ALL }] },
  // Machrie Bay: 9 holes played twice, par 66, split by the shore road. Yards,
  // pars and SIs from 18Birdies and golf4holland (which agree hole for hole;
  // odd SIs first time round, even second), names from the club. 18-hole
  // ratings: white 62.8/104 (the men's standard tee), yellow 61.4/100. The
  // 1st was rebuilt in 2015 — older cards say 319 yds; the current one 303.
  { id: 'r6', n: 6, dow: 'Sat', dnum: 26, mon: 'Sept', slot: 'am', format: 'stableford', pairs: false,
    club: 'Machrie Bay Golf Club', short: 'Machrie Bay', town: 'Machrie', address: 'Machrie, Isle of Arran, KA27 8DY',
    par: 66, cr: 62.8, slope: 104, tees: 'white', courseHoles: 9,
    holes: twice([4,3,3,4,3,4,4,4,4], [5,7,11,1,9,17,13,3,15], [303,174,185,343,199,280,280,252,246]),
    altTees: [{ key: 'yellow', label: 'yellow', cr: 61.4, slope: 100, yds: twiceYds([297,146,185,336,168,254,278,219,244]) }],
    groups: [{ tee: 'Turn up', players: ALL }] },
  // Shiskine: 12 holes, par 42 — visitors always play 12, off the yellows
  // (whites are medal only). Card from the club's course page. The club
  // publishes no 12-hole rating: its WHS figures (yellow 62.0/97, white
  // 63.3/99) are for an 18-hole layout visitors never see, and it hands out a
  // conversion chart instead. Rating = par with slope 97 reproduces that
  // chart's 12-hole course handicap for every one of our four indexes
  // (5.6 → 3, 8.8 → 5, 14.7 → 8, 16.2 → 9), so that's what's used here.
  { id: 'r7', n: 7, dow: 'Sat', dnum: 26, mon: 'Sept', slot: 'pm', format: 'stableford', pairs: false,
    club: 'Shiskine Golf & Tennis Club', short: 'Shiskine', town: 'Blackwaterfoot', address: 'Shore Road, Blackwaterfoot, Isle of Arran, KA27 8HA',
    par: 42, cr: 42.0, slope: 97, tees: 'yellow',
    holes: card([4,4,3,3,3,4, 3,4,5,3,3,3], [5,1,9,11,7,3, 10,6,2,12,4,8], [368,357,122,137,212,266, 162,220,477,150,196,120]),
    altTees: [{ key: 'white', label: 'white', cr: 42.0, slope: 99, yds: [385,380,127,147,244,274, 173,250,509,168,209,126] }],
    groups: [{ tee: '14:30', players: ALL }] },
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
// '18 holes', '11 holes', '9 holes, twice'.
export const holesLabel = (r: Round) => {
  const n = r.holes.length, c = r.courseHoles ?? n;
  return c === n ? `${n} holes` : c * 2 === n ? `${c} holes, twice` : `${c} holes, played as ${n}`;
};
// Everyone plays together every round: no groups to draw, name or switch between.
export const ONE_GROUP = ROUNDS.every((r) => r.groups.length === 1);
export const ord = (n: number) => n + (['st', 'nd', 'rd'][n - 1] || 'th');
