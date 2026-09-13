// One player's card for one round: their gross and points hole by hole, with
// the bonus ball and any side bets (cuckoos, camels, fish, three-putts, lost
// balls) marked on the holes they happened. On scramble day it's the team's
// card, with the player's own bits from the flight log.
import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BITS, PL, R, RULES, first, gname, ord } from '../data/trip';
import { BIT_KINDS } from '../lib/state';
import {
  bitsOf, bonusGoneBy, bonusHoleFor, courseHandicap, flightName, flightsFor, fmt1, fmtMoney, groupBitTally, groupsFor, groupsSet, half,
  indexBefore, indexHistory, pairTotals, phFor, playerTally, roundStatus, scrambleResults, stablefordResults, teamHandicap,
  teamTally, trim, type Tally,
} from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { Avatar, TeamAvatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { FormatChips, Gross, GrossLegend } from '../components/RoundBits';

export function PlayerRoundPage() {
  const { pid, rid } = useParams();
  const { S } = useStore();
  const p = pid ? PL(pid) : undefined;
  const r = rid ? R(rid) : undefined;
  if (!p || !pid) return <Navigate to="/players" replace />;
  if (!r) return <Navigate to={`/player/${pid}`} replace />;

  const scramble = r.format === 'scramble';
  const status = roundStatus(S, r.id);
  const groups = groupsFor(S, r.id);
  const drawn = groupsSet(S, r.id);
  const t = groups.findIndex((g) => g.players.includes(pid));
  const grp = groups[t];
  // On scramble day this is the team's page: both members throughout.
  const members = scramble && grp ? grp.players : [pid];
  // Bits are logged per tee group — per flight on scramble day.
  const bitGroup = scramble ? flightsFor(S, r.id).findIndex((f) => f.players.includes(pid)) : t;
  const bitTitle = bitGroup < 0 ? '' : scramble ? flightName(S, r.id, bitGroup) : gname(grp, t);

  const { before, after, applied } = indexHistory(S, pid).find((h) => h.round.id === r.id)!;
  const ch = courseHandicap(S, before, r.id);
  const ph = scramble ? null : phFor(S, pid, r.id);
  const tally: Tally = scramble ? teamTally(S, r.id, Math.max(0, t)) : playerTally(S, r.id, pid);

  // Bonus ball, individual rounds only: the hole it doubled, or where it went.
  const showBonus = RULES.bonusBalls && !scramble;
  const bb = S.bonus[pid];
  const bonusHole = showBonus ? bonusHoleFor(S, r.id, pid) : null;
  const lostHere = showBonus && bb?.lost === r.id ? bb.used[r.id] ?? null : null;
  const goneBefore = showBonus && bonusGoneBy(S, r.id, pid);
  const bonusText = !showBonus ? null
    : goneBefore ? `Lost at ${R(bb!.lost!)?.short ?? '?'} · no 2× here`
    : lostHere !== null ? `Lost on the ${ord(lostHere + 1)} · 2× void`
    : bonusHole !== null ? bb?.used[r.id] === undefined ? 'Not called, so 2× on the 18th' : `2× on the ${ord(bonusHole + 1)}`
    : status === 'done' ? 'Not played' : 'Still to play';

  // Bits on each hole for one member, and round totals per kind for all of them.
  const bitsOn = (i: number, who: string) => (RULES.sideBets ? BIT_KINDS : [])
    .map((k) => ({ k, n: bitGroup < 0 ? 0 : bitsOf(S, r.id, bitGroup, k)[i]?.counts[who] || 0 }))
    .filter((x) => x.n > 0);
  const bitTotals = (RULES.sideBets ? BIT_KINDS : []).map((k) => {
    const by = members.map((who) => ({ who, n: Array.from({ length: r.holes.length }, (_, i) => bitsOn(i, who).find((x) => x.k === k)?.n || 0).reduce((a, b) => a + b, 0) }));
    const grpT = bitGroup < 0 ? null : groupBitTally(S, r.id, bitGroup, k);
    const last = grpT && grpT.total > 0 && grpT.last && members.includes(grpT.last) ? grpT.last : null;
    return { k, by, n: by.reduce((a, x) => a + x.n, 0), last, owes: grpT ? grpT.total * S.stakes[k] : 0 };
  });

  // Result lines: place and week points once the round's decided.
  const res = scramble ? null : stablefordResults(S, r.id).find((x) => x.pid === pid);
  const scr = scramble ? scrambleResults(S, r.id) : null;
  const mine = scr?.rows[pid];
  const pair = r.pairs ? pairTotals(S, r.id).find((row) => row.pair.includes(pid)) : undefined;
  // The Extras column and section only exist for trips that play something extra.
  const extrasOn = RULES.sideBets || showBonus;

  const extras = (i: number) => {
    const out: ReactNode[] = [];
    if (bonusHole === i) out.push(<span className="xb bonus" key="bb" title="Bonus ball · double points">🎱 2×</span>);
    if (lostHere === i) out.push(<span className="xb lost" key="bl" title="Bonus ball lost">🎱 ✕</span>);
    for (const who of members)
      for (const { k, n } of bitsOn(i, who))
        out.push(<span className="xb" key={who + k} title={BITS[k].one}>{BITS[k].icon}{n > 1 ? `×${n}` : ''}{scramble && <small> {first(who)}</small>}</span>);
    return out;
  };

  const sumRow = (label: string, from: number, to: number) => {
    const pl = tally.rows.slice(from, to).filter((x) => x.gross !== null);
    const plus = pl.some((x) => x.gross === 0) ? '+' : '';   // a pickup in there: strokes are a floor
    return (
      <tr className="sum" key={label}>
        <td>{label}</td>
        <td>{r.holes.slice(from, to).reduce((a, x) => a + x.par, 0)}</td>
        <td />
        <td>{pl.length ? <>{pl.reduce((a, x) => a + (x.gross ?? 0), 0)}{plus}</> : '·'}</td>
        <td>{pl.length ? pl.reduce((a, x) => a + (x.pts ?? 0), 0) : '·'}</td>
        {extrasOn && <td />}
      </tr>
    );
  };

  return (
    <>
      <BackButton to={`/player/${pid}`} label={first(pid)} />
      <div className="player-head pr">
        {scramble && grp ? <TeamAvatar players={grp.players} size="lg" /> : <Avatar p={p} />}
        <div>
          <span className="eyebrow">Round {r.n} · {r.dow} {r.dnum} {r.mon}{scramble ? ` · ${r.club}` : ''}</span>
          <h1>{scramble && grp ? gname(grp, t) : r.club}</h1>
          <div className="sub">
            {scramble && grp
              ? <>{grp.players.map((x) => PL(x).name).join(' & ')}{drawn ? <> · {grp.tee}</> : <> · teams to be set</>}</>
              : <>{p.name}{drawn && grp ? <> · {gname(grp, t)} · {grp.tee}</> : null}</>}
          </div>
        </div>
      </div>
      <div className="itin-meta" style={{ marginTop: 8 }}>
        <FormatChips r={r} />
        <span className="chip ghost">{status === 'done' ? 'Round complete' : status === 'partial' ? 'In progress' : 'Not started'}</span>
      </div>

      <div className="course-facts card">
        <div className="cf"><span className="l">{scramble ? 'Team pts' : 'Points'}</span><b>{tally.played ? <>{tally.pts}{tally.complete ? '' : <small className="muted"> thru {tally.played}</small>}</> : '–'}</b></div>
        <div className="cf"><span className="l">Strokes</span><b>{tally.complete ? `${tally.strokes}${tally.pickups ? '+' : ''}` : '–'}</b></div>
        <div className="cf"><span className="l">Place</span><b>{
          scramble
            ? mine ? `${ord(mine.place)}${mine.tie ? '=' : ''}` : '–'
            : status === 'done' && res?.place ? `${ord(res.place)}${res.tied ? '=' : ''}` : '–'
        }</b></div>
        <div className="cf"><span className="l">Week pts</span>{
          scramble
            ? <b>{mine ? trim(mine.points) : '–'}</b>
            : status === 'done' && res?.points !== undefined
              ? <><b>{trim(res.points + (pair?.points ?? 0))}</b><span className="s">{trim(res.points)} for {ord(res.place!)}{res.tied ? '=' : ''}{r.pairs ? (pair ? ` + ${trim(pair.points ?? 0)} pair` : ' · pairs to draw') : ''}</span></>
              : <b>–</b>
        }</div>
      </div>

      {scramble ? (
        <div className="course-facts card">
          <div className="cf"><span className="l">Team hcp</span><b>{drawn && t >= 0 ? teamHandicap(S, r.id, t) : '–'}</b></div>
          {members.map((who) => (
            <div className="cf" key={who}><span className="l">{first(who)} · course hcp</span><b>{courseHandicap(S, indexBefore(S, who, r.id), r.id)}</b></div>
          ))}
        </div>
      ) : (
        <div className="course-facts card">
          <div className="cf"><span className="l">Index in</span><b>{fmt1(before)}</b></div>
          <div className="cf"><span className="l">Course hcp</span><b>{ch}</b></div>
          <div className="cf"><span className="l">Playing hcp</span><b>{ph}</b></div>
          <div className="cf"><span className="l">Index out</span><b>{applied ? <>{fmt1(after)} <span className={`delta ${after < before ? 'down' : after > before ? 'up' : 'flat'}`}>{after === before ? '' : (after < before ? '−' : '+') + fmt1(Math.abs(after - before))}</span></> : '–'}</b></div>
        </div>
      )}

      {pair && (
        <p className="small muted" style={{ margin: '2px 0 4px' }}>
          Hidden pair with <b>{first(pair.pair.find((x) => x !== pid)!)}</b> · {pair.total} pts{pair.complete && pair.place ? ` · ${ord(pair.place)}${pair.tied ? '=' : ''} · +${trim(pair.points ?? 0)} week pts each` : ' so far'}
        </p>
      )}

      <div className="section-title">
        <h2>Scorecard</h2>
        <span className="eyebrow">{scramble ? `team gross · points` : `gross · points · shots off PH ${ph}`}</span>
      </div>
      <div className="sc-wrap">
        <table className="sc player-sc">
          <thead>
            <tr><th>Hole</th><th>Par</th><th>SI</th><th>{scramble ? 'Team' : 'Gross'}</th><th>Pts</th>{extrasOn && <th className="x">Extras</th>}</tr>
          </thead>
          <tbody>
            {r.holes.flatMap((h, i) => {
              const row = tally.rows[i];
              const shots = Math.max(0, row.shots);
              const tr = (
                <tr key={h.n}>
                  <td>{h.n}</td><td>{h.par}</td>
                  <td>{shots ? <span className={`si-pill s${Math.min(shots, 2)}`}>{h.si}</span> : h.si}</td>
                  {row.gross === null
                    ? <><td className="e">·</td><td className="e">·</td></>
                    : <>
                        <td className={row.bonus ? 'bb' : ''}><Gross gross={row.gross} par={h.par} bonus={row.bonus} /></td>
                        <td className={row.pts === 0 ? 'z' : (row.pts ?? 0) >= 3 ? 'g' : ''}>{row.pts}</td>
                      </>}
                  {extrasOn && <td className="x">{extras(i)}</td>}
                </tr>
              );
              return i === half(r) - 1 ? [tr, sumRow('Out', 0, half(r))] : [tr];
            })}
            {sumRow('In', half(r), r.holes.length)}
            {sumRow('Total', 0, r.holes.length)}
          </tbody>
        </table>
      </div>
      <GrossLegend />
      {ph !== null && ph > r.holes.length && (
        <p className="small muted si-legend">
          <span className="lg"><span className="si-pill s1">SI</span> one shot</span>
          <span className="lg"><span className="si-pill s2">SI</span> two shots</span>
        </p>
      )}

      {extrasOn && <>
      <div className="section-title"><h2>Extras</h2><span className="eyebrow">{[bitTitle, showBonus && 'bonus ball', RULES.sideBets && 'side bets'].filter(Boolean).join(' · ')}</span></div>
      <div className="card xlist">
        {showBonus && (
          <div className="xrow">
            <span className="bit-ic" aria-hidden>🎱</span>
            <span className="bit-l"><b>Bonus ball</b><small>2× one hole a round · +{RULES.bonusKeep} if kept all week</small></span>
            <span className="bit-sum wrap">{bonusText}</span>
          </div>
        )}
        {bitTotals.map(({ k, by, n, last, owes }) => (
          <div className="xrow" key={k}>
            <span className="bit-ic" aria-hidden>{BITS[k].icon}</span>
            <span className="bit-l"><b>{BITS[k].label}</b><small>{scramble ? by.map((x) => `${first(x.who)} ${x.n || '–'}`).join(' · ') : BITS[k].desc}</small></span>
            <span className="bit-sum wrap">{last ? <>{scramble ? first(last) + ' had' : 'Had'} the last one · puts in <b>{fmtMoney(owes)}</b></> : ''}</span>
            <span className={`bit-n${n ? '' : ' off'}`}>{n || '–'}</span>
          </div>
        ))}
      </div>
      </>}

      <div className="btn-row" style={{ margin: '14px 0 4px' }}>
        <Link className="btn ghost grow" to={`/round/${r.id}`}>Course, groups &amp; leaderboard</Link>
        {drawn && <Link className="btn primary" to={`/round/${r.id}/score`}>Scores</Link>}
      </div>
    </>
  );
}
