// Round-level widgets shared by pages: format chips, hidden-pairs box,
// scramble result, the round leaderboard, and the live gross/points scorecard.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ONE_GROUP, PL, PLAYERS, R, first, pName, gname, ord, type Round } from '../data/trip';
import { RULES } from '../data/trip';
import {
  groupsFor, half, pairPointsFor, splits, pairTotals, playerTally, roundStatus, stablefordResults, teamTally, phFor, scrambleResults, shotsOn, trim,
  type Tally,
} from '../lib/scoring';
import { setPairDraw } from '../lib/store';
import { useStore } from '../lib/useStore';
import { toast } from '../lib/toast';
import { Avatar, TeamAvatar } from './Avatar';

export function FormatChips({ r }: { r: Round }) {
  if (r.format === 'scramble') return <span className="chip gorse">2-man scramble</span>;
  return (
    <>
      <span className="chip">Stableford</span>
      {r.pairs && <span className="chip heather">Hidden pairs</span>}
    </>
  );
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PairsBox({ r }: { r: Round }) {
  const { S } = useStore();
  const pr = S.pairs[r.id];
  const drawn = !!pr?.revealed;
  const [drawing, setDrawing] = useState(false);

  const redraw = () => { if (confirm('Redraw the pairs for this round?')) setPairDraw(r.id, null); };

  // The hat stays shut until all 18 holes are in for everyone.
  const out = PLAYERS.filter((p) => !playerTally(S, r.id, p.id).complete);

  return (
    <div className="pairs-box">
      <h3>Hidden pairs</h3>
      {!drawn ? (
        <>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn heather" onClick={() => setDrawing(true)} disabled={out.length > 0}
              title={out.length ? 'Every card must be complete first' : undefined}>
              Draw the pairs
            </button>
          </div>
          {out.length > 0 && (
            <p className="small muted" style={{ marginTop: 8 }}>Drawn once the round is complete.</p>
          )}
          {drawing && <PairDrawSheet r={r} onClose={() => setDrawing(false)} />}
        </>
      ) : (
        <>
          <PairList rid={r.id} />
          <div className="btn-row"><button className="btn ghost sm" onClick={redraw}>Redraw</button></div>
        </>
      )}
    </div>
  );
}

// The draw ceremony, in the spirit of the old group draw: pairs are decided
// after the round, so nothing needs hiding — one press pulls one name out of
// the hat, flickering through whoever's still in it before it lands. A pair's
// total appears the moment its second name drops. Sealing shares it to every
// phone; cancelling shows nobody anything.
const SPIN_MS = 1400;   // per name, before it locks
const TICK0 = 60;       // flicker interval at full speed

function PairDrawSheet({ r, onClose }: { r: Round; onClose: () => void }) {
  const { S } = useStore();
  const [slots] = useState(() => shuffle(PLAYERS.map((p) => p.id)));  // draw order, pairs of two
  const [locked, setLocked] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [flick, setFlick] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // One press, one name: flicker through the names still in the hat, slowing
  // until the next one lands.
  const drawNext = () => {
    if (spinning || locked >= slots.length) return;
    setSpinning(true);
    const pool = slots.slice(locked);
    let i = 0, elapsed = 0;
    const tick = () => {
      const speed = TICK0 + Math.pow(elapsed / SPIN_MS, 2) * 240;
      setFlick(first(pool[i++ % pool.length]));
      elapsed += speed;
      if (elapsed < SPIN_MS) timer.current = setTimeout(tick, speed);
      else timer.current = setTimeout(() => { setFlick(''); setSpinning(false); setLocked((n) => n + 1); }, 150);
    };
    tick();
  };

  const done = locked >= slots.length;
  const seal = () => {
    const pairs: string[][] = [];
    for (let i = 0; i < slots.length; i += 2) pairs.push([slots[i], slots[i + 1]]);
    setPairDraw(r.id, { pairs, revealed: true });
    toast('Pairs drawn — on every phone now');
    onClose();
  };

  const seg = (k: number) => {
    if (k < locked) return <>{first(slots[k])}</>;
    if (k === locked && spinning) return <i className="flick">{flick || '…'}</i>;
    return <i className="tbd">?</i>;
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>The draw</h2>
        <p className="small muted">Straight out of the hat, one name at a time. Nobody else sees a thing until you seal it.</p>
        <div className="pair-list">
          {Array.from({ length: slots.length / 2 }, (_, k) => {
            const a = 2 * k, b = 2 * k + 1;
            const complete = b < locked;
            const active = spinning && (a === locked || b === locked);
            const ts = complete ? [slots[a], slots[b]].map((pid) => playerTally(S, r.id, pid)) : [];
            return (
              <div className={`pair-item${complete ? '' : active ? ' spin' : ' sealed'}`} key={k}>
                <div className="pair-names">
                  <span className="rank">{k + 1}</span>
                  <span className="names">{seg(a)}<span>&amp;</span>{seg(b)}</span>
                </div>
                {complete && (
                  <span className="pts">
                    {ts.reduce((x, t) => x + t.pts, 0)}
                    <small>{ts.every((t) => t.complete) ? 'pts' : 'so far'}</small>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          {done
            ? <>
                <button className="btn heather grow" onClick={seal}>Seal it — show everyone</button>
                <button className="btn ghost" onClick={onClose}>Discard</button>
              </>
            : <>
                <button className="btn heather grow" onClick={drawNext} disabled={spinning}>
                  {spinning ? 'Out of the hat…' : locked === 0 ? 'Draw the first name' : 'Draw the next name'}
                </button>
                <button className="btn ghost" onClick={onClose}>Cancel</button>
              </>}
        </div>
      </div>
    </div>
  );
}

export function PairList({ rid }: { rid: string }) {
  const { S } = useStore();
  return (
    <div className="pair-list">
      {pairTotals(S, rid).map((row, k) => (
        <div className="pair-item" key={k}>
          <div className="pair-names">
            <span className="rank">{row.place ?? k + 1}{row.tied ? '=' : ''}</span>
            <span className="names">{first(row.pair[0])}<span>&amp;</span>{first(row.pair[1])}</span>
          </div>
          <span className="pts">{row.total}<small>{row.complete ? `pts · +${trim(row.points ?? 0)} wk each` : 'so far'}</small></span>
        </div>
      ))}
    </div>
  );
}

export function ScrambleResult({ r }: { r: Round }) {
  const { S } = useStore();
  const res = scrambleResults(S, r.id);
  return (
    <div className="scramble-box">
      <h3>Result</h3>
      <div className="team-grid">
        {groupsFor(S, r.id).map((grp, t) => {
          const tt = res.ts[t];
          const won = res.decided && res.winner === t;
          return (
            <div className={`team${won ? ' won' : ''}`} key={t}>
              <TeamAvatar players={grp.players} />
              <h4>{grp.name || 'Team ' + (t + 1)} {won && <span className="chip gorse">Winners</span>}</h4>
              <div className="big">{tt.pts}<small>pts thru {tt.played}</small></div>
              <div className="members">{grp.players.map((pid) => <div className="m" key={pid}>{pName(pid)}</div>)}</div>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Team handicap is {RULES.scrambleAllowance.join('/')}% of the two course handicaps, lowest first.
        Week points {RULES.scramblePoints.join(' · ')} each for 1st–4th{res.decided && res.winner === null ? ' — top spot tied, so shared' : ' (ties share)'}.
      </p>
    </div>
  );
}

// Live leaderboard for one round: every player across every group, ranked by
// stableford points as scores land (teams on scramble day). Nothing to poll —
// it re-renders off the store, which realtime sync keeps current.
export function Leaderboard({ r }: { r: Round }) {
  const { S, me } = useStore();
  const scramble = r.format === 'scramble';

  const teams = scramble
    ? groupsFor(S, r.id)
        .map((grp, t) => ({ key: String(t), t, grp, tally: teamTally(S, r.id, t) }))
        .filter((x) => x.tally.played > 0)
        .sort((a, b) => b.tally.pts - a.tally.pts)
        .map((x, k, all) => {
          const tiedUp = k > 0 && x.tally.pts === all[k - 1].tally.pts;
          const tiedDown = k + 1 < all.length && x.tally.pts === all[k + 1].tally.pts;
          const place = tiedUp ? all.findIndex((y) => y.tally.pts === x.tally.pts) + 1 : k + 1;
          return { ...x, place, tied: tiedUp || tiedDown };
        })
    : [];
  const rows = scramble ? teams : stablefordResults(S, r.id).map((x) => ({ key: x.pid, ...x }));

  if (!rows.length) return null;

  // Week points land once the round's complete: place points for the
  // individual, plus the hidden-pair share where there is one. Shown as the
  // split as well as the total, so nobody has to work out where a 16 came from.
  const done = roundStatus(S, r.id) === 'done';
  const pairsDrawn = !!S.pairs[r.id]?.revealed;
  const scr = scramble ? scrambleResults(S, r.id) : null;

  return (
    <>
      <div className="section-title"><h2>Leaderboard</h2><span className="eyebrow">{done ? 'final' : 'live'} · tap for a card</span></div>
      <div className="rlb">
        {rows.map((x) => {
          const t = 'tally' in x ? x.tally : x;
          const place = `${x.place}${x.tied ? '=' : ''}`;
          const placeOrd = `${x.place}${['st', 'nd', 'rd'][x.place! - 1] || 'th'}${x.tied ? '=' : ''}`;
          const mine = 'pid' in x ? x.pid === me : ('grp' in x && !!me && x.grp.players.includes(me));
          let wk: number | null = null, split = '';
          if ('pid' in x && done) {
            const ind = x.points ?? 0, pair = pairPointsFor(S, r.id, x.pid);
            wk = ind + pair;
            split = `${trim(ind)} for ${placeOrd}` + (r.pairs ? (pairsDrawn ? ` + ${trim(pair)} pair` : ' · pairs still to draw') : '');
          } else if ('grp' in x && scr?.decided) {
            const o = scr.rows[x.grp.players[0]];
            if (o) { wk = o.points; split = `${trim(o.points)} each for ${placeOrd}`; }
          }
          // Each row opens that player's card for the round; a team row opens
          // the team's card (the same for either member).
          const to = `/player/${'pid' in x ? x.pid : x.grp.players[0]}/round/${r.id}`;
          return (
            <Link className={`rlb-row${mine ? ' me' : ''}`} to={to} key={x.key}>
              <span className="rlb-place">{place}</span>
              {'pid' in x
                ? <Avatar p={PL(x.pid)} size="sm" />
                : <TeamAvatar players={x.grp.players} size="sm" />}
              <div className="rlb-who">
                <b>{'pid' in x ? first(x.pid) : gname(x.grp, x.t)}</b>
                <small>
                  {'pid' in x ? `PH ${phFor(S, x.pid, r.id)}` : x.grp.players.map(first).join(' · ')}
                  {t.complete ? ` · ${t.strokes}${t.pickups ? '+' : ''} strokes` : ` · thru ${t.played}`}
                </small>
                {wk !== null && <small className="wk">Week pts: {split}</small>}
              </div>
              <span className="rlb-pts">{t.pts}<small>pts</small></span>
              <span className="rlb-wk">{wk !== null && <>{trim(wk)}<small>wk</small></>}</span>
              <svg className="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          );
        })}
      </div>
      {done && !scramble && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Week points {RULES.placePoints.join(' · ')} for 1st–{ord(RULES.placePoints.length)} (ties share, after countback){r.pairs ? <>, plus {RULES.pairPoints.join(' · ')} each for the hidden pairs</> : null}.
        </p>
      )}
    </>
  );
}

// A gross score marked the way a scorecard is: circles under par, squares
// over, nothing for par. Solid fills — red circle for a birdie, gold for an
// eagle or better, black square for a bogey, blue for a double or worse.
// A pickup (0) shows as ✕ with no mark; empty holes as a dot.
// bonus wraps the mark in a fixed brass box — the bonus-ball hole — the same
// size for everyone, whatever width their column happens to be.
export function Gross({ gross, par, bonus = false }: { gross: number | null; par: number; bonus?: boolean }) {
  let mark;
  if (gross === null) mark = <span className="gs e">·</span>;
  else if (gross === 0) mark = <span className="gs x">✕</span>;
  else {
    const d = gross - par;
    const cls = d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
    mark = <span className={`gs ${cls}`}>{gross}</span>;
  }
  return bonus ? <span className="bbx" title="Bonus ball · double points">{mark}</span> : mark;
}

export function GrossLegend() {
  return (
    <p className="small muted gs-legend">
      <span className="lg"><span className="gs eagle">3</span> eagle</span>
      <span className="lg"><span className="gs birdie">3</span> birdie</span>
      <span className="lg"><span className="gs par">4</span> par</span>
      <span className="lg"><span className="gs bogey">5</span> bogey</span>
      <span className="lg"><span className="gs double">6</span> double+</span>
      {RULES.bonusBalls && <span className="lg"><span className="bbx sw"><span className="gs par">4</span></span> bonus ball</span>}
      <span className="lg"><b>48+</b> a pickup in there</span>
    </p>
  );
}

// Live scorecard: gross + stableford points per hole for the selected group (or teams).
export function LiveScorecard({ r, group, selHole, onHole, myPh = null }: { r: Round; group: number; selHole?: number; onHole?: (n: number) => void; myPh?: number | null }) {
  const { S } = useStore();
  const scramble = r.format === 'scramble';
  const groups = groupsFor(S, r.id);
  const g = groups[group] || groups[0];
  // Team columns are headed by the two names, one above the other — a
  // letter alone means nothing at a glance.
  const cols: { label: ReactNode; tally: Tally }[] = scramble
    ? groups.map((grp, t) => ({ label: <>{first(grp.players[0])}<br />{first(grp.players[1])}</>, tally: teamTally(S, r.id, t) }))
    : g.players.map((pid) => ({ label: first(pid), tally: playerTally(S, r.id, pid) }));

  const cell = (row: Tally['rows'][number], key: number) =>
    row.gross === null
      ? <td className="e" key={key}>·</td>
      : <td key={key} className={`${row.pts === 0 ? 'z' : (row.pts ?? 0) >= 3 ? 'g' : ''}${row.bonus ? ' bb' : ''}`}><Gross gross={row.gross} par={row.par} bonus={row.bonus} /><sup>{row.pts}</sup></td>;

  const sumRow = (label: string, from: number, to: number) => (
    <tr className="sum" key={label}>
      <td>{label}</td>
      <td>{r.holes.slice(from, to).reduce((a, x) => a + x.par, 0)}</td>
      <td />
      {cols.map((c, k) => {
        const pl = c.tally.rows.slice(from, to).filter((x) => x.gross !== null);
        const plus = pl.some((x) => x.gross === 0) ? '+' : '';   // a pickup in there: strokes are a floor
        return <td key={k}>{pl.length ? <>{pl.reduce((a, x) => a + (x.gross ?? 0), 0)}{plus}<sup>{pl.reduce((a, x) => a + (x.pts ?? 0), 0)}</sup></> : '·'}</td>;
      })}
    </tr>
  );

  return (
    <>
      <div className="section-title"><h2>Scorecard</h2><span className="eyebrow">{scramble ? 'team gross · points' : ONE_GROUP ? 'gross · points' : gname(g, group) + ' · gross · points'}</span></div>
      <div className="sc-wrap">
        <table className="sc">
          <thead>
            <tr>
              <th>Hole</th><th>Par</th><th>SI</th>
              {cols.map((c, k) => (
                <th key={k}>{c.label}{!scramble && <span className="ph">PH {phFor(S, g.players[k], r.id)}</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.holes.flatMap((hh, i) => {
              const shots = myPh !== null ? Math.max(0, shotsOn(myPh, hh.si, r.holes.length)) : 0;
              const tr = (
                <tr key={hh.n} className={hh.n === selHole ? 'cur' : ''} onClick={onHole ? () => onHole(hh.n) : undefined} style={onHole ? { cursor: 'pointer' } : undefined}>
                  <td>{hh.n}</td><td>{hh.par}</td><td>{shots ? <span className={`si-pill s${Math.min(shots, 2)}`}>{hh.si}</span> : hh.si}</td>
                  {cols.map((c, k) => cell(c.tally.rows[i], k))}
                </tr>
              );
              return splits(r) && i === half(r) - 1 ? [tr, sumRow('Out', 0, half(r))] : [tr];
            })}
            {splits(r) && sumRow('In', half(r), r.holes.length)}
            {sumRow('Total', 0, r.holes.length)}
          </tbody>
        </table>
      </div>
      <GrossLegend />
      {myPh !== null && myPh > r.holes.length && (
        <p className="small muted si-legend">
          <span className="lg"><span className="si-pill s1">SI</span> one shot</span>
          <span className="lg"><span className="si-pill s2">SI</span> two shots</span>
        </p>
      )}
    </>
  );
}

export function RoundHead({ r, status }: { r: Round; status: 'done' | 'partial' | 'none' }) {
  return (
    <div className="round-head">
      <span className="eyebrow">Round {r.n} · {r.dow} {r.dnum} {r.mon} · {r.town}</span>
      <h2>{r.club}</h2>
      <div className="itin-meta">
        <span className="chip">Par {r.par}</span>
        <FormatChips r={r} />
        <span className="chip ghost">{status === 'done' ? 'Round complete' : status === 'partial' ? 'In progress' : 'Not started'}</span>
      </div>
    </div>
  );
}

export function useRound(rid: string | undefined): Round | undefined {
  return rid ? R(rid) : undefined;
}
