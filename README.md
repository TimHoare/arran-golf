# Yorkshire Golf Week 2026

Mobile-first web app for a golf trip: itinerary, real course data, players and handicap indexes, swipeable score entry, automatic index/course-handicap maths, live standings — synced live between every phone. This copy is the Yorkshire week of 7–11 September 2026; everything that makes it that trip lives in one file, so it doubles as the template for the next one (see *Starting a new trip*).

**Stack:** React 19 + TypeScript + React Router 7, built with Vite, tested with Vitest. Supabase (Postgres + realtime) for multi-phone sync. Deployed to GitHub Pages by GitHub Actions on every push to `main`.

Live at: https://timhoare.github.io/yorkshire-golf/

## Develop

```
npm install
npm run dev      # local dev server with hot reload
npm test         # vitest: scoring engine, app flow, sync engine
npm run build    # type-check + production build to dist/
```

## Structure

- `src/data/trip.ts` — everything fixed about the trip: its name and dates (`TRIP`), rounds, real scorecards (men's yellow tees from each club's published card), players, rules (`RULES`: points table, how the index moves, whether bonus balls and side bets are in). Tee times and groups are placeholders until the tee sheet is settled.
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

## Starting a new trip

Each trip is its own repo and its own Supabase project: the old app stays up as the record of its week, the new one can't touch its data, and a free Supabase org allows two projects.

1. **Clone this repo** under the new trip's name (the repo name becomes the URL path), push it to GitHub, and turn Pages on as above. Keep `name` in `package.json` equal to the repo name so local builds match.
2. **New Supabase project.** Run `supabase-schema.sql` in its SQL editor, then put the project URL and publishable key in `src/config.ts`.
3. **Fill in `src/data/trip.ts`.** `TRIP` (slug, name, year, dates, first tee — the slug keys this phone's storage and the realtime channel, so make it new), `ROUNDS` (two rounds on one day take `slot: 'am' | 'pm'`), `PLAYERS`, `RULES`, `ORGANISER`. Each round's `format` and `pairs` switch scramble and hidden pairs on per round; `RULES.bonusBalls` and `RULES.sideBets` switch those on for the trip; `RULES.indexAdjust` picks how the index moves.
4. **Photos** (optional): `src/assets/avatars/<player id>.webp`. Anyone without one gets their initials.
5. **Name the app** in `index.html` (`<title>`) and `public/manifest.json` (`name`, `short_name`), and retitle this README.
6. **Backups**: create an empty `backups` branch so the backup action has somewhere to commit:
   `git checkout --orphan backups && git rm -rf . && git commit --allow-empty -m "Backups" && git push origin backups`
