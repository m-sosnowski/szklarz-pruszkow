import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Krok 3 migracji: data/raw-images/ → src/assets/images/.
 *
 * Normalizacja przed wrzuceniem do repo:
 *   · maks. 1600 px na dłuższym boku (oryginały mają 800 px, więc w praktyce
 *     nic się nie zmniejsza — limit jest po to, żeby nowe zdjęcia wgrywane
 *     kiedyś przez CMS też przez niego przeszły),
 *   · JPEG q82 mozjpeg, progresywny,
 *   · `.rotate()` przed stripem — orientacja z EXIF-u musi zostać zastosowana,
 *     zanim usuniemy metadane (siedzi w nich m.in. geolokalizacja klienta).
 *
 * Nazwy plików biorą się z klasyfikacji w data/gallery.json — `img_3604.jpg`
 * zamienia się w `kabina-prysznicowa-07.jpg`. Nazwa pliku to lekki sygnał dla
 * Google, ale przede wszystkim ratuje edytora w bibliotece mediów Sveltii.
 *
 * Skrypt jest jednocześnie bramką kompletności: jeśli któreś ze 156 zdjęć nie
 * ma wpisu w gallery.json (albo wpis wskazuje na nieistniejące zdjęcie),
 * kończy się błędem. Dzięki temu „użyj wszystkich zdjęć" jest sprawdzalne,
 * a nie deklaratywne.
 */

const SOURCE_FILE = join('data', 'gallery-source.json');
const GALLERY_FILE = join('data', 'gallery.json');
const OUT_DIR = join('src', 'assets', 'images');
const YAML_FILE = join('data', 'gallery-yaml.md');

const MAX_EDGE = 1600;
const QUALITY = 82;

const force = process.argv.includes('--force');

interface SourceEntry {
  file: string;
  origin: string;
}

interface GalleryItem {
  source: string;
  n: number;
  dir: string;
  stem: string;
  alt: string;
}

async function main(): Promise<void> {
  const sources = JSON.parse(readFileSync(SOURCE_FILE, 'utf8')) as Record<string, SourceEntry[]>;
  const { items } = JSON.parse(readFileSync(GALLERY_FILE, 'utf8')) as { items: GalleryItem[] };

  /* ---- bramka kompletności: każde zdjęcie dokładnie raz ---- */

  const available = new Set<string>();
  for (const [group, entries] of Object.entries(sources)) {
    entries.forEach((_, index) => available.add(`${group}/${index + 1}`));
  }

  const problems: string[] = [];
  const claimed = new Set<string>();

  for (const item of items) {
    const key = `${item.source}/${item.n}`;
    if (!available.has(key)) problems.push(`gallery.json wskazuje na nieistniejące zdjęcie ${key}`);
    if (claimed.has(key)) problems.push(`zdjęcie ${key} użyte więcej niż raz`);
    claimed.add(key);
  }

  for (const key of available) {
    if (!claimed.has(key)) problems.push(`zdjęcie ${key} nie ma wpisu w gallery.json`);
  }

  if (problems.length > 0) {
    console.error(`✖ ${problems.length} problemów z klasyfikacją:`);
    for (const problem of problems.slice(0, 30)) console.error(`    ${problem}`);
    if (problems.length > 30) console.error(`    …i ${problems.length - 30} więcej`);
    process.exit(1);
  }

  /* ---- przetwarzanie ---- */

  /** dir/stem → ile plików już zapisano, dla numeracji. */
  const counters = new Map<string, number>();
  /** dir/stem → wpisy do wklejenia w frontmatter. */
  const yaml = new Map<string, { src: string; alt: string }[]>();

  let written = 0;
  let reused = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for (const item of items) {
    const entry = sources[item.source]![item.n - 1]!;
    const stemKey = `${item.dir}/${item.stem}`;

    const index = (counters.get(stemKey) ?? 0) + 1;
    counters.set(stemKey, index);

    const name = `${item.stem}-${String(index).padStart(2, '0')}.jpg`;
    const target = join(OUT_DIR, item.dir, name);

    // Ścieżka absolutna od katalogu projektu — tak Astro i Sveltia rozwiązują
    // odwołania do zasobów z frontmatteru.
    const publicPath = `/${OUT_DIR}/${item.dir}/${name}`.replace(/\\/g, '/');

    if (!yaml.has(stemKey)) yaml.set(stemKey, []);
    yaml.get(stemKey)!.push({ src: publicPath, alt: item.alt });

    if (!force && existsSync(target)) {
      reused += 1;
      continue;
    }

    const raw = readFileSync(entry.file);
    mkdirSync(join(OUT_DIR, item.dir), { recursive: true });

    const output = await sharp(raw)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();

    writeFileSync(target, output);

    bytesIn += raw.length;
    bytesOut += output.length;
    written += 1;

    if (written % 40 === 0) console.log(`  przetworzono ${written}…`);
  }

  /* ---- gotowe fragmenty YAML do wklejenia w treść stron ---- */

  const lines: string[] = [
    '<!-- Plik roboczy: wygenerowane przez scripts/optimize-images.ts.',
    '     Gotowe listy zdjęć do wklejenia w bloki `imageGallery` w src/content/pages/. -->',
    '',
  ];

  for (const [stemKey, entries] of [...yaml].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${stemKey} (${entries.length})`, '', '```yaml', '    images:');
    for (const { src, alt } of entries) {
      lines.push(`      - src: "${src}"`, `        alt: "${alt}"`);
    }
    lines.push('```', '');
  }

  writeFileSync(YAML_FILE, `${lines.join('\n')}\n`, 'utf8');

  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  console.log(`\n✔ ${items.length} zdjęć w ${OUT_DIR} (zapisano ${written}, bez zmian ${reused})`);
  if (bytesIn > 0) {
    console.log(
      `    rozmiar: ${mb(bytesIn)} → ${mb(bytesOut)} ` +
        `(${Math.round((1 - bytesOut / bytesIn) * 100)}% mniej)`,
    );
  }
  console.log(`✔ Fragmenty YAML zapisane do ${YAML_FILE}`);
}

await main();
