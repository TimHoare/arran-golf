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
const r1 = ROUNDS[0];
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
  it('every card adds up: 18 holes, stroke indexes 1–18 once each', () => {
    for (const r of ROUNDS) {
      expect(r.holes).toHaveLength(18);
      expect([...r.holes].map((h) => h.si).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
      expect(r.holes.reduce((a, h) => a + h.par, 0)).toBe(r.par);
    }
  });
  it('one group of four needs no draw, so scoring is open from the start', () => {
    const S = defaultState();
    for (const r of ROUNDS) expect(groupsSet(S, r.id)).toBe(true);
    expect(firstUnfinishedHole(S, r1.id, 0)).toBe(1);
  });
});

describe('handicap maths', () => {
  it('course handicap = index × slope/113 + (CR − par), rounded', () => {
    const S = defaultState();
    for (const r of ROUNDS)
      expect(courseHandicap(S, 14.0, r.id)).toBe(Math.round(14.0 * (r.slope / 113) + (r.cr - r.par)));
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
    const t = tally(r1.id, filled(4), 0);
    expect(t.complete).toBe(true);
    expect(t.strokes).toBe(72);
    expect(t.pts).toBe(t.rows.reduce((a, r) => a + Math.max(0, 2 + r.par - 4), 0));
    expect(tally(r1.id, blank18(), 0).played).toBe(0);
    const partial = tally(r1.id, [4, 4, 4, ...Array(15).fill(null)], 0);
    expect(partial.played).toBe(3);
    expect(partial.complete).toBe(false);
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
    const t = tally(r1.id, gross, 0);
    const [b9, b6, b3] = countback(t);
    expect(b9).toBe(t.rows.slice(9).reduce((a, r) => a + (r.pts ?? 0), 0));
    expect(b6).toBe(t.rows.slice(12).reduce((a, r) => a + (r.pts ?? 0), 0));
    expect(b3).toBe(t.rows.slice(15).reduce((a, r) => a + (r.pts ?? 0), 0));
  });
  it('breaks ties on the back 9 instead of sharing', () => {
    const S = defaultState();
    // Both 38: p1's birdies are on the front nine, p2's on the back → p2 takes 1st.
    S.scores[r1.id] = { p1: netParFor(S, r1.id, 'p1', [-1, -1]), p2: netParFor(S, r1.id, 'p2', [...Array(15).fill(0), -1, -1]) };
    const rows = stablefordResults(S, r1.id);
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
    S.scores[r1.id] = Object.fromEntries(PIDS.map((pid, i) => [pid, filled(4 + i)]));
    const st = standings(S);
    expect(st).toHaveLength(4);
    expect(st[0].rank).toBe(1);
    expect(st[0].pts).toBe(6);
    expect(st.map((r) => r.pts)).toEqual([6, 4, 2, 0]);
    expect(st.every((r) => r.bonusKept === 0)).toBe(true);
  });
});
