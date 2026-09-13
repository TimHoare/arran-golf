// This trip's competition rules: the index moving by finishing place, chained
// through seven rounds, and the extras staying off.
import { describe, expect, it } from 'vitest';
import { PLAYERS, R, ROUNDS, RULES, dayLabel } from '../data/trip';
import { defaultState, type TripState } from '../lib/state';
import {
  bonusHoleFor, currentIndex, describeRules, indexHistory, indexTable, phFor, playerTally, playingHandicap, roundStatus,
  shotsOn, standings,
} from '../lib/scoring';

const PIDS = PLAYERS.map((p) => p.id);
const start = (pid: string) => PLAYERS.find((p) => p.id === pid)!.start;
// Gross scores that make net par on every hole off handicap ph — 2 points a
// hole, 36 for the round — with per-hole stroke adjustments on top.
const netPar = (rid: string, ph: number, delta: number[] = []) =>
  R(rid)!.holes.map((h, i) => h.par + shotsOn(ph, h.si) + (delta[i] ?? 0));
const netParFor = (S: TripState, rid: string, pid: string, delta: number[] = []) =>
  netPar(rid, phFor(S, pid, rid), delta);
// Everyone's card in for a round, off the index each carries into it.
const field = (S: TripState, rid: string, deltas: Record<string, number[]> = {}) => {
  S.scores[rid] = {};
  for (const pid of PIDS) S.scores[rid][pid] = netParFor(S, rid, pid, deltas[pid] ?? []);
};

describe('index by finishing place', () => {
  it('is the rule in play', () => {
    expect(RULES.indexAdjust).toEqual({ mode: 'place', byPlace: [-1, -0.5, 0.5, 1] });
  });
  it('moves nobody until every card is in', () => {
    const S = defaultState();
    S.scores.r1 = { p1: netParFor(S, 'r1', 'p1', [-1, -1, -1]), p2: netParFor(S, 'r1', 'p2') };
    for (const pid of PIDS) {
      const h = indexHistory(S, pid)[0];
      expect(h.applied).toBe(false);
      expect(h.after).toBe(start(pid));
    }
    expect(roundStatus(S, 'r1')).toBe('partial');
  });
  it('−1, −0.5, +0.5, +1 for 1st to 4th, separated on countback', () => {
    const S = defaultState();
    field(S, 'r1', { p3: [-1, -1], p1: [-1], p4: [1] });   // p3 wins, p1 2nd, p2 level 3rd, p4 last
    const t = indexTable(S);
    expect(t.p3[0]).toMatchObject({ before: start('p3'), after: start('p3') - 1, applied: true });
    expect(t.p1[0].after).toBe(start('p1') - 0.5);
    expect(t.p2[0].after).toBe(start('p2') + 0.5);
    expect(t.p4[0].after).toBe(start('p4') + 1);
    expect(roundStatus(S, 'r1')).toBe('done');
    // the next round is played off the moved index, not the starting one
    expect(phFor(S, 'p3', 'r2')).toBe(playingHandicap(S, start('p3') - 1, 'r2'));
    expect(phFor(S, 'p3', 'r2')).not.toBe(playingHandicap(S, start('p3'), 'r2'));
  });
  it('a tie at the top shares the first two steps', () => {
    const S = defaultState();
    // p1 and p2 both birdie the 1st and are level on every countback; the
    // other two drop a shot on the 1st.
    field(S, 'r1', { p1: [-1], p2: [-1], p3: [1], p4: [1] });
    const t = indexTable(S);
    expect(t.p1[0].after).toBe(start('p1') - 0.75);
    expect(t.p2[0].after).toBe(start('p2') - 0.75);
    expect(t.p3[0].after).toBe(start('p3') + 0.75);
    expect(t.p4[0].after).toBe(start('p4') + 0.75);
  });
  it('a three-way tie for 2nd shares (−0.5 + 0.5 + 1) / 3', () => {
    const S = defaultState();
    field(S, 'r1', { p1: [-1] });
    const t = indexTable(S);
    expect(t.p1[0].after).toBe(start('p1') - 1);
    for (const pid of ['p2', 'p3', 'p4']) {
      expect(t[pid][0].applied).toBe(true);
      expect(t[pid][0].after).toBeCloseTo(start(pid) + 1 / 3, 2);
    }
  });
  it('chains through the week: morning result sets the afternoon handicap', () => {
    const S = defaultState();
    field(S, 'r1', { p1: [-1] });
    field(S, 'r2', { p1: [-1] });   // Fri am, off the index r1 left everyone on
    field(S, 'r3', { p4: [-1] });   // Fri pm
    const t = indexTable(S);
    expect(t.p1.map((h) => h.after).slice(0, 3)).toEqual([start('p1') - 1, start('p1') - 2, start('p1') - 2 + 1 / 3].map((x) => Math.round(x * 100) / 100));
    expect(t.p1[3].before).toBe(t.p1[2].after);
    expect(t.p1[3].applied).toBe(false);
    expect(currentIndex(S, 'p1')).toBe(t.p1[2].after);
    expect(ROUNDS[1].dnum).toBe(ROUNDS[2].dnum);   // r2 and r3 really are the same day
  });
  it('all seven rounds in: seven steps each, week points add to 84', () => {
    const S = defaultState();
    for (const r of ROUNDS) field(S, r.id, { [PIDS[r.n % 4]]: [-1] });
    for (const pid of PIDS) expect(indexHistory(S, pid).filter((h) => h.applied)).toHaveLength(7);
    expect(standings(S).reduce((a, row) => a + row.pts, 0)).toBe(84);
  });
});

describe('extras off', () => {
  it('nothing doubles: a full card is 36 for net par, not 38', () => {
    const S = defaultState();
    S.scores.r1 = { p1: netParFor(S, 'r1', 'p1') };
    expect(bonusHoleFor(S, 'r1', 'p1')).toBeNull();
    expect(playerTally(S, 'r1', 'p1').pts).toBe(36);
  });
  it('the rules sentence says what is in play', () => {
    const d = describeRules();
    expect(d).toContain('6 · 4 · 2 · 0 for 1st–4th');
    expect(d).toContain('−1.0 · −0.5 · +0.5 · +1.0 for 1st–4th');
    expect(d).not.toContain('bonus ball');
    expect(d).not.toContain('pairs');
    expect(d).not.toContain('scramble');
  });
});

describe('two rounds in a day', () => {
  it('labels the day with the slot', () => {
    expect(dayLabel(ROUNDS[0])).toBe('Thu');
    expect(dayLabel(ROUNDS[1])).toBe('Fri am');
    expect(dayLabel(ROUNDS[2])).toBe('Fri pm');
  });
});
