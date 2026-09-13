// Competition rules the scoring tests only reach indirectly: index drift,
// scramble team handicaps, points shared on ties, round status and standings.
import { describe, expect, it } from 'vitest';
import { R } from '../data/trip';
import { defaultState, type TripState } from '../lib/state';
import {
  courseHandicap, currentIndex, indexHistory, pairPointsFor, pairTotals, phFor, playerTally, playingHandicap,
  roundStatus, scrambleResults, shotsOn, stablefordResults, standings, teamHandicap,
} from '../lib/scoring';

const PIDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
// Gross scores that make net par on every hole off handicap ph — 2 points a
// hole, 36 for the round — with per-hole stroke adjustments on top.
const netPar = (rid: string, ph: number, delta: number[] = []) =>
  R(rid)!.holes.map((h, i) => h.par + shotsOn(ph, h.si) + (delta[i] ?? 0));
// The same for a player, off the handicap they carry into the round.
const netParFor = (S: TripState, rid: string, pid: string, delta: number[] = []) =>
  netPar(rid, phFor(S, pid, rid), delta);
const bogeys = (n: number) => Array(n).fill(1);

describe('index drift', () => {
  it('moves −0.5 per point over 32 once a stableford round is complete', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') }; // 36 points, 38 with the 18th doubled by default
    const [d1, d2] = indexHistory(S, 'p1');
    expect(d1.before).toBe(14.0);
    expect(d1.applied).toBe(true);
    expect(d1.after).toBe(11.0);
    expect(d2.before).toBe(11.0);
    expect(d2.applied).toBe(false); // nothing entered yet
    expect(currentIndex(S, 'p1')).toBe(11.0);
    // the next round is played off the drifted index, not the starting one
    expect(phFor(S, 'p1', 'd2')).toBe(playingHandicap(S, 11.0, 'd2'));
    expect(phFor(S, 'p1', 'd2')).not.toBe(playingHandicap(S, 14.0, 'd2'));
  });
  it('goes up after a poor round; a partial round does not count', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1', bogeys(8)) }; // 28 points, 30 with the 18th doubled
    expect(indexHistory(S, 'p1')[0].after).toBe(15.0);
    S.scores.d1.p1[17] = null;
    expect(indexHistory(S, 'p1')[0].applied).toBe(false);
    expect(indexHistory(S, 'p1')[0].after).toBe(14.0);
  });
  it('counts the bonus-ball doubling but ignores the scramble', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') };
    S.bonus.p1 = { used: { d1: 0 }, lost: null };
    expect(playerTally(S, 'd1', 'p1').pts).toBe(38); // doubled for the competition…
    expect(indexHistory(S, 'p1')[0].after).toBe(11.0); // …and the handicap moves on the 38
    S.bonus.p1 = { used: { d1: 0 }, lost: 'd1' }; // lost on its hole: the 2× is void, back to 36
    expect(indexHistory(S, 'p1')[0].after).toBe(12.0);
    S.bonus.p1 = { used: { d1: 0 }, lost: null };
    S.scramble.d3 = { 0: Array(18).fill(4), 1: Array(18).fill(4), 2: Array(18).fill(4), 3: Array(18).fill(4) };
    const d3 = indexHistory(S, 'p1')[2];
    expect(d3.round.id).toBe('d3');
    expect(d3.applied).toBe(false);
    expect(d3.after).toBe(d3.before);
  });
});

