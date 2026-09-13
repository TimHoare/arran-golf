// The app store: trip state + identity + sync status, with localStorage
// persistence and Supabase live sync. Local-first writes: every change lands
// in localStorage immediately, queues in an outbox, and upserts to the shared
// database; realtime changes from other phones are applied as they arrive.
// With no Supabase keys configured everything runs single-phone.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../config';
import { BITS, PLAYERS, R, TRIP } from '../data/trip';
import {
  defaultState, loadState, persistState, migrate, cleanBonusBall, cleanHoleBits, cleanStakes,
  BIT_KINDS, ME_KEY, OUTBOX_KEY,
  type TripState, type PairDraw, type BitKind, type BonusBall, type HoleBits, type Stakes,
} from './state';
import { blank18, blankBits } from './scoring';

export type SyncStatus = 'local' | 'connecting' | 'live' | 'offline';

interface Op { t: 'hole' | 'team' | 'pair' | 'group' | 'bits' | 'stake' | 'bonus' | 'tee'; k: (string | number)[]; v: unknown; key: string }

export interface Snapshot {
  S: TripState;
  me: string | null;               // player id, 'watcher', or null (not chosen)
  syncStatus: SyncStatus;
  pending: number;                 // outbox length
}

export const hasSync = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

let S = loadState();
let me = ((): string | null => {
  const m = localStorage.getItem(ME_KEY);
  return m && (m === 'watcher' || PLAYERS.some((p) => p.id === m)) ? m : null;
})();
let syncStatus: SyncStatus = hasSync ? 'connecting' : 'local';
let outbox: Op[] = (() => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
})();

