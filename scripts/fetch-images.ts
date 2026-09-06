import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBuffer, fetchText, mapLimit } from './lib/http';

/**
 * Krok 1 migracji: ściąga zdjęcia realizacji ze starego serwisu.
 *
 * Galerie na starej stronie robi Elementor. Każdy kafel to
 *
 *   <a class="e-gallery-item …" href="…/img_0027.jpg">
 *     <div class="e-gallery-image …" data-thumbnail="…/img_0027-300x225.jpg">
 *
 * czyli oryginał siedzi w `href` linku, a w `data-thumbnail` jest tylko
 * miniatura wygenerowana przez WordPressa. Bierzemy oryginały — miniatury
 * mają 300 px i nie nadają się do niczego poza kaflem.
 *
 * Kolejność zdjęć w dokumencie jest kolejnością, którą ktoś kiedyś ustawił
 * ręcznie w panelu; zachowujemy ją, bo niesie informację (zdjęcia tego
 * samego zlecenia leżą obok siebie).
 *
 * Wynik: data/raw-images/<grupa>/NNN-<nazwa>.jpg + data/gallery-source.json.
 * Katalog raw-images jest w .gitignore — do repo trafiają dopiero pliki
 * przepuszczone przez optimize-images.ts.
 */

const ORIGIN = 'https://szklarz.pruszkow.pl';
const RAW_DIR = join('data', 'raw-images');
const SOURCE_FILE = join('data', 'gallery-source.json');

/** Stara ścieżka → nazwa grupy, pod którą zdjęcia żyją w nowym serwisie. */
const GALLERIES = [
  { group: 'uslugi', path: '/uslugi_szklarskie/' },
  { group: 'oprawa', path: '/oprawa_obrazow/' },
  { group: 'piaskowanie', path: '/piaskowanie/' },
] as const;

/** Miniatury WordPressa mają w nazwie wymiary: `img_0027-300x225.jpg`. */
const THUMBNAIL = /-\d{2,4}x\d{2,4}\.(jpe?g|png)$/i;

const GALLERY_LINK = /<a\b[^>]*\bhref="([^"]+\.(?:jpe?g|png))"[^>]*>/gi;

function extractOriginals(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of html.matchAll(GALLERY_LINK)) {
    const url = match[1]!;
    if (!url.includes('/wp-content/uploads/')) continue;
    if (THUMBNAIL.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

interface SourceEntry {
  /** Ścieżka pliku w data/raw-images/, względem katalogu projektu. */
  file: string;
  /** Adres oryginału na starej stronie — do wglądu, gdyby coś nie grało. */
  origin: string;
}

async function main(): Promise<void> {
  const manifest: Record<string, SourceEntry[]> = {};
  let downloaded = 0;
  let skipped = 0;
  let bytes = 0;

  for (const gallery of GALLERIES) {
    const html = await fetchText(`${ORIGIN}${gallery.path}`);
    const urls = extractOriginals(html);

    console.log(`${gallery.path} → ${urls.length} zdjęć`);

    const dir = join(RAW_DIR, gallery.group);
    mkdirSync(dir, { recursive: true });

    const entries = await mapLimit(urls, 4, async (url, index) => {
      // Numer z kolejności w dokumencie zachowuje układ galerii,
      // a oryginalna nazwa pozwala wrócić do źródła przy weryfikacji.
      const original = url.split('/').pop()!.toLowerCase();
      const name = `${String(index + 1).padStart(3, '0')}-${original}`;
      const target = join(dir, name);

      if (existsSync(target)) {
        skipped += 1;
        return { file: target.replace(/\\/g, '/'), origin: url };
      }

      const { body, status } = await fetchBuffer(url);
      if (status !== 200) {
        throw new Error(`${url}: HTTP ${status}`);
      }

      writeFileSync(target, body);
      downloaded += 1;
      bytes += body.length;

      if (downloaded % 25 === 0) console.log(`  pobrano ${downloaded}…`);

      return { file: target.replace(/\\/g, '/'), origin: url };
    });

    manifest[gallery.group] = entries;
  }

  writeFileSync(SOURCE_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const total = Object.values(manifest).reduce((sum, list) => sum + list.length, 0);
  console.log(`\n✔ ${total} zdjęć w ${RAW_DIR} (pobrano ${downloaded}, pominięto ${skipped})`);
  console.log(`    ${(bytes / 1024 / 1024).toFixed(1)} MB pobrane`);
  console.log(`✔ Spis zapisany do ${SOURCE_FILE}`);
}

await main();
