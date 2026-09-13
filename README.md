# Arran Golf 2026

Mobile-first web app for the Isle of Arran trip, 23–26 September 2026: seven stableford rounds over four days, real course data, handicap indexes that move by finishing place, swipeable score entry, live standings — synced live between every phone.

Cloned from [yorkshire-golf](https://github.com/TimHoare/yorkshire-golf), the app for the September 2026 Yorkshire week. Everything that makes it *this* trip lives in `src/data/trip.ts`; the courses, players, dates and name are still placeholders — search the repo for **TBC**.

**Stack:** React 19 + TypeScript + React Router 7, built with Vite, tested with Vitest. Supabase (Postgres + realtime) for multi-phone sync. Deployed to GitHub Pages by GitHub Actions on every push to `main`.

Live at: https://timhoare.github.io/arran-golf/

## Rules in play

- Every round is individual stableford off full course handicap. Week points 6 · 4 · 2 · 0 for 1st–4th each round, ties split on the back 9, 6, 3 and then shared.
- After every round each index moves by finishing place: −1.0 for the winner, −0.5 for 2nd, +0.5 for 3rd, +1.0 for 4th. Ties after countback share the steps. Nothing moves until all four cards are in, and the afternoon round is played off the index the morning left you on.
- No bonus balls, hidden pairs, scramble or side bets — all switched off in `RULES`.

## Develop

```
npm install
npm run dev      # local dev server with hot reload
npm test         # vitest: scoring engine, app flow, sync engine
npm run build    # type-check + production build to dist/
```

## Structure

- `src/data/trip.ts` — everything fixed about the trip: its name and dates (`TRIP`), rounds and scorecards, players, rules (`RULES`: points table, how the index moves, whether bonus balls and side bets are in). One group of four per round, so scoring needs no group draw.
- `src/lib/scoring.ts` — pure scoring engine: WHS course/playing handicaps, stableford tallies, index drift (by points from a par score, or by finishing place), week points, scramble, hidden pairs.
- `src/lib/store.ts` — app store with localStorage persistence and Supabase live sync: local-first writes, an offline outbox that retries, realtime subscription applying other phones' changes.
- `src/pages/` — Trip, Round (info: course facts, map, handicaps, course card), Scoring (swipe between holes, +/- against par), Players, Standings.
- Routes: `#/trip`, `#/players`, `#/standings`, `#/round/:rid`, `#/round/:rid/score/:hole`. The last route is remembered so a PWA cold start reopens where you were.

## Sync setup

Already configured for the trip's Supabase project in `src/config.ts` (public URL + publishable key — safe to commit; access control is the RLS policies). To point at a fresh project: run `supabase-schema.sql` in the Supabase SQL editor, then put the new Project URL and publishable key in `src/config.ts`. Empty values = single-phone localStorage mode.

## Backups and recovery

Three layers, so a wiped or mangled database is an inconvenience rather than a disaster:

- **The app can't delete scores.** The policies in `supabase-schema.sql` grant read, insert and update on the score tables but not delete (only pair draws, group draws and tee choices can be cleared). The in-app "Clear all scores" only exists in single-phone mode. To start a fresh trip, `truncate` the tables in the SQL editor.
- **A `history` table** records every insert, update and delete on every table, written by a trigger the app can't bypass. The comment at the bottom of `supabase-schema.sql` has the SQL to rebuild a table as it stood at any moment.
- **A backup every 15 minutes.** The `Back up the database` action dumps every table as JSON into the `backups` branch, one commit per change. Restore the latest with:

```
git fetch origin backups && git worktree add /tmp/yg-backups backups
node scripts/restore.mjs /tmp/yg-backups
```

Check out an older commit of `backups` first to go back further. The scripts use the publishable key from `src/config.ts`, so they run from any machine with the repo.

## Deploy

Push to `main`. The `Deploy to GitHub Pages` action runs tests, builds, and publishes `dist/`. First-time repo setup: Settings → Pages → Source: **GitHub Actions**. The site lives at `/<repo name>/`; the build reads that from the repo, so nothing to edit.

## The courses

| | Day | Course | Holes | Par | Tees in the app |
|---|---|---|---|---|---|
| 1 | Wed 23 | Lochranza | 11 par-3s played as 18 | 54 | one set |
| 2 | Thu 24 am | Brodick | 18 | 64 | yellow (whites change a par, so not offered) |
| 3 | Thu 24 pm | Lamlash | 18 | 64 | white · yellow |
| 4 | Fri 25 am | Corrie | 9 × 2 | 62 | yellow · white |
| 5 | Fri 25 pm | Whiting Bay | 18 | 63 | yellow · white |
| 6 | Sat 26 am | Machrie Bay | 9 × 2 | 66 | white · yellow |
| 7 | Sat 26 pm | Shiskine | 12 | 42 | yellow · white |

Rounds have their own hole count: Shiskine's twelve holes get twelve slides, a 6/4/2 countback and a course handicap scaled by 12/18 (which reproduces the club's own conversion chart). The nine-holers use the club cards' two stroke indexes per hole — odd first time round, even the second. Every card's sources and caveats are in the comments in `src/data/trip.ts`; the ones worth checking in the clubhouse are Lochranza's stroke indexes (only an aggregator's card exists for the new 18-tee layout) and Brodick's and Lamlash's ratings (third-party figures, the clubs don't publish theirs).

## Still to fill in

1. **Supabase.** Create the trip's own project, run `supabase-schema.sql` in its SQL editor, put the project URL and publishable key in `src/config.ts`. Until then the app runs in single-phone mode.
2. **Tee times** — each round's `groups[0].tee` in `src/data/trip.ts`, and `TRIP.firstTee` for the countdown.
3. **Photos** for Jonny and George (optional): `src/assets/avatars/p2.webp` and `p4.webp`. Liam and Adam's carry over from Yorkshire.
