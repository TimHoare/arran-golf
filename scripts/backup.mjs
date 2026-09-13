// Dump every table to <dir>/<table>.json (one row per line, so git diffs read
// well). Run by .github/workflows/backup.yml every 15 minutes into the
// `backups` branch; run by hand with: node scripts/backup.mjs some-dir
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES, url, headers } from './tables.mjs';

const dir = process.argv[2] || 'backups';
const PAGE = 1000;

async function fetchAll({ name, key }) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${url}/rest/v1/${name}?select=*&order=${key.join(',')}`, {
      headers: { ...headers, 'Range-Unit': 'items', Range: `${from}-${from + PAGE - 1}` },
    });
    if (r.status === 416) break; // asked past the end
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${await r.text()}`);
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

// No database yet (src/config.ts still blank): nothing to back up, not a failure.
if (!url) { console.log('No Supabase project configured — skipping backup'); process.exit(0); }

mkdirSync(dir, { recursive: true });
let failed = false;
for (const t of TABLES) {
  try {
    const rows = await fetchAll(t);
    writeFileSync(join(dir, `${t.name}.json`), rows.length ? `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n` : '[]\n');
    console.log(`${t.name}: ${rows.length} rows`);
  } catch (e) {
    // One table failing (e.g. not created yet) must not cost us the others.
    failed = true;
    console.error(String(e.message || e));
  }
}
process.exit(failed ? 1 : 0);
