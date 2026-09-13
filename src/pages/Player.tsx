// One player's page: their indexes, and how their week is going round by round.
import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BITS, PL, R, RULES, dayLabel, gname, ord } from '../data/trip';
import { BIT_KINDS } from '../lib/state';
import {
  courseHandicap, fmt1, groupsFor, indexHistory, pairPointsFor, playerBitTotal, playerTally, roundPlace,
  roundPoints, roundStatus, scrambleResults, signed, standings, teamHandicap, trim,
} from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';

export function PlayerPage() {
  const { pid } = useParams();
  const { S, me } = useStore();
  const p = pid ? PL(pid) : undefined;
  if (!p || !pid) return <Navigate to="/players" replace />;

  const hist = indexHistory(S, pid);
  const cur = hist[hist.length - 1].after;
  const d = cur - p.start;
  const st = standings(S).find((row) => row.pid === pid)!;

  return (
    <>
      <BackButton to="/players" label="Players" />
      <div className="player-head">
        <Avatar p={p} />
        <div>
          <h1>{p.name}</h1>
          <div className="sub">
            started on {fmt1(p.start)} · now {fmt1(cur)} <span className={`delta ${d < 0 ? 'down' : d > 0 ? 'up' : 'flat'}`}>{signed(d)}</span>
          </div>
        </div>
      </div>

      <div className="course-facts card">
        <div className="cf"><span className="l">Week pts</span><b>{trim(st.pts)}</b></div>
        <div className="cf"><span className="l">Position</span><b>{st.played ? ord(st.rank) : '–'}</b></div>
        <div className="cf"><span className="l">Stableford</span><b>{st.stab}</b></div>
        <div className="cf"><span className="l">Index</span><b>{fmt1(cur)}</b></div>
      </div>

      {(RULES.sideBets || RULES.bonusBalls) && <div className="course-facts facts-grid card">
        {RULES.sideBets && BIT_KINDS.map((k) => (
          <div className="cf" key={k}>
            <span className="l">{BITS[k].label}</span>
            <b><span aria-hidden>{BITS[k].icon}</span> {playerBitTotal(S, pid, k)}</b>
          </div>
        ))}
        {RULES.bonusBalls && <div className="cf">
          <span className="l">Bonus ball</span>
          <b><span aria-hidden>🎱</span> {S.bonus[pid]?.lost ? `Lost at ${R(S.bonus[pid].lost!)?.short ?? '?'}` : st.bonusKept ? `Kept · +${RULES.bonusKeep}` : 'In play'}</b>
        </div>}
      </div>}

      <div className="section-title"><h2>The week</h2><span className="eyebrow">tap a round for the card</span></div>
      <div className="pweek">
        {hist.map(({ round: r, before, after, applied }) => {
          const groups = groupsFor(S, r.id);
          const drawn = !!S.groups[r.id];
          const grp = groups.find((g) => g.players.includes(pid));
          const t = groups.indexOf(grp!);
          const status = roundStatus(S, r.id);
          const line: ReactNode[] = [];
          if (r.format === 'scramble') {
            const res = scrambleResults(S, r.id);
            const mine = res.rows[pid];
            const tt = res.ts[t];
            if (drawn) line.push(<span key="t">{gname(grp!, t)} · Team HCP {teamHandicap(S, r.id, t)}</span>);
            else line.push(<span key="t">Teams to be set</span>);
            if (tt.played > 0) line.push(<span key="s"> · {tt.pts} pts{tt.complete ? '' : ` thru ${tt.played}`}</span>);
            if (mine) line.push(<b key="r"> · {ord(mine.place)}{mine.tie ? '=' : ''} · {trim(mine.points)} week pts</b>);
          } else {
            const tl = playerTally(S, r.id, pid);
            line.push(<span key="h">CH {courseHandicap(S, before, r.id)}</span>);
            if (tl.played > 0) {
              line.push(<span key="s"> · <b>{tl.pts} pts</b>{tl.complete ? ` · ${tl.strokes}${tl.pickups ? '+' : ''} strokes` : ` thru ${tl.played}`}</span>);
              const pl = roundPlace(S, r.id, pid), wp = roundPoints(S, r.id, pid);
              if (status === 'done' && pl) {
                const pair = pairPointsFor(S, r.id, pid), ind = (wp ?? 0) - pair;
                const split = r.pairs ? (S.pairs[r.id]?.revealed ? ` (${trim(ind)} + ${trim(pair)} pair)` : ' · pairs to draw') : '';
                line.push(<span key="p"> · {ord(pl)} · <b>{trim(wp ?? 0)} week pts</b>{split}</span>);
              }
            }
            if (applied) line.push(<span key="i" className={`delta ${after < before ? 'down' : after > before ? 'up' : 'flat'}`}> · Index {fmt1(before)} → {fmt1(after)}</span>);
          }
          return (
            <Link className="pweek-row" to={`/player/${pid}/round/${r.id}`} key={r.id}>
              <div className="itin-date">
                <span className="n">{r.dnum}</span>
                <span className="m">{dayLabel(r)}</span>
                <span className={`st ${status}`} />
              </div>
              <div className="pw-body">
                <h3>{r.short}</h3>
                <div className="pw-sub">{drawn && grp ? <><b className="tee">{grp.tee}</b> · </> : null}{line}</div>
              </div>
              <svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          );
        })}
      </div>
      {pid === me && <p className="small muted" style={{ marginTop: 12 }}>This is you — your group is highlighted on each round page.</p>}
    </>
  );
}
