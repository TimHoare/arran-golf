// The scoring engine against this trip's data: handicap maths, tallies,
// results and standings. Course numbers are read from ROUNDS rather than
// written out, so the tests survive the real cards going in.
import { describe, expect, it } from 'vitest';
import { PLAYERS, R, ROUNDS, RULES } from '../data/trip';
import { defaultState, type TripState } from '../lib/state';
import {
  blank18, countback, courseHandicap, firstUnfinishedHole, groupsSet, holePoints, phFor, roundPoints, shotsOn,
  stablefordResults, standings, tally,
} from '../lib/scoring';

const filled = (n: number) => Array(18).fill(n);
const PIDS = PLAYERS.map((p) => p.id);
const r1 = ROUNDS[0];   // Lochranza: 11 par 3s
const r2 = ROUNDS[1];   // Brodick: a full 18
// Gross scores that make net par on every hole off the handicap the player
// carries into the round, with per-hole stroke adjustments on top.
const netParFor = (S: TripState, rid: string, pid: string, delta: number[] = []) =>
  R(rid)!.holes.map((h, i) => h.par + shotsOn(phFor(S, pid, rid), h.si) + (delta[i] ?? 0));

describe('trip shape', () => {
  it('is four players, seven stableford rounds over four days', () => {
    expect(PLAYERS).toHaveLength(4);
    expect(ROUNDS).toHaveLength(7);
    expect(ROUNDS.every((r) => r.format === 'stableford' && !r.pairs)).toBe(true);
    expect(new Set(ROUNDS.map((r) => r.dnum)).size).toBe(4);
    expect(RULES.placePoints).toEqual([6, 4, 2, 0]);
    expect(RULES.bonusBalls).toBe(false);
    expect(RULES.sideBets).toBe(false);
  });
  it('every card adds up: 18 holes (12 at Shiskine), stroke indexes 1–n once each, alt tees the same length', () => {
    for (const r of ROUNDS) {
      const n = r.holes.length;
      expect(n).toBe(r.short === 'Shiskine' ? 12 : r.short === 'Lochranza' ? 11 : 18);
      expect([...r.holes].map((h) => h.si).sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(r.holes.reduce((a, h) => a + h.par, 0)).toBe(r.par);
      expect(r.holes.map((h) => h.n)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      for (const t of r.altTees ?? []) expect(t.yds).toHaveLength(n);
    }
  });
  it('the nine-holers repeat their nine: same pars and yards, odd then even stroke indexes', () => {
    for (const short of ['Corrie', 'Machrie Bay']) {
      const r = ROUNDS.find((x) => x.short === short)!;
      for (let i = 0; i < 9; i++) {
        expect(r.holes[i + 9].par).toBe(r.holes[i].par);
        expect(r.holes[i + 9].yds).toBe(r.holes[i].yds);
        expect(r.holes[i + 9].si).toBe(r.holes[i].si + 1);
        expect(r.holes[i].si % 2).toBe(1);
      }
    }
  });
  it('every round has its tee time, or says to turn up', () => {
    expect(ROUNDS.map((r) => r.groups[0].tee)).toEqual(['Turn up', '10:00', '14:44', 'Turn up', '14:45', 'Turn up', '14:30']);
    expect(ROUNDS.every((r) => r.groups.length === 1 && r.groups[0].players.length === 4)).toBe(true);
  });
  it('one group of four needs no draw, so scoring is open from the start', () => {
    const S = defaultState();
    for (const r of ROUNDS) expect(groupsSet(S, r.id)).toBe(true);
    expect(firstUnfinishedHole(S, r1.id, 0)).toBe(1);
  });
});

describe('handicap maths', () => {
  it('course handicap = index × slope/113 + (CR − par), rounded — the index scaled to the holes played', () => {
    const S = defaultState();
    for (const r of ROUNDS)
      expect(courseHandicap(S, 14.0, r.id)).toBe(Math.round(14.0 * (r.holes.length / 18) * (r.slope / 113) + (r.cr - r.par)));
    // Shiskine's twelve: matches the club's own conversion chart for our four
    expect(PIDS.map((pid) => courseHandicap(S, PLAYERS.find((p) => p.id === pid)!.start, 'r7'))).toEqual([5, 3, 9, 8]);
  });
  it('shots per hole follow stroke index', () => {
    expect(shotsOn(18, 1)).toBe(1);
    expect(shotsOn(18, 18)).toBe(1);
    expect(shotsOn(5, 5)).toBe(1);
    expect(shotsOn(5, 6)).toBe(0);
    expect(shotsOn(24, 6)).toBe(2);   // 24 = 18 + 6: two shots on SI 1–6
    expect(shotsOn(24, 7)).toBe(1);
    expect(shotsOn(-2, 18)).toBe(-1); // plus handicaps give shots back on high SI
  });
  it('stableford points: 2 for net par, floor at 0', () => {
    expect(holePoints(4, 4, 0)).toBe(2);
    expect(holePoints(5, 4, 1)).toBe(2);
    expect(holePoints(3, 4, 0)).toBe(3);
    expect(holePoints(9, 4, 1)).toBe(0);
    expect(holePoints(null, 4, 0)).toBeNull();
    expect(holePoints(0, 4, 0)).toBe(0);   // picked up
  });
});

describe('tally', () => {
  it('sums points and strokes, tracks completeness', () => {
    const t = tally(r2.id, filled(4), 0);
    expect(t.complete).toBe(true);
    expect(t.strokes).toBe(72);
    expect(t.pts).toBe(t.rows.reduce((a, r) => a + Math.max(0, 2 + r.par - 4), 0));
    expect(tally(r2.id, blank18(), 0).played).toBe(0);
    const partial = tally(r2.id, [4, 4, 4, ...Array(15).fill(null)], 0);
    expect(partial.played).toBe(3);
    expect(partial.complete).toBe(false);
    // Lochranza's eleven: complete at 11, 33 strokes of 3s
    const eleven = tally(r1.id, [...Array(11).fill(3), ...Array(7).fill(null)], 0);
    expect(eleven.complete).toBe(true);
    expect(eleven.strokes).toBe(33);
  });
});

describe('results', () => {
  it('distributes 6 · 4 · 2 · 0 in full', () => {
    const S = defaultState();
    S.scores[r1.id] = Object.fromEntries(PIDS.map((pid, i) => [pid, filled(4 + (i % 2))]));
    const rows = stablefordResults(S, r1.id);
    expect(rows).toHaveLength(4);
    expect(rows.reduce((a, r) => a + (r.points ?? 0), 0)).toBe(12);
    expect(rows[0].place).toBe(1);
    expect(rows[3].points).toBe(0);
  });
  it('countback reads back 9, back 6, back 3', () => {
    const gross = filled(4);
    gross[17] = 3;
    const t = tally(r2.id, gross, 0);
    const [b9, b6, b3] = countback(t);
    expect(b9).toBe(t.rows.slice(9).reduce((a, r) => a + (r.pts ?? 0), 0));
    expect(b6).toBe(t.rows.slice(12).reduce((a, r) => a + (r.pts ?? 0), 0));
    expect(b3).toBe(t.rows.slice(15).reduce((a, r) => a + (r.pts ?? 0), 0));
  });
  it('breaks ties on the back 9 instead of sharing', () => {
    const S = defaultState();
    // Both 38: p1's birdies are on the front nine, p2's on the back → p2 takes 1st.
    S.scores[r2.id] = { p1: netParFor(S, r2.id, 'p1', [-1, -1]), p2: netParFor(S, r2.id, 'p2', [...Array(15).fill(0), -1, -1]) };
    const rows = stablefordResults(S, r2.id);
    expect(rows[0].pts).toBe(rows[1].pts);
    expect(rows[0].pid).toBe('p2');
    expect(rows.map((r) => r.place)).toEqual([1, 2]);
    expect(rows.map((r) => r.tied)).toEqual([false, false]);
    expect(rows.map((r) => r.points)).toEqual([6, 4]);
  });
  it('level on every countback: the place points are shared', () => {
    const S = defaultState();
    // p1 and p2 net par everywhere (identical 36s); p3 and p4 drop a shot on the 1st.
    S.scores[r1.id] = Object.fromEntries(PIDS.map((pid) => [pid, netParFor(S, r1.id, pid, pid === 'p3' || pid === 'p4' ? [1] : [])]));
    const rows = stablefordResults(S, r1.id);
    const top = rows.filter((r) => r.place === 1);
    expect(top.map((r) => r.pid).sort()).toEqual(['p1', 'p2']);
    expect(top.every((r) => r.tied && r.points === 5)).toBe(true);   // (6 + 4) / 2
    expect(PIDS.reduce((a, pid) => a + (roundPoints(S, r1.id, pid) ?? 0), 0)).toBe(12);
  });
  it('standings rank by week points, then stableford total', () => {
    const S = defaultState();
    S.scores[r1.id] = Object.fromEntries(PIDS.map((pid, i) => [pid, filled(3 + i)]));   // Lochranza is all par 3s
    const st = standings(S);
    expect(st).toHaveLength(4);
    expect(st[0].rank).toBe(1);
    expect(st[0].pts).toBe(6);
    expect(st.map((r) => r.pts)).toEqual([6, 4, 2, 0]);
    expect(st.every((r) => r.bonusKept === 0)).toBe(true);
  });
});

// Shiskine is twelve holes: everything hole-shaped has to follow the round's
// own length rather than assume 18. A stand-in twelve is spliced into ROUNDS
// for these tests and taken out again.
import { afterEach } from 'vitest';
import { indexTable } from '../lib/scoring';
describe('a twelve-hole round', () => {
  const twelve = {
    ...ROUNDS[0], id: 'x12', n: 99, club: 'Twelve', short: 'Twelve', par: 42, cr: 41.0, slope: 110,
    holes: [4,3,4,4,3,4, 3,4,4,3,3,3].map((par, i) => ({ n: i + 1, par, si: [1,11,3,5,9,7, 12,2,4,10,6,8][i], yds: null })),
  };
  afterEach(() => { const i = ROUNDS.findIndex((r) => r.id === 'x12'); if (i >= 0) ROUNDS.splice(i, 1); });
  const add = () => { ROUNDS.push(twelve); return defaultState(); };

  it('scales the course handicap by 12/18 and gives shots off stroke indexes 1–12', () => {
    add();
    const S = defaultState();
    expect(courseHandicap(S, 15.0, 'x12')).toBe(Math.round(15.0 * (12 / 18) * (110 / 113) + (41.0 - 42)));
    expect(shotsOn(13, 1, 12)).toBe(2);   // 13 over twelve holes: two on SI 1, one elsewhere
    expect(shotsOn(13, 2, 12)).toBe(1);
    expect(shotsOn(5, 6, 12)).toBe(0);
  });
  it('is complete at twelve, counts back over 6 / 4 / 2, and swipes stop at the 12th', () => {
    const S = add();
    const gross = Array(12).fill(4);
    const t = tally('x12', [...gross, ...Array(6).fill(null)], 0);
    expect(t.rows).toHaveLength(12);
    expect(t.complete).toBe(true);
    expect(countback(t)).toEqual([6, 8, 10].map((from) => t.rows.slice(from).reduce((a, r) => a + (r.pts ?? 0), 0)));
    expect(tally('x12', [...Array(11).fill(4), null], 0).complete).toBe(false);
    S.scores.x12 = Object.fromEntries(PIDS.map((pid) => [pid, Array(12).fill(4)]));
    expect(firstUnfinishedHole(S, 'x12', 0)).toBe(12);
    // and it settles the index like any other round
    expect(indexTable(S).p1.find((h) => h.round.id === 'x12')!.applied).toBe(true);
  });
});
