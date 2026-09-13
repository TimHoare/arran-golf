// App flow: welcome → trip → round info → scoring, with the real router.
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import App from '../App';
import { reloadFromStorage, setGroupDraw, setMe } from '../lib/store';
import { ME_KEY, STORE_KEY } from '../lib/state';

function mount(path = '/trip') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

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
    fireEvent.click(screen.getByText('Rob Ellis'));
    expect(screen.queryByText("Who's this?")).toBeNull();
    expect(localStorage.getItem(ME_KEY)).toBe('p6');
  });

  it('trip page lists all five rounds', () => {
    setMe('p1');
    mount();
    for (const club of ['Elsham Golf Club', 'Ganton Golf Club', 'Cave Castle Golf Club', 'Beverley & East Riding Golf Club', 'York Golf Club']) {
      expect(screen.getByText(club)).toBeTruthy();
    }
  });

  it('player page shows their index and a row per round', () => {
    setMe('p1');
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, scores: {}, pairs: {}, scramble: {},
      groups: { d3: [['p1', 'p3'], ['p5', 'p7'], ['p2', 'p4'], ['p6', 'p8']] },
    }));
    reloadFromStorage();
    mount('/player/p6');
    expect(screen.getByText('Rob Ellis')).toBeTruthy();
    expect(screen.getByText('The week')).toBeTruthy();
    for (const short of ['Elsham', 'Ganton', 'Cave Castle', 'Beverley', 'York']) {
      expect(screen.getByText(short)).toBeTruthy();
    }
    // Rob is in Team D for the scramble
    expect(screen.getByText(/Team D/)).toBeTruthy();
  });

  it("player round page: the player's own card with bonus ball and side bets on the holes", () => {
    setMe('p1');
    const eighteen = (g: number) => Array(18).fill(g);
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, pairs: {}, scramble: {},
      scores: { d1: { p6: [4, 3, 0, ...eighteen(4).slice(3)] } },
      groups: { d1: [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']] },
      bits: { d1: { 1: { cuckoo: [null, null, { counts: { p6: 2, p5: 1 }, last: 'p6' }], camel: [{ counts: { p6: 1 }, last: 'p6' }] } } },
      bonus: { p6: { used: { d1: 4 }, lost: null } },
    }));
    reloadFromStorage();
    // the profile's round rows link to the player's card, not the course page
    const { container, unmount } = mount('/player/p6');
    expect(container.querySelector('a.pweek-row')!.getAttribute('href')).toBe('/player/p6/round/d1');
    unmount();

    const { container: c } = mount('/player/p6/round/d1');
    expect(screen.getByText('Elsham Golf Club')).toBeTruthy();
    expect(screen.getByText(/Rob Ellis/)).toBeTruthy();
    const rows = [...c.querySelectorAll('table.player-sc tbody tr:not(.sum)')];
    expect(rows).toHaveLength(18);
    expect(rows[0].textContent).toContain('🐫');          // camel on the 1st
    expect(rows[0].querySelector('.gs')!.className).toBe('gs par');    // 4 on a par 4
    expect(rows[1].querySelector('.gs')!.className).toBe('gs birdie'); // 3 on the par-4 2nd: red circle
    expect(rows[2].querySelector('.gs')!.className).toBe('gs x');    // pickup: no shape
    expect(rows[2].textContent).toContain('✕');           // pickup on the 3rd
    expect(rows[2].textContent).toContain('🐦×2');        // two cuckoos on the 3rd
    expect(rows[4].textContent).toContain('🎱 2×');       // bonus ball on the 5th
    expect(rows[4].querySelector('.bbx .gs')).toBeTruthy();  // and its mark sits in the brass box
    expect(c.querySelector('table.player-sc tr.sum')!.textContent).toContain('+');   // Out total: a pickup in there
    expect(rows[1].textContent).not.toContain('🐦');
    // totals in the extras list: 2 cuckoos, 1 camel, and Rob had the last cuckoo
    expect(screen.getByText('2× on the 5th')).toBeTruthy();
    expect(screen.getAllByText(/Had the last one/)).toHaveLength(2);
  });

  it('a finished round shows week points as individual + pair on the leaderboard, card and profile', () => {
    setMe('p1');
    const par = [4,4,4,5,5,3,4,4,3, 5,4,3,4,3,4,4,4,4];
    const scores = Object.fromEntries(['p1','p2','p3','p4','p5','p6','p7','p8'].map((pid, i) => [pid, par.map((p) => p + (i % 3))]));
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, scramble: {}, scores: { d1: scores },
      groups: { d1: [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']] },
      pairs: { d1: { pairs: [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['p7', 'p8']], revealed: true } },
    }));
    reloadFromStorage();
    const { container, unmount } = mount('/round/d1');
    const top = container.querySelector('a.rlb-row')!;
    expect(top.querySelector('.rlb-wk')!.textContent).toMatch(/^\d+(\.\d)?wk$/);
    expect(top.querySelector('small.wk')!.textContent).toMatch(/^Week pts: \d+(\.\d)? for \d(st|nd|rd|th)=? \+ \d+(\.\d)? pair$/);
    expect(screen.getByText(/plus 6 · 4 · 2 · 0 each for the hidden pairs/)).toBeTruthy();
    unmount();
    const pid = top.getAttribute('href')!.split('/')[2];
    mount(`/player/${pid}/round/d1`);
    expect(screen.getByText('Week pts').parentElement!.querySelector('.s')!.textContent).toMatch(/ for \d(st|nd|rd|th)=? \+ .* pair$/);
    cleanup();
    mount(`/player/${pid}`);
    expect(screen.getByText(/week pts/).parentElement!.textContent).toMatch(/week pts \(\S+ \+ \S+ pair\)/);
  });

  it('back returns to the page you came from, or the natural parent on a cold start', () => {
    setMe('p1');
    // deep link: nothing behind us, so back goes to the profile
    const { container, unmount } = mount('/player/p6/round/d1');
    let back = container.querySelector('a.back')!;
    expect(back.textContent).toBe('Rob');
    expect(back.getAttribute('href')).toBe('/player/p6');
    unmount();

    // via the standings table: back goes to the standings, not the profile
    const { container: c } = mount('/standings');
    fireEvent.click([...c.querySelectorAll('.rounds-table tbody tr td a')].find((a) => a.getAttribute('href') === '/player/p6/round/d1')!);
    expect(screen.getByText('Elsham Golf Club')).toBeTruthy();
    back = c.querySelector('a.back')!;
    expect(back.textContent).toBe('Standings');
    fireEvent.click(back);
    expect(screen.getByText('Round by round')).toBeTruthy();
    expect(c.querySelector('a.back')).toBeNull();
  });

  it("round page leaderboard rows link to each player's card", () => {
    setMe('p1');
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, pairs: {}, scramble: {},
      scores: { d1: { p6: [4, 3, 4], p1: [5, 5, 5] } },
      groups: { d1: [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']] },
    }));
    reloadFromStorage();
    const { container } = mount('/round/d1');
    const rows = [...container.querySelectorAll('a.rlb-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('href')).toBe('/player/p6/round/d1');   // Rob leads
    expect(rows[1].getAttribute('href')).toBe('/player/p1/round/d1');
  });

  it("player round page on scramble day shows the team's card", () => {
    setMe('p1');
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3, pairs: {}, scores: {},
      scramble: { d3: { 3: [4, 4] } },
      groups: { d3: [['p1', 'p3'], ['p5', 'p7'], ['p2', 'p4'], ['p6', 'p8']] },
    }));
    reloadFromStorage();
    const { container } = mount('/player/p6/round/d3');
    expect(screen.getByText(/Cave Castle Golf Club/)).toBeTruthy();
    expect(container.querySelector('h1')!.textContent).toBe('Team D');          // the team's page, not Rob's
    expect(screen.getByText(/Rob Ellis & Liam Cameron/)).toBeTruthy();
    expect(screen.getByText('Team pts')).toBeTruthy();
    expect(screen.getByText('Rob · course hcp')).toBeTruthy();
    expect(screen.getByText('Liam C · course hcp')).toBeTruthy();
    expect(screen.queryByText('Bonus ball')).toBeNull();
    const rows = [...container.querySelectorAll('table.player-sc tbody tr:not(.sum)')];
    expect(rows[0].textContent).toContain('4');
    expect(rows[2].textContent).toContain('·');
  });

  it('round info page shows course facts, map link and my course handicap — but no steppers', () => {
    setMe('p1');
    mount('/round/d2');
    expect(screen.getByText('Slope')).toBeTruthy();
    expect(screen.getByText('Your course handicap here')).toBeTruthy();
    const map = screen.getByText('Map ↗').closest('a')!;
    expect(map.href).toContain('google.com/maps');
    expect(screen.queryByLabelText('One stroke more')).toBeNull();
    expect(screen.getByText('Scores')).toBeTruthy();
    // real Ganton yardage on the course card
    expect(screen.getByText('6,440 yds')).toBeTruthy();
  });

  it('scoring page: 18 slides, + from empty records par, − a birdie, 0 a pickup', () => {
    setMe('p6'); // Rob, group 2 of d1
    setGroupDraw('d1', [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']]);
    const { container } = mount('/round/d1/score/1');
    expect(container.querySelectorAll('.swipe .slide')).toHaveLength(18);
    // group defaulted to mine (Group 2 seg active)
    expect(container.querySelector('.seg button.on')!.textContent).toBe('Group 2');
    const slide1 = container.querySelector('.slide[data-slide="1"]')!;
    const robRow = [...slide1.querySelectorAll('.score-row')].find((r) => within(r as HTMLElement).queryByText('Rob'))! as HTMLElement;
    fireEvent.click(within(robRow).getByLabelText('One stroke more'));
    expect((within(robRow).getByPlaceholderText('4') as HTMLInputElement).value).toBe('4'); // hole 1 par 4 → par
    const slide2 = container.querySelector('.slide[data-slide="2"]')!;
    const robRow2 = [...slide2.querySelectorAll('.score-row')].find((r) => within(r as HTMLElement).queryByText('Rob'))! as HTMLElement;
    fireEvent.click(within(robRow2).getByLabelText(/One stroke fewer/));
    expect((within(robRow2).getByPlaceholderText('4') as HTMLInputElement).value).toBe('3'); // birdie
    let saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.d1.p6[0]).toBe(4);
    expect(saved.scores.d1.p6[1]).toBe(3);
    expect(within(robRow2).getByText('Birdie')).toBeTruthy();
    // typing 0 marks a pickup (hold − does the same); − then clears it
    fireEvent.change(within(robRow2).getByPlaceholderText('4'), { target: { value: '0' } });
    expect(within(robRow2).getByText('Pickup')).toBeTruthy();
    saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.d1.p6[1]).toBe(0);
    fireEvent.click(within(robRow2).getByLabelText('Undo the X'));
    saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.d1.p6[1]).toBeNull();
  });

  it('a three-putt can be logged once per player per hole; cuckoos can stack', () => {
    setMe('p6'); // Rob, group 2 of d1
    setGroupDraw('d1', [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']]);
    const { container } = mount('/round/d1/score/1');
    const slide1 = container.querySelector('.slide[data-slide="1"]')! as HTMLElement;
    fireEvent.click(within(slide1).getByText('Three-putts'));
    const plus = within(slide1).getByLabelText('One three-putt more for Rob') as HTMLButtonElement;
    fireEvent.click(plus);
    let saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.bits.d1[1].threeputt[0].counts.p6).toBe(1);
    // capped: the + is disabled and a second tap changes nothing
    const capped = within(slide1).getByLabelText('Rob already has the three-putt') as HTMLButtonElement;
    expect(capped.disabled).toBe(true);
    fireEvent.click(capped);
    saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.bits.d1[1].threeputt[0].counts.p6).toBe(1);
    // cuckoos have no cap
    fireEvent.click(within(slide1).getByText('Cuckoos'));
    fireEvent.click(within(slide1).getByLabelText('One cuckoo more for Rob'));
    fireEvent.click(within(slide1).getByLabelText('One cuckoo more for Rob'));
    saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.bits.d1[1].cuckoo[0].counts.p6).toBe(2);
  });

  it("other groups' cards are read-only; watchers can't score at all", () => {
    setMe('p6'); // Rob, group 2 of d1
    setGroupDraw('d1', [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']]);
    const { container, unmount } = mount('/round/d1/score/1');
    // flip to group 1: no steppers, just the read-only strokes
    fireEvent.click(within(container.querySelector('.seg')! as HTMLElement).getByText('Group 1'));
    expect(container.querySelectorAll('.stepper button')).toHaveLength(0);
    expect(container.querySelectorAll('.stepper.ro').length).toBeGreaterThan(0);
    unmount();

    setMe('watcher');
    const { container: c2 } = mount('/round/d1/score/1');
    expect(c2.querySelectorAll('.stepper button')).toHaveLength(0);
  });

  it('scoring deep link with no hole lands on first unfinished hole for my group', () => {
    setMe('p1');
    // ragged 3-entry arrays on purpose: migrate() must pad them to 18
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 3,
      scores: { d1: { p1: [4, 4, 4], p2: [4, 4, 4], p3: [4, 4, 4], p4: [4, 4, 4] } },
      pairs: {}, scramble: {},
      groups: { d1: [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']] },
    }));
    reloadFromStorage();
    const { container } = mount('/round/d1/score');
    expect(container.querySelector('.hole-chip.on')!.textContent).toBe('4');
  });

  it('scoring is closed until the groups are saved', () => {
    setMe('p1');
    mount('/round/d1/score/1');
    // bounced back to the round page, where Scores is disabled
    expect(screen.getByText('Elsham Golf Club')).toBeTruthy();
    const enter = screen.getByText('Scores') as HTMLButtonElement;
    expect(enter.closest('a')).toBeNull();
    expect(enter.closest('button')!.disabled).toBe(true);
  });

  it('standings tags my row with a you chip, and links rows and round cells to cards', () => {
    setMe('p1');
    const { container } = mount('/standings');
    expect(container.querySelector('.lb-row .chip.you')).toBeTruthy();
    // standings rows open the profile; round-by-round cells open that round's card
    const row = container.querySelector('a.lb-row .chip.you')!.closest('a')!;
    expect(row.getAttribute('href')).toBe('/player/p1');
    const cells = [...container.querySelectorAll('.rounds-table tbody tr:first-child td a')];
    expect(cells.map((a) => a.getAttribute('href'))).toEqual([
      '/player/p1', '/player/p1/round/d1', '/player/p1/round/d2', '/player/p1/round/d3', '/player/p1/round/d4', '/player/p1/round/d5',
    ]);
  });
});
