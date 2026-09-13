// App chrome: header (wordmark, sync pill, settings), bottom tabs, toast.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PLAYERS, TRIP } from '../data/trip';
import { hasSync } from '../lib/store';
import { useStore } from '../lib/useStore';
import { onToast } from '../lib/toast';

export function SyncPill() {
  const { syncStatus, pending } = useStore();
  if (!hasSync) return null;
  const label =
    syncStatus === 'live' ? 'Live' :
    syncStatus === 'connecting' ? 'Connecting' :
    pending ? `Offline · ${pending} to send` : 'Offline';
  return (
    <span className="sync-pill" data-state={syncStatus}><i /><b>{label}</b></span>
  );
}

export function Header({ onSettings }: { onSettings: () => void }) {
  // Publish the header's height as --top-h, so anything else that sticks
  // (scorecard headers) can sit just under it — the safe-area inset and
  // wrapping make it vary from phone to phone.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--top-h', el.offsetHeight + 'px');
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return (
    <header className="top" ref={ref}>
      <div className="top-inner">
        <Link className="wordmark" to="/trip" aria-label="Home">
          <span className="wm-line1">{TRIP.name} <i>{TRIP.year}</i></span>
          <span className="wm-line2">{TRIP.dates} · {PLAYERS.length} golfers</span>
        </Link>
        <div className="top-actions">
          <SyncPill />
          <button className="icon-btn" onClick={onSettings} aria-label="Settings">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Tabs() {
  const tab = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink to={to} className="tab">
      {icon}
      <span>{label}</span>
    </NavLink>
  );
  return (
    <nav className="tabs" aria-label="Sections">
      {tab('/trip', 'Trip', <svg viewBox="0 0 24 24"><path d="M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4" /></svg>)}
      {tab('/players', 'Players', <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.8" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></svg>)}
      {tab('/standings', 'Standings', <svg viewBox="0 0 24 24"><path d="M3 20h18 M6 20v-7h4v7 M14 20V4h4v16" /></svg>)}
    </nav>
  );
}

export function Toast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => onToast((m) => {
    setMsg(m); setShow(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setShow(false), 1800);
  }), []);
  return <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">{msg}</div>;
}
