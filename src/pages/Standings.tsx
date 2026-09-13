import { Link } from 'react-router-dom';
import { ROUNDS, RULES, dayLabel, first, ord, pName, PL } from '../data/trip';
import {
  currentIndex, fmt1, playerTally, roundPlace, roundPoints, roundStatus,
  scrambleResults, signed, standings, trim,
} from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { Avatar } from '../components/Avatar';

export function StandingsPage() {
  const { S, me } = useStore();
  const st = standings(S);
  const anyPts = st.some((r) => r.pts > 0);
  const doneCount = ROUNDS.filter((r) => roundStatus(S, r.id) === 'done').length;

  return (
    <>
      <div className="section-title"><h2>Standings</h2><span className="eyebrow">{doneCount} of {ROUNDS.length} rounds in · tap a name</span></div>
      {!anyPts && <div className="empty">No results yet. Once a round's scores are in, week points appear here.</div>}
      <div className="lb">
        {st.map((row) => {
          const p = PL(row.pid);
          const cur = currentIndex(S, row.pid);
          const d = cur - p.start;
          return (
            <Link className="lb-row" to={`/player/${row.pid}`} key={row.pid}>
              <Avatar p={p} badge={<em className={row.rank === 1 && anyPts ? 'lead' : ''}>{row.rank}</em>} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{pName(row.pid)}{row.pid === me && <> <span className="chip you">you</span></>}</div>
                <div className="meta">
                  <span className="dots">
                    {ROUNDS.map((rd) => {
                      if (rd.format === 'scramble') {
                        const sr = scrambleResults(S, rd.id).rows[row.pid];
                        return <i key={rd.id} className={sr ? 'p' + Math.min(sr.place, 4) : ''} title={`Round ${rd.n}`}>{sr?.place ?? ''}</i>;
                      }
                      const pl = roundPlace(S, rd.id, row.pid);
                      return <i key={rd.id} className={pl ? 'p' + Math.min(pl, 4) : ''} title={`Round ${rd.n}`}>{pl ?? ''}</i>;
                    })}
                  </span>
                  <span className="idx-cell">
                    <span className="v">index {fmt1(cur)} <small className={d < 0 ? 'delta down' : d > 0 ? 'delta up' : ''}>{d !== 0 ? signed(d) : ''}</small></span>
                  </span>
                </div>
              </div>
              <div className="pts">{trim(row.pts)}<small>pts</small></div>
              <svg className="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          );
        })}
      </div>

      <div className="section-title"><h2>Round by round</h2><span className="eyebrow">week pts in brass</span></div>
      <div className="card table-wrap">
        <table className="rounds-table">
          <thead>
            <tr><th>Player</th>{ROUNDS.map((r) => <th key={r.id} title={r.club}>{dayLabel(r)}</th>)}<th>Total</th></tr>
          </thead>
          <tbody>
            {st.map((row) => (
              <tr key={row.pid}>
                <td><Link to={`/player/${row.pid}`} title={pName(row.pid)}>{first(row.pid)}</Link></td>
                {ROUNDS.map((rd) => {
                  // Every cell opens that player's card for the round, scored or not.
                  const card = `/player/${row.pid}/round/${rd.id}`;
                  if (rd.format === 'scramble') {
                    const sr = scrambleResults(S, rd.id).rows[row.pid];
                    return <td key={rd.id}><Link to={card}>{sr ? <><span className={sr.won ? 'win' : ''}>{ord(sr.place)}{sr.tie ? '=' : ''}</span><span className="pt">{trim(sr.points)}</span></> : '·'}</Link></td>;
                  }
                  const t = playerTally(S, rd.id, row.pid);
                  const rp = roundPoints(S, rd.id, row.pid);
                  return <td key={rd.id}><Link to={card}>{t.played === 0 ? '·' : <>{t.pts}{t.complete ? '' : '*'}<span className="pt">{rp === null ? '' : trim(rp)}</span></>}</Link></td>;
                })}
                <td className="tot"><b>{trim(row.pts)}</b>{row.bonusKept > 0 && <span className="pt">🎱</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>* round in progress{RULES.bonusBalls && <> · 🎱 bonus ball kept all trip: +{RULES.bonusKeep} in the total, added once the last round is in</>}</p>
    </>
  );
}