describe('scramble team handicap', () => {
  it('takes 35% of the lower course handicap and 15% of the higher, whichever order the team is listed', () => {
    const S = defaultState();
    // Team A at Cave Castle: Tim (14.0) and Adam (16.7)
    const lo = courseHandicap(S, 14.0, 'd3');
    const hi = courseHandicap(S, 16.7, 'd3');
    expect([lo, hi]).toEqual([13, 16]);
    expect(teamHandicap(S, 'd3', 0)).toBe(Math.round(lo * 0.35 + hi * 0.15));
    expect(teamHandicap(S, 'd3', 0)).toBe(7);
    S.groups.d3 = [['p3', 'p1'], ['p5', 'p7'], ['p2', 'p4'], ['p6', 'p8']];
    expect(teamHandicap(S, 'd3', 0)).toBe(7);
  });
  it('uses the index each player carries into the round', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') }; // Tim drifts 14.0 → 12.0
    expect(courseHandicap(S, 12.0, 'd3')).toBe(11);
    expect(teamHandicap(S, 'd3', 0)).toBe(Math.round(11 * 0.35 + 16 * 0.15));
    expect(teamHandicap(S, 'd3', 0)).toBe(6);
  });
});

describe('ties', () => {
  it('stableford: level on points and every countback shares the place points', () => {
    const S = defaultState();
    S.scores.d1 = {
      p1: netParFor(S, 'd1', 'p1'), p2: netParFor(S, 'd1', 'p2'), // 36 each, 2 points on every hole
      p3: netParFor(S, 'd1', 'p3', bogeys(1)),                   // 35
    };
    const rows = stablefordResults(S, 'd1');
    expect(rows.slice(0, 2).map((r) => r.pid).sort()).toEqual(['p1', 'p2']);
    for (const r of rows.slice(0, 2)) expect(r).toMatchObject({ place: 1, points: 9, tied: true }); // (10+8)/2
    expect(rows[2]).toMatchObject({ pid: 'p3', place: 3, points: 6, tied: false });
  });
  it('pairs: level on aggregate share, (6+4)/2 = 5 each at the top', () => {
    const S = defaultState();
    S.scores.d1 = Object.fromEntries(PIDS.map((pid, i) => [pid, netParFor(S, 'd1', pid, bogeys(i < 4 ? 0 : i < 6 ? 1 : 2))]));
    S.pairs.d1 = { pairs: [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['p7', 'p8']], revealed: true };
    const rows = pairTotals(S, 'd1');
    // 38 a head for net par: the uncalled bonus ball doubles the 18th
    expect(rows.map((r) => r.total)).toEqual([76, 76, 74, 72]);
    expect(rows[0]).toMatchObject({ place: 1, points: 5, tied: true });
    expect(rows[1]).toMatchObject({ place: 1, points: 5, tied: true });
    expect(rows[2]).toMatchObject({ place: 3, points: 2, tied: false });
    expect(rows[3]).toMatchObject({ place: 4, points: 0, tied: false });
    expect(pairPointsFor(S, 'd1', 'p1')).toBe(5);
    expect(pairPointsFor(S, 'd1', 'p4')).toBe(5);
    expect(pairPointsFor(S, 'd1', 'p7')).toBe(0);
  });
  it('scramble: two teams level at the top share 5 each and nobody wins outright', () => {
    const S = defaultState();
    const team = (t: number, delta: number[] = []) => netPar('d3', teamHandicap(S, 'd3', t), delta);
    S.scramble.d3 = { 0: team(0), 1: team(1), 2: team(2, bogeys(1)), 3: team(3, bogeys(2)) };
    const res = scrambleResults(S, 'd3');
    expect(res.decided).toBe(true);
    expect(res.winner).toBeNull();
    expect(res.rows.p1).toEqual({ points: 5, place: 1, won: false, tie: true }); // Team A
    expect(res.rows.p5).toEqual({ points: 5, place: 1, won: false, tie: true }); // Team B
    expect(res.rows.p2).toEqual({ points: 2, place: 3, won: false, tie: false }); // Team C
    expect(res.rows.p6.points).toBe(0);                                          // Team D
  });
});

