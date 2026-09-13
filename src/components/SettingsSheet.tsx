import { BITS, ORGANISER, ROUNDS, RULES, pName } from '../data/trip';
import { hasSync, setMe, setStakes, setTeeChoice, resetAll } from '../lib/store';
import { useStore } from '../lib/useStore';
import { describeRules } from '../lib/scoring';
import { BIT_KINDS } from '../lib/state';
import { toast } from '../lib/toast';

async function copy(text: string, msg: string) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('Copy this:', text); }
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { S, me, syncStatus } = useStore();

  const syncLine = hasSync
    ? (syncStatus === 'live'
      ? 'Scores sync live between every phone through the trip database.'
      : 'Offline right now — scores save here and send to the other phones when signal returns.')
    : 'Scores live on this phone only.';

  const share = () => copy(location.origin + location.pathname, 'App link copied — anyone who opens it joins the live scores');
  const doReset = () => {
    if (!confirm('Clear every score, pair draw and scramble result on this phone?')) return;
    resetAll(); onClose(); toast('Reset');
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">You &amp; sharing</h2>
        <p className="small muted">
          {me && me !== 'watcher' ? <>You're scoring as <b>{pName(me)}</b> on this phone.</> : <>You're <b>just watching</b> on this phone.</>}{' '}
          <button className="linklike" onClick={() => { setMe(null); onClose(); }}>Switch</button>
        </p>
        <p className="small muted">{syncLine}</p>
        <div className="btn-row">
          <button className="btn primary" onClick={share}>Copy app link</button>
        </div>
        {RULES.sideBets && <div className="course-edit">
          <h3>Side bets</h3>
          <p className="help">Pence per offence — Cuckoo (tree), Camel (bunker), Fish (water), Three-putt. Whoever has the last one of each at the end of the round pays the total into the group bet.</p>
          <div className="stakes">
            {BIT_KINDS.map((k) => (
              <label key={k}>
                <span><span aria-hidden>{BITS[k].icon}</span> {BITS[k].label}</span>
                <span className="stake-in">
                  <input
                    type="number" inputMode="numeric" min={0} max={1000} value={S.stakes[k]}
                    // Tapping in selects the whole value, so typing replaces it.
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const n = Math.round(parseFloat(e.target.value));
                      setStakes({ ...S.stakes, [k]: Number.isNaN(n) ? 0 : Math.min(1000, Math.max(0, n)) });
                    }}
                  />p
                </span>
              </label>
            ))}
          </div>
        </div>}
        <div className="course-edit">
          <h3>Tees</h3>
          <p className="help">Which tees each course is played off. Changing this moves everyone's course handicaps for that round, on every phone.</p>
          <div className="stakes one">
            {ROUNDS.filter((r) => r.altTees?.length).map((r) => (
              <label key={r.id}>
                <span>{r.short}</span>
                <select
                  value={S.teeChoice[r.id] ?? ''}
                  onChange={(e) => setTeeChoice(r.id, e.target.value || null)}
                >
                  <option value="">{r.tees} (default)</option>
                  {r.altTees!.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        <div className="course-edit">
          <h3>Rules in play</h3>
          <p className="help">{describeRules()} Change these in the code.</p>
        </div>
        <div className="course-edit">
          <div className="btn-row">
            {!hasSync && me === ORGANISER && <button className="btn danger sm" onClick={doReset}>Clear all scores</button>}
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
