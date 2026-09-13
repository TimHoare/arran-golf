// Sync engine against a mocked Supabase client: hydration (server wins, stale
// local state dropped, unsent edits kept), every kind of edit reaching its table, realtime
// application, and the outbox when the network is down.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The live config is blank until the trip's Supabase project exists; the
// engine only starts when it's set, so give it one here.
vi.mock('../config', () => ({ CONFIG: { supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'sb_publishable_test' } }));
import {
  flushOutbox, getSnapshot, initSync, reloadFromStorage, setBonusBall, setGross, setGroupDraw, setHoleBits,
  setPairDraw, setStakes, setTeeChoice,
} from '../lib/store';
import { OUTBOX_KEY, STORE_KEY } from '../lib/state';

type Handler = (p: { eventType: string; new: unknown; old: unknown }) => void;

// `missing` tables answer select with an error, as a database that predates them would.
function mockSupabase(db: Record<string, unknown[]>, missing: string[] = []) {
  const upserts: { table: string; row: Record<string, unknown> }[] = [];
  const deletes: { table: string; col: string; val: unknown }[] = [];
  const handlers: { table: string; cb: Handler }[] = [];
  let failing = false;
  const client = {
    from: (table: string) => ({
      select: async () => missing.includes(table)
        ? { data: null, error: { message: `relation "${table}" does not exist` } }
        : { data: db[table] ?? [], error: null },
      upsert: async (row: Record<string, unknown>) => {
        if (failing) return { error: { message: 'network down' } };
        upserts.push({ table, row });
        return { error: null };
      },
      delete: () => ({
        eq: async (col: string, val: unknown) => { deletes.push({ table, col, val }); return { error: null }; },
        neq: async () => ({ error: null }),
      }),
    }),
    channel: () => {
      const ch = {
        on: (_ev: string, filter: { table: string }, cb: Handler) => { handlers.push({ table: filter.table, cb }); return ch; },
        subscribe: (cb: (s: string) => void) => { setTimeout(() => cb('SUBSCRIBED'), 0); return ch; },
      };
      return ch;
    },
  };
  const start = () => initSync(vi.fn().mockReturnValue(client) as never);
  const handler = (table: string) => handlers.find((h) => h.table === table)!.cb;
  return { upserts, deletes, start, handler, fail: (f: boolean) => { failing = f; } };
}

const tick = () => new Promise((r) => setTimeout(r, 10));
const stored = () => JSON.parse(localStorage.getItem(STORE_KEY)!);
const outbox = (): { k: (string | number)[]; v: unknown }[] => JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');

