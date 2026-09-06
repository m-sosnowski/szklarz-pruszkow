import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bramka jakości dla zdjęć. Pilnuje trzech rzeczy naraz:
 *
 *   1. każda ścieżka użyta w treści wskazuje na istniejący plik,
 *   2. `alt` przy zdjęciu z migracji zgadza się z data/gallery.json —
 *      opisy mają jedno źródło prawdy, a nie kopie rozjeżdżające się
 *      po sześciu plikach Markdown,
 *   3. wszystkie 156 zdjęć ze starego serwisu jest gdzieś użyte.
 *
 * Punkt 3 to warunek postawiony wprost przy planowaniu przebudowy
 * („użyj wszystkich zdjęć"). Bez testu byłby deklaracją; z testem
 * jest czymś, co się sprawdza jednym poleceniem.
 */

const PAGES_DIR = join('src', 'content', 'pages');
const GALLERY_FILE = join('data', 'gallery.json');
const IMAGES_ROOT = 'src/assets/images';

interface GalleryItem {
  dir: string;
  stem: string;
  alt: string;
}

/* --- oczekiwane pary ścieżka → alt, wyliczone tak samo jak w optimize-images --- */

const { items } = JSON.parse(readFileSync(GALLERY_FILE, 'utf8')) as { items: GalleryItem[] };

const counters = new Map<string, number>();
const expectedAlt = new Map<string, string>();

for (const item of items) {
  const key = `${item.dir}/${item.stem}`;
  const index = (counters.get(key) ?? 0) + 1;
  counters.set(key, index);
  expectedAlt.set(
    `/${IMAGES_ROOT}/${item.dir}/${item.stem}-${String(index).padStart(2, '0')}.jpg`,
    item.alt,
  );
}

/* --- odczyt odwołań z treści --- */

/** `src: "…"`, `image: "…"` oraz `imageAlt: "…"` we frontmatterze. */
const REFERENCE = /^\s*(?:-\s*)?(src|image):\s*"([^"]+)"\s*$/gm;
const ALT = /^\s*(?:-\s*)?(alt|imageAlt):\s*"([^"]+)"\s*$/gm;

const problems: string[] = [];
const used = new Set<string>();

for (const file of readdirSync(PAGES_DIR).filter((name) => name.endsWith('.md'))) {
  const source = readFileSync(join(PAGES_DIR, file), 'utf8');
  const lines = source.split(/\r?\n/);

  const references = [...source.matchAll(REFERENCE)];
  const alts = [...source.matchAll(ALT)];

  for (const match of references) {
    const path = match[2]!;
    if (!path.startsWith(`/${IMAGES_ROOT}/`)) continue;

    used.add(path);

    if (!existsSync(path.slice(1))) {
      problems.push(`${file}: brak pliku ${path}`);
      continue;
    }

    // `alt` stoi zawsze w linii bezpośrednio po `src`/`image`.
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    const next = lines[line] ?? '';
    const altMatch = /^\s*(?:alt|imageAlt):\s*"([^"]+)"\s*$/.exec(next);

    if (!altMatch) {
      problems.push(`${file}:${line + 1}: zdjęcie ${path} bez alt-tekstu w kolejnej linii`);
      continue;
    }

    const expected = expectedAlt.get(path);
    if (expected && altMatch[1] !== expected) {
      problems.push(
        `${file}:${line + 1}: alt dla ${path}\n` +
          `        jest:      "${altMatch[1]}"\n` +
          `        powinien:  "${expected}"`,
      );
    }
  }

  if (alts.length < references.filter((m) => m[2]!.startsWith(`/${IMAGES_ROOT}/`)).length) {
    problems.push(`${file}: mniej alt-tekstów niż zdjęć`);
  }
}

/* --- czy wszystkie zdjęcia z migracji trafiły na stronę --- */

const unused = [...expectedAlt.keys()].filter((path) => !used.has(path));
if (unused.length > 0) {
  problems.push(`${unused.length} zdjęć z migracji nie jest użytych na żadnej stronie:`);
  for (const path of unused.slice(0, 10)) problems.push(`        ${path}`);
  if (unused.length > 10) problems.push(`        …i ${unused.length - 10} więcej`);
}

/* --- osierocone pliki w repo --- */

const onDisk: string[] = [];
for (const dir of readdirSync(IMAGES_ROOT, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const file of readdirSync(join(IMAGES_ROOT, dir.name))) {
    onDisk.push(`/${IMAGES_ROOT}/${dir.name}/${file}`);
  }
}

const orphans = onDisk.filter((path) => !used.has(path));
if (orphans.length > 0) {
  problems.push(`${orphans.length} plików leży w repo, ale nie jest nigdzie użytych:`);
  for (const path of orphans.slice(0, 10)) problems.push(`        ${path}`);
}

/* --- wynik --- */

if (problems.length > 0) {
  console.error(`✖ ${problems.length} problemów ze zdjęciami:\n`);
  for (const problem of problems) console.error(`    ${problem}`);
  process.exit(1);
}

console.log(`✔ ${used.size} zdjęć: pliki istnieją, alt-teksty zgodne, żadne nie zostało pominięte.`);
