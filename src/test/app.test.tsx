// App flow: welcome → trip → round → scoring → standings, with the real router.
// Four players in one group, so scoring is open without a draw; no bonus
// balls or side bets anywhere on screen.
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import App from '../App';
import { R, ROUNDS } from '../data/trip';
import { reloadFromStorage, setMe } from '../lib/store';
import { ME_KEY, STORE_KEY } from '../lib/state';
import { phFor, shotsOn } from '../lib/scoring';
import { defaultState } from '../lib/state';

function mount(path = '/trip') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}
const save = (s: object) => { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 3, scores: {}, pairs: {}, scramble: {}, groups: {}, ...s })); reloadFromStorage(); };
// Net par everywhere off the starting index, with adjustments — for full cards.
const netPar = (rid: string, pid: string, delta: number[] = []) =>
  R(rid)!.holes.map((h, i) => h.par + shotsOn(phFor(defaultState(), pid, rid), h.si) + (delta[i] ?? 0));

beforeEach(() => {
  cleanup();
  localStorage.clear();
  reloadFromStorage();
  setMe(null);
});

describe('app flow', () => {
  it('shows the welcome screen until a name is picked', () => {
    mount();
    expect(screen.getByText("Who's this?")).toBeTruthy();
    fireEvent.click(screen.getByText('Jonny Bidewell'));
    expect(screen.queryByText("Who's this?")).toBeNull();
    expect(localStorage.getItem(ME_KEY)).toBe('p2');
  });

  it('trip page lists all seven rounds with am/pm on the double days, groups already set', () => {
    setMe('p1');
    mount();
    for (const r of ROUNDS) expect(screen.getByText(r.club)).toBeTruthy();
    expect(screen.getAllByText('Thu am')).toHaveLength(1);
    expect(screen.getAllByText('Thu pm')).toHaveLength(1);
    expect(screen.getByText('Shiskine Golf & Tennis Club')).toBeTruthy();
    expect(screen.queryByText('To be set')).toBeNull();
  });

  it('player page shows their index and a row per round, no extras panel', () => {
    setMe('p1');
    const { container } = mount('/player/p2');
    expect(screen.getByText('Jonny Bidewell')).toBeTruthy();
    expect(screen.getByText('The week')).toBeTruthy();
    expect(container.querySelectorAll('a.pweek-row')).toHaveLength(7);
    expect(screen.queryByText('Bonus ball')).toBeNull();
    expect(screen.queryByText('Cuckoos')).toBeNull();
  });

  it("player round page: the card without an Extras column or bonus-ball legend", () => {
    setMe('p1');
    save({ scores: { r1: { p2: [3, 2, 0, ...Array(8).fill(3)] } } });   // Lochranza: 11 par 3s
    const { container: c } = mount('/player/p2/round/r1');
    expect(screen.getByText(R('r1')!.club)).toBeTruthy();
    const rows = [...c.querySelectorAll('table.player-sc tbody tr:not(.sum)')];
    expect(rows).toHaveLength(11);
    expect([...c.querySelectorAll('table.player-sc tr.sum td:first-child')].map((td) => td.textContent)).toEqual(['Total']);   // no Out/In on an odd count
    expect(c.querySelectorAll('table.player-sc thead th')).toHaveLength(5);   // Hole Par SI Gross Pts
    expect(rows[0].querySelector('.gs')!.className).toBe('gs par');      // 3 on a par 3
    expect(rows[1].querySelector('.gs')!.className).toBe('gs birdie');   // 2
    expect(rows[2].textContent).toContain('✕');
    expect(screen.queryByText('Extras')).toBeNull();
    expect(screen.queryByText('bonus ball')).toBeNull();
  });

  it('round page: course facts, scoring open with no groups to set, no side bets', () => {
    setMe('p1');
    mount('/round/r2');
    expect(screen.getByText('Slope')).toBeTruthy();
    expect(screen.getByText('Your course handicap here')).toBeTruthy();
    expect(screen.getByText('Scores').closest('a')!.getAttribute('href')).toBe('/round/r2/score');
    expect(screen.queryByText(/Set groups/)).toBeNull();
    expect(screen.queryByText('Side bets')).toBeNull();
    expect(screen.getByText('Round 2 · Thu 24 Sept · Brodick')).toBeTruthy();
    expect(screen.getByText('4,468 yds')).toBeTruthy();   // Brodick off the yellows
  });

  it('scoring page: one group, a slide per hole, + from empty records par, − a birdie, 0 a pickup, no extras', () => {
    setMe('p2');
    const { container } = mount('/round/r1/score/1');
    expect(container.querySelectorAll('.swipe .slide')).toHaveLength(11);   // Lochranza
    expect(container.querySelector('.seg')).toBeNull();   // nothing to switch between
    expect(screen.queryByText('Bonus balls')).toBeNull();
    expect(screen.queryByText('Group bet · this hole')).toBeNull();
    const slide1 = container.querySelector('.slide[data-slide="1"]')!;
    expect(slide1.querySelectorAll('.score-row')).toHaveLength(4);
    const row = [...slide1.querySelectorAll('.score-row')].find((r) => within(r as HTMLElement).queryByText('Jonny'))! as HTMLElement;
    fireEvent.click(within(row).getByLabelText('One stroke more'));
    expect((within(row).getByPlaceholderText('3') as HTMLInputElement).value).toBe('3');   // Lochranza 1st: par 3
    const slide2 = container.querySelector('.slide[data-slide="2"]')!;
    const row2 = [...slide2.querySelectorAll('.score-row')].find((r) => within(r as HTMLElement).queryByText('Jonny'))! as HTMLElement;
    fireEvent.click(within(row2).getByLabelText(/One stroke fewer/));
    expect((within(row2).getByPlaceholderText('3') as HTMLInputElement).value).toBe('2');
    let saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.r1.p2[0]).toBe(3);
    expect(saved.scores.r1.p2[1]).toBe(2);
    expect(within(row2).getByText('Birdie')).toBeTruthy();
    fireEvent.change(within(row2).getByPlaceholderText('3'), { target: { value: '0' } });
    expect(within(row2).getByText('Pickup')).toBeTruthy();
    saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.r1.p2[1]).toBe(0);
    fireEvent.click(within(row2).getByLabelText('Undo the X'));
    saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.r1.p2[1]).toBeNull();
  });

  it("watchers can look but can't score", () => {
    setMe('watcher');
    const { container } = mount('/round/r1/score/1');
    expect(container.querySelectorAll('.stepper button')).toHaveLength(0);
    expect(container.querySelectorAll('.stepper.ro')).toHaveLength(11 * 4);
  });

  it('scoring deep link with no hole lands on the first unfinished hole', () => {
    setMe('p1');
    save({ scores: { r1: { p1: [4, 4, 4], p2: [4, 4, 4], p3: [4, 4, 4], p4: [4, 4, 4] } } });
    const { container } = mount('/round/r1/score');
    expect(container.querySelector('.hole-chip.on')!.textContent).toBe('4');
  });

  it('a finished round: 6 · 4 · 2 · 0 on the leaderboard, the index moved on the profile', () => {
    setMe('p1');
    save({ scores: { r1: { p1: netPar('r1', 'p1', [-1, -1]), p2: netPar('r1', 'p2', [-1]), p3: netPar('r1', 'p3'), p4: netPar('r1', 'p4', [1]) } } });
    const { container, unmount } = mount('/round/r1');
    const rows = [...container.querySelectorAll('a.rlb-row')];
    expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/player/p1/round/r1', '/player/p2/round/r1', '/player/p3/round/r1', '/player/p4/round/r1']);
    expect(rows.map((a) => a.querySelector('.rlb-wk')!.textContent)).toEqual(['6wk', '4wk', '2wk', '0wk']);
    expect(screen.getByText(/Week points 6 · 4 · 2 · 0 for 1st–4th/)).toBeTruthy();
    unmount();
    mount('/player/p1');
    expect(screen.getByText(/Index 8.8 → 7.8/)).toBeTruthy();
    expect(screen.getByText(/now 7.8/)).toBeTruthy();
    cleanup();
    mount('/player/p4');
    expect(screen.getByText(/Index 14.7 → 15.7/)).toBeTruthy();
  });

  it('standings: you chip, seven round columns labelled by day, cells link to cards', () => {
    setMe('p1');
    const { container } = mount('/standings');
    expect(container.querySelector('.lb-row .chip.you')).toBeTruthy();
    expect([...container.querySelectorAll('.rounds-table thead th')].map((th) => th.textContent))
      .toEqual(['Player', 'Wed', 'Thu am', 'Thu pm', 'Fri am', 'Fri pm', 'Sat am', 'Sat pm', 'Total']);
    const cells = [...container.querySelectorAll('.rounds-table tbody tr:first-child td a')];
    expect(cells.map((a) => a.getAttribute('href'))).toEqual(['/player/p1', ...ROUNDS.map((r) => `/player/p1/round/${r.id}`)]);
    expect(screen.queryByText(/bonus ball/)).toBeNull();
  });

  it('back returns to the page you came from, or the natural parent on a cold start', () => {
    setMe('p1');
    const { container, unmount } = mount('/player/p2/round/r1');
    let back = container.querySelector('a.back')!;
    expect(back.textContent).toBe('Jonny');
    expect(back.getAttribute('href')).toBe('/player/p2');
    unmount();
    const { container: c } = mount('/standings');
    fireEvent.click([...c.querySelectorAll('.rounds-table tbody tr td a')].find((a) => a.getAttribute('href') === '/player/p2/round/r1')!);
    expect(screen.getByText(R('r1')!.club)).toBeTruthy();
    back = c.querySelector('a.back')!;
    expect(back.textContent).toBe('Standings');
    fireEvent.click(back);
    expect(screen.getByText('Round by round')).toBeTruthy();
  });

  it('settings describe the rules in play', () => {
    setMe('p1');
    mount();
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByText(/−1.0 · −0.5 · \+0.5 · \+1.0 for 1st–4th/)).toBeTruthy();
    expect(screen.queryByText('Side bets')).toBeNull();
  });
});