let snapshot: Snapshot = { S, me, syncStatus, pending: outbox.length };
const listeners = new Set<() => void>();
function emit() {
  snapshot = { S, me, syncStatus, pending: outbox.length };
  listeners.forEach((l) => l());
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const getSnapshot = () => snapshot;

// Test hook: re-read everything from localStorage (the store is a module singleton).
export function reloadFromStorage() {
  S = loadState();
  try { outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { outbox = []; }
  const m = localStorage.getItem(ME_KEY);
  me = m && (m === 'watcher' || PLAYERS.some((p) => p.id === m)) ? m : null;
  emit();
}

function save() { persistState(S); }
function saveOutbox() { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); }
function setSyncStatus(st: SyncStatus) { syncStatus = st; emit(); }

// ---------- Mutations (local + queued push) ----------
export function setGross(rid: string, target: { pid: string } | { team: number }, holeIdx: number, gross: number | null) {
  // 0 is a pickup (no score on the hole); 1–20 are real gross scores.
  const v = gross === null ? null : Math.min(20, Math.max(0, Math.round(gross)));
  if ('team' in target) {
    S.scramble[rid] = S.scramble[rid] || {};
    const arr = S.scramble[rid][target.team] || blank18();
    arr[holeIdx] = v;
    S.scramble[rid][target.team] = arr;
    pushOp('team', [rid, target.team, holeIdx + 1], v);
  } else {
    S.scores[rid] = S.scores[rid] || {};
    const arr = S.scores[rid][target.pid] || blank18();
    arr[holeIdx] = v;
    S.scores[rid][target.pid] = arr;
    pushOp('hole', [rid, target.pid, holeIdx + 1], v);
  }
  save(); emit();
}

export function setPairDraw(rid: string, draw: PairDraw | null) {
  if (draw) S.pairs[rid] = draw; else delete S.pairs[rid];
  pushOp('pair', [rid], draw);
  save(); emit();
}

export function setGroupDraw(rid: string, groups: string[][] | null) {
  if (groups) S.groups[rid] = groups; else delete S.groups[rid];
  pushOp('group', [rid], groups);
  save(); emit();
}

// One hole's side-bet log for one kind in one tee group. Empty logs store as
// null (and upsert an empty row) so clearing syncs like any other edit.
export function setHoleBits(rid: string, group: number, kind: BitKind, holeIdx: number, hb: HoleBits | null) {
  const max = BITS[kind].max;
  if (hb && max !== undefined)
    hb = { ...hb, counts: Object.fromEntries(Object.entries(hb.counts).map(([pid, n]) => [pid, Math.min(n, max)])) };
  const v = cleanHoleBits(hb);
  S.bits[rid] = S.bits[rid] || {};
  S.bits[rid][group] = S.bits[rid][group] || {};
  const arr = S.bits[rid][group][kind] || blankBits();
  arr[holeIdx] = v;
  S.bits[rid][group][kind] = arr;
  pushOp('bits', [rid, group, kind, holeIdx + 1], v);
  save(); emit();
}

// A player's whole bonus-ball record: which hole per round it doubled, and
// the round it was lost in (null while still in play).
export function setBonusBall(pid: string, bb: BonusBall) {
  const v = cleanBonusBall(bb);
  S.bonus[pid] = v;
  pushOp('bonus', [pid], v);
  save(); emit();
}

export function setStakes(stakes: Stakes) {
  S.stakes = cleanStakes(stakes);
  pushOp('stake', ['all'], S.stakes);
  save(); emit();
}

// Which tees a round is played off — null reverts to the round's default.
// Shared state: it moves everyone's course handicaps, so it syncs like scores.
export function setTeeChoice(rid: string, tee: string | null) {
  if (tee) S.teeChoice[rid] = tee; else delete S.teeChoice[rid];
  pushOp('tee', [rid], tee);
  save(); emit();
}

export function setMe(id: string | null) {
  me = id;
  if (id) localStorage.setItem(ME_KEY, id); else localStorage.removeItem(ME_KEY);
  emit();
}

export function importState(json: string) {
  S = migrate(JSON.parse(json));
  save(); emit();
}
export const exportState = () => JSON.stringify(S, null, 2);

// This phone only. The shared database can't be wiped from the app: its policies
// don't allow deleting scores (see supabase-schema.sql), so a stray tap can't
// take the week out for everyone. With sync on, a reload just hydrates it back.
export function resetAll() {
  S = defaultState();
  outbox = []; saveOutbox(); save(); emit();
}

// ---------- Outbox ----------
// One op per (table, key): later writes to the same hole replace the queued one.
function pushOp(t: Op['t'], k: (string | number)[], v: unknown) {
  if (!hasSync) return;
  const key = t + '|' + k.join('|');
  outbox = outbox.filter((o) => o.key !== key);
  outbox.push({ t, k, v, key });
  saveOutbox(); emit();
  void flushOutbox();
}

let sb: SupabaseClient | null = null;
let flushing = false;
let retryT: ReturnType<typeof setTimeout> | undefined;
export async function flushOutbox() {
  if (!sb || flushing) return;
  flushing = true;
  try {
    while (outbox.length) {
      const op = outbox[0];
      const now = new Date().toISOString();
      let error;
      if (op.t === 'hole') {
        ({ error } = await sb.from('hole_scores').upsert({ round_id: op.k[0], player_id: op.k[1], hole: op.k[2], gross: op.v, updated_at: now }));
      } else if (op.t === 'team') {
        ({ error } = await sb.from('team_scores').upsert({ round_id: op.k[0], team: op.k[1], hole: op.k[2], gross: op.v, updated_at: now }));
      } else if (op.t === 'bits') {
        const hb = op.v as HoleBits | null;
        ({ error } = await sb.from('bit_events').upsert({ round_id: op.k[0], grp: op.k[1], kind: op.k[2], hole: op.k[3], counts: hb?.counts ?? {}, last_pid: hb?.last ?? null, updated_at: now }));
      } else if (op.t === 'stake') {
        ({ error } = await sb.from('stakes').upsert({ id: 1, stakes: op.v, updated_at: now }));
      } else if (op.t === 'bonus') {
        const bb = op.v as BonusBall;
        ({ error } = await sb.from('bonus_balls').upsert({ player_id: op.k[0], used: bb.used, lost_round: bb.lost, updated_at: now }));
      } else if (op.t === 'tee') {
        ({ error } = op.v === null
          ? await sb.from('tee_choices').delete().eq('round_id', op.k[0])
          : await sb.from('tee_choices').upsert({ round_id: op.k[0], tee: op.v, updated_at: now }));
      } else if (op.t === 'group') {
        ({ error } = op.v === null
          ? await sb.from('group_draws').delete().eq('round_id', op.k[0])
          : await sb.from('group_draws').upsert({ round_id: op.k[0], groups: op.v, updated_at: now }));
      } else if (op.v === null) {
        ({ error } = await sb.from('pair_draws').delete().eq('round_id', op.k[0]));
      } else {
        const d = op.v as PairDraw;
        ({ error } = await sb.from('pair_draws').upsert({ round_id: op.k[0], pairs: d.pairs, revealed: d.revealed, updated_at: now }));
      }
      if (error) throw error;
      // Remove the op we sent — by identity, not position: a newer edit to the
      // same key may have replaced it in the queue while the request was out,
      // and that one still has to go.
      outbox = outbox.filter((o) => o !== op); saveOutbox();
    }
    setSyncStatus('live');
  } catch {
    setSyncStatus('offline');
    clearTimeout(retryT);
    retryT = setTimeout(() => void flushOutbox(), 5000);
  }
  flushing = false;
}

// ---------- Applying server rows ----------
function applyHole(rid: string, pid: string, hole: number, gross: number | null) {
  if (!R(rid) || !PLAYERS.some((p) => p.id === pid)) return;
  S.scores[rid] = S.scores[rid] || {};
  const arr = S.scores[rid][pid] || blank18();
  arr[hole - 1] = gross;
  S.scores[rid][pid] = arr;
}
function applyTeamHole(rid: string, t: number, hole: number, gross: number | null) {
  if (!R(rid)) return;
  S.scramble[rid] = S.scramble[rid] || {};
  const arr = S.scramble[rid][t] || blank18();
  arr[hole - 1] = gross;
  S.scramble[rid][t] = arr;
}

function applyBits(rid: string, grp: number, kind: string, hole: number, hb: HoleBits | null) {
  if (!R(rid) || !BIT_KINDS.includes(kind as BitKind) || Number.isNaN(grp)) return;
  S.bits[rid] = S.bits[rid] || {};
  S.bits[rid][grp] = S.bits[rid][grp] || {};
  const arr = S.bits[rid][grp][kind as BitKind] || blankBits();
  arr[hole - 1] = hb;
  S.bits[rid][grp][kind as BitKind] = arr;
}

function applyBonus(pid: string, bb: BonusBall) {
  if (!PLAYERS.some((p) => p.id === pid)) return;
  S.bonus[pid] = bb;
}

// The outbox key a server row would carry, so realtime echoes of a value this
// phone is still writing over can be told apart from other phones' edits.
function rowKey(table: string, row: Row): string | null {
  switch (table) {
    case 'hole_scores': return `hole|${row.round_id}|${row.player_id}|${row.hole}`;
    case 'team_scores': return `team|${row.round_id}|${row.team}|${row.hole}`;
    case 'bit_events': return `bits|${row.round_id}|${row.grp}|${row.kind}|${row.hole}`;
    case 'stakes': return 'stake|all';
    case 'bonus_balls': return `bonus|${row.player_id}`;
    case 'tee_choices': return `tee|${row.round_id}`;
    case 'group_draws': return `group|${row.round_id}`;
    case 'pair_draws': return `pair|${row.round_id}`;
    default: return null;
  }
}

interface Row { round_id: string; player_id?: string; team?: number; hole?: number; gross?: number | null; pairs?: string[][]; revealed?: boolean; groups?: string[][]; grp?: number; kind?: string; counts?: Record<string, number>; last_pid?: string | null; stakes?: unknown; used?: unknown; lost_round?: string | null; tee?: string }
function onRowChange(table: string, type: string, row: Row) {
  // While an edit to this key is queued or in flight, the local value is
  // newer than anything the server can tell us — the echo of our own earlier
  // write would only flick the screen back for a moment.
  const key = rowKey(table, row);
  if (key && outbox.some((o) => o.key === key)) return;
  if (table === 'bonus_balls') {
    if (type === 'DELETE') delete S.bonus[row.player_id!];
    else applyBonus(row.player_id!, cleanBonusBall({ used: row.used, lost: row.lost_round }));
  }
  else if (table === 'hole_scores') applyHole(row.round_id, row.player_id!, row.hole!, type === 'DELETE' ? null : row.gross ?? null);
  else if (table === 'team_scores') applyTeamHole(row.round_id, Number(row.team), row.hole!, type === 'DELETE' ? null : row.gross ?? null);
  else if (table === 'bit_events') applyBits(row.round_id, Number(row.grp), row.kind!, row.hole!, type === 'DELETE' ? null : cleanHoleBits({ counts: row.counts, last: row.last_pid }));
  else if (table === 'stakes') { if (type !== 'DELETE') S.stakes = cleanStakes(row.stakes); }
  else if (table === 'pair_draws') {
    if (type === 'DELETE') delete S.pairs[row.round_id];
    else S.pairs[row.round_id] = { pairs: row.pairs!, revealed: !!row.revealed };
  } else if (table === 'group_draws') {
    if (type === 'DELETE') delete S.groups[row.round_id];
    else S.groups[row.round_id] = row.groups!;
  } else if (table === 'tee_choices') {
    if (type === 'DELETE' || typeof row.tee !== 'string') delete S.teeChoice[row.round_id];
    else S.teeChoice[row.round_id] = row.tee;
  }
  save(); emit();
}

// Replay one queued (unsent) edit onto local state — the local half of what
// flushOutbox will do on the server.
function applyOp(op: Op) {
  const [k0, k1, k2, k3] = op.k;
  if (op.t === 'hole') applyHole(String(k0), String(k1), Number(k2), op.v as number | null);
  else if (op.t === 'team') applyTeamHole(String(k0), Number(k1), Number(k2), op.v as number | null);
  else if (op.t === 'bits') applyBits(String(k0), Number(k1), String(k2), Number(k3), cleanHoleBits(op.v as HoleBits | null));
  else if (op.t === 'stake') S.stakes = cleanStakes(op.v);
  else if (op.t === 'bonus') applyBonus(String(k0), cleanBonusBall(op.v));
  else if (op.t === 'tee') { if (op.v === null) delete S.teeChoice[String(k0)]; else S.teeChoice[String(k0)] = op.v as string; }
  else if (op.t === 'group') { if (op.v === null) delete S.groups[String(k0)]; else S.groups[String(k0)] = op.v as string[][]; }
  else if (op.t === 'pair') { if (op.v === null) delete S.pairs[String(k0)]; else S.pairs[String(k0)] = op.v as PairDraw; }
}

// The shared database is the truth. Hydration rebuilds local state from it
// wholesale, then replays whatever this phone has queued but not yet sent.
// Anything local that the server no longer has was cleared by someone else
// while this phone wasn't listening — it must NOT be pushed back up, or a
// phone that slept through a "clear the teams" would quietly restore them.
async function hydrateFromServer(client: SupabaseClient) {
  const [hs, ts, pd, gd, be, sk, bb, tc] = await Promise.all([
    client.from('hole_scores').select('*'),
    client.from('team_scores').select('*'),
    client.from('pair_draws').select('*'),
    client.from('group_draws').select('*'),
    client.from('bit_events').select('*'),
    client.from('stakes').select('*'),
    client.from('bonus_balls').select('*'),
    client.from('tee_choices').select('*'),
  ]);
  if (hs.error || ts.error || pd.error) throw hs.error || ts.error || pd.error;
  // group_draws, bit_events and stakes arrived later than the other tables — a
  // database that predates them should still sync everything else rather than sit offline.
  const gdRows: Row[] = gd.error ? [] : (gd.data as Row[]);
  const beRows: Row[] = be.error ? [] : (be.data as Row[]);
  const skRows: Row[] = sk.error ? [] : (sk.data as Row[]);
  const bbRows: Row[] = bb.error ? [] : (bb.data as Row[]);
  const tcRows: Row[] = tc.error ? [] : (tc.data as Row[]);
  S = defaultState();
  for (const r of hs.data as Row[]) applyHole(r.round_id, r.player_id!, r.hole!, r.gross ?? null);
  for (const r of ts.data as Row[]) applyTeamHole(r.round_id, Number(r.team), r.hole!, r.gross ?? null);
  for (const r of pd.data as Row[]) S.pairs[r.round_id] = { pairs: r.pairs!, revealed: !!r.revealed };
  for (const r of gdRows) S.groups[r.round_id] = r.groups!;
  for (const r of beRows) applyBits(r.round_id, Number(r.grp), r.kind!, r.hole!, cleanHoleBits({ counts: r.counts, last: r.last_pid }));
  for (const r of skRows) S.stakes = cleanStakes(r.stakes);
  for (const r of bbRows) applyBonus(r.player_id!, cleanBonusBall({ used: r.used, lost: r.lost_round }));
  for (const r of tcRows) if (R(r.round_id) && typeof r.tee === 'string') S.teeChoice[r.round_id] = r.tee;
  // Edits made while offline are still queued: keep them on screen until they land.
  for (const op of outbox) applyOp(op);
  save(); emit();
}

// createClient is injectable for tests.
export function initSync(create: typeof createClient = createClient) {
  if (!hasSync) return;
  sb = create(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  const hydrate = () => hydrateFromServer(sb!)
    .then(() => { setSyncStatus('live'); void flushOutbox(); })
    .catch(() => { setSyncStatus('offline'); setTimeout(hydrate, 5000); });
  hydrate();
  sb.channel(TRIP.slug + '-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, (p) => onRowChange('hole_scores', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_scores' }, (p) => onRowChange('team_scores', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_draws' }, (p) => onRowChange('pair_draws', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_draws' }, (p) => onRowChange('group_draws', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bit_events' }, (p) => onRowChange('bit_events', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stakes' }, (p) => onRowChange('stakes', p.eventType, p.eventType === 'DELETE' ? p.old as Row : p.new as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_balls' }, (p) => onRowChange('bonus_balls', p.eventType, (p.new as Row)?.player_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tee_choices' }, (p) => onRowChange('tee_choices', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') { setSyncStatus('live'); void flushOutbox(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('offline');
    });
  window.addEventListener('online', () => void flushOutbox());
}