describe('sync engine', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadFromStorage();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('hydrates server rows over stale local state, keeps unsent edits, and applies realtime changes', async () => {
    // This phone slept through a clear: it still holds a score and the Cave
    // Castle teams that were wiped from the shared database meanwhile, plus
    // one score it entered offline that never got sent.
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, scores: { r1: { p2: [5, ...Array(17).fill(null)], p4: [null, null, 6, ...Array(15).fill(null)] } },
      pairs: {}, scramble: {}, groups: { r3: [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['p7', 'p8']] },
    }));
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([{ t: 'hole', k: ['r1', 'p4', 3], v: 6, key: 'hole|r1|p4|3' }]));
    reloadFromStorage();

    const m = mockSupabase({
      hole_scores: [{ round_id: 'r1', player_id: 'p1', hole: 1, gross: 4 }],
      team_scores: [], pair_draws: [],
    });
    m.start();
    await tick();

    // server row applied locally (server wins)
    expect(stored().scores.r1.p1[0]).toBe(4);
    // stale local-only state is dropped, not pushed back up to resurrect it
    expect(stored().scores.r1.p2).toBeUndefined();
    expect(stored().groups.r3).toBeUndefined();
    expect(m.upserts.some((u) => u.table === 'group_draws')).toBe(false);
    expect(m.upserts.some((u) => u.table === 'hole_scores' && u.row.player_id === 'p2')).toBe(false);
    // the queued offline edit stays on screen and is the only thing sent
    expect(stored().scores.r1.p4[2]).toBe(6);
    expect(m.upserts.filter((u) => u.table === 'hole_scores').map((u) => [u.row.player_id, u.row.hole, u.row.gross])).toEqual([['p4', 3, 6]]);
    expect(outbox()).toHaveLength(0);

    // entering a score upserts with the right hole number
    m.upserts.length = 0;
    setGross('r1', { pid: 'p1' }, 6, 3); // hole 7 (index 6)
    await tick();
    expect(m.upserts.some((u) => u.table === 'hole_scores' && u.row.hole === 7 && u.row.gross === 3)).toBe(true);
    expect(outbox()).toHaveLength(0);

    // realtime change from another phone lands in local state
    m.handler('hole_scores')({ eventType: 'UPDATE', new: { round_id: 'r1', player_id: 'p3', hole: 2, gross: 5 }, old: {} });
    expect(stored().scores.r1.p3[1]).toBe(5);

    // realtime pair draw
    m.handler('pair_draws')({ eventType: 'INSERT', new: { round_id: 'r1', pairs: [['p1', 'p2']], revealed: false }, old: {} });
    expect(stored().pairs.r1.revealed).toBe(false);

    await flushOutbox();
  });

  it('a cleared draw stays cleared when a phone that missed the clear reconnects', async () => {
    // Someone set the teams, they synced, then someone else cleared them
    // while this phone was asleep. Reconnecting must not bring them back.
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, scores: {}, pairs: {}, scramble: { r3: { 0: [4, ...Array(17).fill(null)] } },
      groups: { r3: [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['p7', 'p8']] },
    }));
    reloadFromStorage();
    const m = mockSupabase({ hole_scores: [], team_scores: [], pair_draws: [], group_draws: [] });
    m.start();
    await tick();
    expect(stored().groups.r3).toBeUndefined();
    expect(stored().scramble.r3).toBeUndefined();
    expect(m.upserts).toHaveLength(0);
    expect(getSnapshot().syncStatus).toBe('live');
  });

  it('every kind of edit reaches its own table; clearing one deletes the row', async () => {
    const m = mockSupabase({ hole_scores: [], team_scores: [], pair_draws: [] });
    m.start();
    await tick();
    m.upserts.length = 0;

    setGross('r3', { team: 1 }, 0, 4);
    setHoleBits('r1', 0, 'cuckoo', 2, { counts: { p1: 2 }, last: 'p1' });
    setBonusBall('p1', { used: { r1: 4 }, lost: null });
    setStakes({ cuckoo: 20, camel: 10, fish: 10, threeputt: 10, lostball: 10 });
    setTeeChoice('r2', 'white');
    setGroupDraw('r1', [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']]);
    setPairDraw('r1', { pairs: [['p1', 'p2']], revealed: false });
    await tick();

    const row = (table: string) => m.upserts.find((u) => u.table === table)?.row;
    expect(row('team_scores')).toMatchObject({ round_id: 'r3', team: 1, hole: 1, gross: 4 });
    expect(row('bit_events')).toMatchObject({ round_id: 'r1', grp: 0, kind: 'cuckoo', hole: 3, counts: { p1: 2 }, last_pid: 'p1' });
    expect(row('bonus_balls')).toMatchObject({ player_id: 'p1', used: { r1: 4 }, lost_round: null });
    expect(row('stakes')).toMatchObject({ id: 1, stakes: { cuckoo: 20, camel: 10 } });
    expect(row('tee_choices')).toMatchObject({ round_id: 'r2', tee: 'white' });
    expect(row('group_draws')).toMatchObject({ round_id: 'r1', groups: [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']] });
    expect(row('pair_draws')).toMatchObject({ round_id: 'r1', pairs: [['p1', 'p2']], revealed: false });
    expect(outbox()).toHaveLength(0);
    expect(getSnapshot().syncStatus).toBe('live');

    setTeeChoice('r2', null);
    setGroupDraw('r1', null);
    setPairDraw('r1', null);
    await tick();
    expect(m.deletes).toEqual(expect.arrayContaining([
      { table: 'tee_choices', col: 'round_id', val: 'r2' },
      { table: 'group_draws', col: 'round_id', val: 'r1' },
      { table: 'pair_draws', col: 'round_id', val: 'r1' },
    ]));
    expect(stored().teeChoice.r2).toBeUndefined();
    expect(stored().groups.r1).toBeUndefined();
    expect(stored().pairs.r1).toBeUndefined();
  });

  it('hydrates the newer tables too', async () => {
    const m = mockSupabase({
      hole_scores: [], pair_draws: [],
      team_scores: [{ round_id: 'r3', team: 0, hole: 5, gross: 3 }],
      group_draws: [{ round_id: 'r1', groups: [['p1'], ['p2']] }],
      bit_events: [{ round_id: 'r1', grp: 1, kind: 'fish', hole: 9, counts: { p5: 1 }, last_pid: 'p5' }],
      stakes: [{ id: 1, stakes: { cuckoo: 50 } }],
      bonus_balls: [{ player_id: 'p2', used: { r1: 7 }, lost_round: 'r1' }],
      tee_choices: [{ round_id: 'r2', tee: 'white' }],
    });
    m.start();
    await tick();
    const S = stored();
    expect(S.scramble.r3['0'][4]).toBe(3);
    expect(S.groups.r1).toEqual([['p1'], ['p2']]);
    expect(S.bits.r1['1'].fish[8]).toEqual({ counts: { p5: 1 }, last: 'p5' });
    expect(S.stakes).toMatchObject({ cuckoo: 50, camel: 10 });
    expect(S.bonus.p2).toEqual({ used: { r1: 7 }, lost: 'r1' });
    expect(S.teeChoice.r2).toBe('white');
    expect(getSnapshot().syncStatus).toBe('live');
    // nothing local-only to seed, so no writes during hydration
    expect(m.upserts).toHaveLength(0);
  });

  it('a database without the newer tables still syncs scores rather than sitting offline', async () => {
    const m = mockSupabase(
      { hole_scores: [{ round_id: 'r1', player_id: 'p1', hole: 1, gross: 4 }], team_scores: [], pair_draws: [] },
      ['group_draws', 'bit_events', 'stakes', 'bonus_balls', 'tee_choices'],
    );
    m.start();
    await tick();
    expect(stored().scores.r1.p1[0]).toBe(4);
    expect(getSnapshot().syncStatus).toBe('live');
  });

  it('realtime deletes clear the local copy; rows for unknown rounds are ignored', async () => {
    const m = mockSupabase({
      hole_scores: [{ round_id: 'r1', player_id: 'p1', hole: 1, gross: 4 }], team_scores: [], pair_draws: [],
      tee_choices: [{ round_id: 'r2', tee: 'white' }],
      group_draws: [{ round_id: 'r1', groups: [['p1'], ['p2']] }],
    });
    m.start();
    await tick();
    m.handler('hole_scores')({ eventType: 'DELETE', new: {}, old: { round_id: 'r1', player_id: 'p1', hole: 1, gross: 4 } });
    expect(stored().scores.r1.p1[0]).toBeNull();
    m.handler('tee_choices')({ eventType: 'DELETE', new: {}, old: { round_id: 'r2', tee: 'white' } });
    expect(stored().teeChoice.r2).toBeUndefined();
    m.handler('group_draws')({ eventType: 'DELETE', new: {}, old: { round_id: 'r1' } });
    expect(stored().groups.r1).toBeUndefined();
    m.handler('bonus_balls')({ eventType: 'UPDATE', new: { player_id: 'p3', used: { r2: 3 }, lost_round: null }, old: {} });
    expect(stored().bonus.p3).toEqual({ used: { r2: 3 }, lost: null });
    m.handler('hole_scores')({ eventType: 'INSERT', new: { round_id: 'd9', player_id: 'p1', hole: 1, gross: 4 }, old: {} });
    expect(stored().scores.d9).toBeUndefined();
  });

  it('rapid taps: a newer edit queued while the first is in flight still gets sent, and echoes of the older value are ignored', async () => {
    // A client whose upserts only complete when told to, so two taps can
    // overlap the way they do on a phone.
    const pending: (() => void)[] = [];
    const upserts: Record<string, unknown>[] = [];
    const handlers: { table: string; cb: Handler }[] = [];
    const client = {
      from: (table: string) => ({
        select: async () => ({ data: [], error: null }),
        upsert: (row: Record<string, unknown>) => new Promise((resolve) => {
          pending.push(() => { upserts.push({ table, ...row }); resolve({ error: null }); });
        }),
        delete: () => ({ eq: async () => ({ error: null }), neq: async () => ({ error: null }) }),
      }),
      channel: () => {
        const ch = {
          on: (_ev: string, filter: { table: string }, cb: Handler) => { handlers.push({ table: filter.table, cb }); return ch; },
          subscribe: (cb: (s: string) => void) => { setTimeout(() => cb('SUBSCRIBED'), 0); return ch; },
        };
        return ch;
      },
    };
    initSync(vi.fn().mockReturnValue(client) as never);
    await tick();
    const echo = (gross: number) => handlers.find((h) => h.table === 'hole_scores')!.cb({ eventType: 'UPDATE', new: { round_id: 'r1', player_id: 'p2', hole: 3, gross }, old: {} });

    setGross('r1', { pid: 'p2' }, 2, 4);      // first tap: 4, goes out immediately
    await tick();
    setGross('r1', { pid: 'p2' }, 2, 5);      // second tap while the first is in flight
    setGross('r1', { pid: 'p2' }, 2, 6);      // and a third
    expect(getSnapshot().S.scores.r1.p2[2]).toBe(6);

    echo(4);                                   // server echoes the first write back
    expect(getSnapshot().S.scores.r1.p2[2]).toBe(6);   // ignored: we're still writing

    pending.shift()!();                        // first write lands
    await tick();
    expect(pending).toHaveLength(1);           // the replacement (6) is now on its way
    pending.shift()!();
    await tick();
    expect(upserts.map((u) => u.gross)).toEqual([4, 6]);
    expect(outbox()).toEqual([]);
    echo(6);
    expect(getSnapshot().S.scores.r1.p2[2]).toBe(6);
    // and a genuine change from another phone still applies once nothing's queued
    echo(5);
    expect(getSnapshot().S.scores.r1.p2[2]).toBe(5);
  });

  it('offline: edits queue, later writes to the same hole replace earlier ones, the retry drains them', async () => {
    const realSetTimeout = globalThis.setTimeout;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const settle = () => new Promise((r) => realSetTimeout(r, 0)); // real macrotask: drains promise chains
    const m = mockSupabase({ hole_scores: [], team_scores: [], pair_draws: [] });
    m.start();
    await settle();
    await vi.advanceTimersByTimeAsync(0); // channel SUBSCRIBED
    expect(getSnapshot().syncStatus).toBe('live');

    m.fail(true);
    setGross('r1', { pid: 'p1' }, 0, 5);
    setGross('r1', { pid: 'p1' }, 0, 4);
    setGross('r1', { pid: 'p1' }, 1, 3);
    await settle();
    expect(getSnapshot().syncStatus).toBe('offline');
    expect(getSnapshot().pending).toBe(2);
    expect(outbox().map((o) => [o.k[2], o.v])).toEqual([[1, 4], [2, 3]]);
    expect(stored().scores.r1.p1.slice(0, 2)).toEqual([4, 3]); // local state never waited for the network

    m.fail(false);
    await vi.advanceTimersByTimeAsync(4999);
    expect(getSnapshot().pending).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(getSnapshot().pending).toBe(0);
    expect(getSnapshot().syncStatus).toBe('live');
    expect(m.upserts.filter((u) => u.table === 'hole_scores').map((u) => [u.row.hole, u.row.gross])).toEqual([[1, 4], [2, 3]]);
  });
});