describe('round status', () => {
  it('stableford: none → partial → done only when all eight cards are complete', () => {
    const S = defaultState();
    expect(roundStatus(S, 'd1')).toBe('none');
    S.scores.d1 = { p1: [4, ...Array(17).fill(null)] };
    expect(roundStatus(S, 'd1')).toBe('partial');
    S.scores.d1 = Object.fromEntries(PIDS.slice(0, 7).map((pid) => [pid, netParFor(S, 'd1', pid)]));
    expect(roundStatus(S, 'd1')).toBe('partial');
    S.scores.d1.p8 = netParFor(S, 'd1', 'p8');
    expect(roundStatus(S, 'd1')).toBe('done');
  });
  it('scramble: done only when all four team cards are complete', () => {
    const S = defaultState();
    expect(roundStatus(S, 'd3')).toBe('none');
    S.scramble.d3 = { 0: Array(18).fill(4), 1: Array(18).fill(4), 2: Array(18).fill(4) };
    expect(roundStatus(S, 'd3')).toBe('partial');
    S.scramble.d3[3] = Array(18).fill(4);
    expect(roundStatus(S, 'd3')).toBe('done');
  });
});

describe('standings', () => {
  it('equal week points and stableford share a rank; the next rank skips', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1'), p2: netParFor(S, 'd1', 'p2') };
    const st = standings(S);
    expect(st.slice(0, 2).map((r) => r.pid).sort()).toEqual(['p1', 'p2']);
    expect(st[0]).toMatchObject({ rank: 1, pts: 9, stab: 38 }); // 36 + the 18th doubled
    expect(st[1]).toMatchObject({ rank: 1, pts: 9, stab: 38 });
    expect(st[2].rank).toBe(3);
    expect(st[7].rank).toBe(3);
  });
  it('splits equal week points on total stableford', () => {
    const S = defaultState();
    // Elsham: Tim first (10), Matthew second (8). Ganton: the other way round —
    // level on 18 for the week, but Matthew's birdie gives him 76 stableford to
    // Tim's 75 (each round's 18th doubled by the uncalled bonus ball).
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1'), p2: netParFor(S, 'd1', 'p2', bogeys(1)) };
    S.scores.d2 = { p1: netParFor(S, 'd2', 'p1', bogeys(1)), p2: netParFor(S, 'd2', 'p2', [-1]) };
    const [a, b] = standings(S);
    expect(a).toMatchObject({ pid: 'p2', rank: 1, pts: 18, stab: 76 });
    expect(b).toMatchObject({ pid: 'p1', rank: 2, pts: 18, stab: 75 });
  });
});

// The knobs a different trip turns: place-based index drift, and the extras
// switched off. RULES is a plain object, so each test sets what it needs and
// puts it back.
import { afterEach } from 'vitest';
import { RULES, ROUNDS, dayLabel, type IndexAdjust, type Round } from '../data/trip';
import { bonusHoleFor, describeRules, indexTable } from '../lib/scoring';

const saved = { ...RULES, indexAdjust: RULES.indexAdjust };
afterEach(() => { Object.assign(RULES, saved); });

