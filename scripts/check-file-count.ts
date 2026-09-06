import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cloudflare Pages przyjmuje maksymalnie 20 000 plików w jednym deploymencie
 * i 25 MB na plik. Przy ~400 zdjęciach i kilku wariantach szerokości każde
 * z nich mnoży się przez liczbę formatów, więc warto to widzieć w CI,
 * a nie dowiadywać się przy wdrożeniu.
 */

const DIST = 'dist';
const FILE_LIMIT = 20_000;
const SIZE_LIMIT = 25 * 1024 * 1024;
// Próg ostrzegawczy: przy 80% limitu jest jeszcze czas zareagować.
const WARN_AT = 0.8;

let files = 0;
let bytes = 0;
const oversized: { path: string; size: number }[] = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    files += 1;
    const { size } = statSync(path);
    bytes += size;
    if (size > SIZE_LIMIT) oversized.push({ path, size });
  }
}

try {
  walk(DIST);
} catch {
  console.error('✖ Brak katalogu dist/. Uruchom najpierw `npm run build`.');
  process.exit(1);
}

const mb = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;
const usage = files / FILE_LIMIT;

console.log(`Deployment: ${files} plików, ${mb(bytes)}`);
console.log(`    limit plików: ${files} / ${FILE_LIMIT} (${(usage * 100).toFixed(1)}%)`);

if (oversized.length > 0) {
  console.error(`\n✖ ${oversized.length} plików przekracza limit 25 MB:`);
  for (const file of oversized) console.error(`    ${file.path} — ${mb(file.size)}`);
  process.exit(1);
}

if (files > FILE_LIMIT) {
  console.error(
    `\n✖ Przekroczono limit ${FILE_LIMIT} plików. Ogranicz liczbę generowanych ` +
      'szerokości obrazów w astro.config.mjs albo wydziel archiwalne galerie do R2.',
  );
  process.exit(1);
}

if (usage > WARN_AT) {
  console.warn(
    `\n⚠ Wykorzystano ${(usage * 100).toFixed(1)}% limitu plików. ` +
      'Czas rozważyć ograniczenie wariantów obrazów.',
  );
}

console.log('\n✔ Deployment mieści się w limitach Cloudflare Pages.');
