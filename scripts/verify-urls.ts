import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapLimit } from './lib/http';

/**
 * Bramka jakości przed przełączeniem domeny.
 *
 * Sprawdza, że **każdy** ze 115 adresów starego serwisu kończy się
 * odpowiedzią 200 — bezpośrednio albo po przekierowaniu 301. Dodatkowo
 * pilnuje higieny SEO na zbudowanych stronach: dokładnie jeden `<h1>`,
 * obecny `canonical`, obecny `meta description`.
 *
 * Tryby:
 *   npm run verify-urls                 — przeciwko katalogowi dist/
 *   npm run verify-urls -- --url <base> — przeciwko deploymentowi (preview/prod)
 */

const DIST = 'dist';
const URLS_FILE = join('data', 'urls-original.txt');
const REDIRECTS = join('public', '_redirects');

const baseArg = process.argv.indexOf('--url');
const baseUrl = baseArg !== -1 ? process.argv[baseArg + 1]?.replace(/\/$/, '') : null;

const failures: string[] = [];
const warnings: string[] = [];

/* --------------------------------------------------------------------------
   Mapa przekierowań z public/_redirects
   -------------------------------------------------------------------------- */

const redirects = new Map<string, string>();

if (existsSync(REDIRECTS)) {
  for (const line of readFileSync(REDIRECTS, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const [from, to, status] = trimmed.split(/\s+/);
    // Tylko przekierowania. Przepisania (status 200) serwują inny plik pod
    // tym samym adresem i nie są przedmiotem tego testu.
    if (from && to && status === '301') redirects.set(from, to);
  }
}

/* --------------------------------------------------------------------------
   Tryb lokalny: sprawdzenie plików w dist/
   -------------------------------------------------------------------------- */

/**
 * `build.format: 'file'` daje /kontakt.html, a nie /kontakt/index.html.
 * Sprawdzamy oba warianty, żeby test nie zależał od tego ustawienia.
 */
function distFileFor(pathname: string): string | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const candidates =
    clean === ''
      ? [join(DIST, 'index.html')]
      : [join(DIST, `${clean}.html`), join(DIST, clean, 'index.html')];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function checkHtml(pathname: string, html: string): void {
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count !== 1) {
    failures.push(`${pathname}: ${h1Count} nagłówków <h1> (powinien być dokładnie jeden)`);
  }

  if (!/<link[^>]+rel="canonical"/i.test(html)) {
    failures.push(`${pathname}: brak <link rel="canonical">`);
  }

  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!description || description[1]!.trim().length < 50) {
    failures.push(`${pathname}: brak lub za krótki meta description`);
  } else if (description[1]!.length > 170) {
    warnings.push(`${pathname}: meta description ma ${description[1]!.length} znaków (>170)`);
  }

  if (!/<title>[^<]{10,}<\/title>/i.test(html)) {
    failures.push(`${pathname}: brak sensownego <title>`);
  }
}

function verifyLocal(pathname: string): void {
  const target = redirects.get(pathname);

  if (target) {
    // Przekierowanie musi prowadzić do istniejącej strony, nie w próżnię.
    if (!distFileFor(target)) {
      failures.push(`${pathname} → 301 → ${target}, ale ${target} nie istnieje w dist/`);
    }
    return;
  }

  const file = distFileFor(pathname);
  if (!file) {
    failures.push(`${pathname}: brak w dist/ i brak reguły 301`);
    return;
  }

  checkHtml(pathname, readFileSync(file, 'utf8'));
}

/* --------------------------------------------------------------------------
   Tryb sieciowy: sprawdzenie przeciwko deploymentowi
   -------------------------------------------------------------------------- */

async function verifyRemote(pathname: string): Promise<void> {
  const url = `${baseUrl}${pathname}`;

  try {
    const first = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'szklarz-pruszkow-verify/1.0' },
    });

    if (first.status === 200) {
      checkHtml(pathname, await first.text());
      return;
    }

    if (first.status !== 301) {
      failures.push(`${pathname}: HTTP ${first.status} (oczekiwano 200 albo 301)`);
      return;
    }

    const location = first.headers.get('location');
    if (!location) {
      failures.push(`${pathname}: 301 bez nagłówka Location`);
      return;
    }

    const followed = await fetch(new URL(location, url), {
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'szklarz-pruszkow-verify/1.0' },
    });

    if (followed.status !== 200) {
      failures.push(`${pathname}: 301 → ${location} → HTTP ${followed.status}`);
      return;
    }

    checkHtml(pathname, await followed.text());
  } catch (error) {
    failures.push(`${pathname}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const paths = readFileSync(URLS_FILE, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (baseUrl) {
    console.log(`Sprawdzam ${paths.length} adresów przeciwko ${baseUrl}…`);
    await mapLimit(paths, 6, verifyRemote);
  } else {
    if (!existsSync(DIST)) {
      console.error('✖ Brak katalogu dist/. Uruchom najpierw `npm run build`.');
      process.exit(1);
    }
    console.log(`Sprawdzam ${paths.length} adresów przeciwko ${DIST}/…`);
    for (const pathname of paths) verifyLocal(pathname);
  }

  if (warnings.length > 0) {
    console.warn(`\n⚠ Ostrzeżenia (${warnings.length}):`);
    for (const warning of warnings.slice(0, 20)) console.warn(`    ${warning}`);
    if (warnings.length > 20) console.warn(`    …i ${warnings.length - 20} więcej`);
  }

  if (failures.length > 0) {
    console.error(`\n✖ ${failures.length} problemów:`);
    for (const failure of failures.slice(0, 40)) console.error(`    ${failure}`);
    if (failures.length > 40) console.error(`    …i ${failures.length - 40} więcej`);
    process.exit(1);
  }

  console.log(`\n✔ Wszystkie ${paths.length} stare adresy zwracają 200 albo 301 → 200.`);
}

await main();