describe('index by finishing place', () => {
  const byPlace: IndexAdjust = { mode: 'place', byPlace: [-1, -0.5, 0.5, 1] };
  // Four of the eight play; the other four never start, so the round can't settle.
  const four = ['p1', 'p2', 'p3', 'p4'];
  const field = (S: TripState, rid: string, deltas: Record<string, number[]>) => {
    S.scores[rid] = {};
    for (const pid of PIDS) S.scores[rid][pid] = netParFor(S, rid, pid, deltas[pid] ?? []);
  };
  it('moves nobody until every card is in', () => {
    RULES.indexAdjust = byPlace;
    const S = defaultState();
    S.scores.d1 = {};
    for (const pid of four) S.scores.d1[pid] = netParFor(S, 'd1', pid);
    const h = indexHistory(S, 'p1')[0];
    expect(h.applied).toBe(false);
    expect(h.after).toBe(14.0);
  });
  it('steps 1st–4th by the table, separated on countback', () => {
    RULES.indexAdjust = byPlace;
    const S = defaultState();
    // p6 wins with two birdies, p5 second with one, p1 level, p7 drops a shot;
    // everyone else level and tied with p1 on countback.
    field(S, 'd1', { p6: [-1, -1], p5: [-1], p7: [1] });
    const t = indexTable(S);
    expect(t.p6[0].after).toBe(3.8 - 1);
    expect(t.p5[0].after).toBe(9.1 - 0.5);
    // p1, p2, p3, p4, p8 all level on 36 and every countback: they share 3rd–7th,
    // which is (0.5 + 1 + 0 + 0 + 0) / 5 = 0.3 each
    expect(t.p1[0].applied).toBe(true);
    expect(t.p1[0].after).toBe(14.3);
    expect(t.p8[0].after).toBe(9.4);
    // p7 last of eight: beyond the table, no step — but still applied
    expect(t.p7[0].applied).toBe(true);
    expect(t.p7[0].after).toBe(23.9);
    // the next round is played off the moved index
    expect(phFor(S, 'p6', 'd2')).toBe(playingHandicap(S, 2.8, 'd2'));
  });
  it('a tie at the top shares the first two steps', () => {
    RULES.indexAdjust = byPlace;
    const S = defaultState();
    field(S, 'd1', { p1: [-1], p2: [-1], p3: [1], p4: [1], p5: [1], p6: [1], p7: [1], p8: [1] });
    const t = indexTable(S);
    // Both birdied the 1st (SI 14 at Elsham) — level on every countback
    expect(t.p1[0].after).toBe(14.0 - 0.75);
    expect(t.p2[0].after).toBe(19.3 - 0.75);
  });
  it('leaves the scramble alone and chains through the week', () => {
    RULES.indexAdjust = byPlace;
    const S = defaultState();
    field(S, 'd1', { p1: [-1] });
    field(S, 'd2', { p1: [-1] });
    const t = indexTable(S);
    expect(t.p1[0].after).toBe(13.0);
    expect(t.p1[1].before).toBe(13.0);
    expect(t.p1[1].after).toBe(12.0);
    expect(t.p1[2].round.format).toBe('scramble');
    expect(t.p1[2].applied).toBe(false);
    expect(currentIndex(S, 'p1')).toBe(12.0);
  });
});

describe('extras switched off', () => {
  it('no bonus ball: nothing doubles, not even the 18th by default', () => {
    RULES.bonusBalls = false;
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') };
    expect(bonusHoleFor(S, 'd1', 'p1')).toBeNull();
    expect(playerTally(S, 'd1', 'p1').pts).toBe(36);
    expect(indexHistory(S, 'p1')[0].after).toBe(12.0);   // 36 − 32 = 4 × 0.5
    for (const pid of PIDS) S.scores.d1[pid] = netParFor(S, 'd1', pid);
    for (const r of ROUNDS) { S.scores[r.id] = S.scores[r.id] || {}; for (const pid of PIDS) S.scores[r.id][pid] = netPar(r.id, 10); }
    S.scramble.d3 = { 0: Array(18).fill(4), 1: Array(18).fill(4), 2: Array(18).fill(4), 3: Array(18).fill(4) };
    expect(standings(S).every((row) => row.bonusKept === 0)).toBe(true);
  });
  it('the rules sentence follows the flags', () => {
    expect(describeRules()).toContain('bonus ball');
    expect(describeRules()).toContain('±0.5 per point from 32');
    RULES.bonusBalls = false;
    RULES.indexAdjust = { mode: 'place', byPlace: [-1, -0.5, 0.5, 1] };
    RULES.placePoints = [6, 4, 2, 0];
    const d = describeRules();
    expect(d).not.toContain('bonus ball');
    expect(d).toContain('6 · 4 · 2 · 0 for 1st–4th');
    expect(d).toContain('−1.0 · −0.5 · +0.5 · +1.0 for 1st–4th');
  });
});

describe('two rounds in a day', () => {
  it('labels the day with the slot', () => {
    const r = ROUNDS[1];
    expect(dayLabel(r)).toBe('Tue');
    const am: Round = { ...r, slot: 'am' };
    expect(dayLabel(am)).toBe('Tue am');
  });
});
