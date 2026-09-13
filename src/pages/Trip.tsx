import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ONE_GROUP, ROUNDS, TRIP, dayLabel, first, gname, holesLabel } from '../data/trip';
import { groupsFor, groupsSet, roundStatus } from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { FormatChips } from '../components/RoundBits';

function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.floor((TRIP.firstTee.getTime() - now) / 1000);
  if (secs < 0) return null;   // trip's underway — the rounds list takes over
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
    m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const cell = (v: number, l: string) => (
    <div className="cd-cell" key={l}><span className="v">{v}</span><span className="l">{l}</span></div>
  );
  return (
    <div className="countdown">
      <div className="cd-row">
        {d > 0 && cell(d, d === 1 ? 'day' : 'days')}
        {cell(h, h === 1 ? 'hour' : 'hours')}
        {cell(m, m === 1 ? 'min' : 'mins')}
        {cell(s, 'secs')}
      </div>
    </div>
  );
}

export function TripPage() {
  const { S } = useStore();
  return (
    <>
      <Countdown />
      <div className="section-title"><h2>Rounds</h2><span className="eyebrow">tap a round for details</span></div>
      <div className="itin">
        {ROUNDS.map((r) => (
          <Link className="itin-day" to={`/round/${r.id}`} key={r.id}>
            <div className="itin-date">
              <span className="n">{r.dnum}</span>
              <span className="m">{dayLabel(r)}</span>
              <span className={`st ${roundStatus(S, r.id)}`} />
            </div>
            <div className="itin-body">
              <h3>{r.club}</h3>
              <div className="itin-meta"><span className="chip">Par {r.par}</span><FormatChips r={r} /></div>
              <div className="itin-groups">
                {groupsFor(S, r.id).map((g, t) => (
                  <div className="itin-group" key={t}>
                    <b>{g.tee}</b>
                    <span>
                      {ONE_GROUP
                        ? <>{holesLabel(r)} · {r.town}</>
                        : <>
                            {g.name ? <><i>{gname(g, t)}</i> · </> : null}
                            {groupsSet(S, r.id) ? g.players.map(first).join(', ') : <span className="muted">To be set</span>}
                          </>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        ))}
      </div>
    </>
  );
}
