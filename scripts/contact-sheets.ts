import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Krok 2 migracji: składa ściągnięte zdjęcia w kontaktówki (siatki 5×4
 * z numerami), żeby dało się je obejrzeć hurtem i opisać.
 *
 * Powód: na starej stronie wszystkie 156 zdjęć ma `alt=""`. Alt-teksty
 * trzeba napisać od zera, a do tego trzeba te zdjęcia zobaczyć. Numer
 * wypalony w rogu kafla to indeks z data/gallery-source.json — po obejrzeniu
 * arkusza wystarczy przepisać numery do data/gallery.json.
 *
 * Wynik trafia do data/contact-sheets/ (w .gitignore — to materiał roboczy).
 */

const SOURCE_FILE = join('data', 'gallery-source.json');
const OUT_DIR = join('data', 'contact-sheets');

const COLS = 5;
const ROWS = 4;
const CELL = 320;
const LABEL = 26;

const PER_SHEET = COLS * ROWS;

interface SourceEntry {
  file: string;
  origin: string;
}

/** Kafel: zdjęcie wpasowane w kwadrat + pasek z numerem u dołu. */
async function cell(entry: SourceEntry, index: number): Promise<Buffer> {
  const photo = await sharp(readFileSync(entry.file))
    .rotate()
    .resize(CELL, CELL - LABEL, { fit: 'contain', background: '#101010' })
    .toBuffer();

  const caption = Buffer.from(
    `<svg width="${CELL}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${CELL}" height="${LABEL}" fill="#16BFA6"/>
       <text x="8" y="19" font-family="monospace" font-size="16" font-weight="bold"
             fill="#04252b">${String(index).padStart(3, '0')}</text>
     </svg>`,
  );

  return sharp({
    create: { width: CELL, height: CELL, channels: 3, background: '#101010' },
  })
    .composite([
      { input: photo, top: 0, left: 0 },
      { input: caption, top: CELL - LABEL, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const manifest = JSON.parse(readFileSync(SOURCE_FILE, 'utf8')) as Record<string, SourceEntry[]>;

  mkdirSync(OUT_DIR, { recursive: true });

  for (const [group, entries] of Object.entries(manifest)) {
    const sheets = Math.ceil(entries.length / PER_SHEET);

    for (let sheet = 0; sheet < sheets; sheet += 1) {
      const slice = entries.slice(sheet * PER_SHEET, (sheet + 1) * PER_SHEET);

      const tiles = await Promise.all(
        slice.map((entry, offset) => cell(entry, sheet * PER_SHEET + offset + 1)),
      );

      const target = join(OUT_DIR, `${group}-${sheet + 1}.jpg`);

      const composed = await sharp({
        create: {
          width: COLS * CELL,
          height: ROWS * CELL,
          channels: 3,
          background: '#101010',
        },
      })
        .composite(
          tiles.map((input, position) => ({
            input,
            left: (position % COLS) * CELL,
            top: Math.floor(position / COLS) * CELL,
          })),
        )
        .jpeg({ quality: 78 })
        .toBuffer();

      writeFileSync(target, composed);
      console.log(`✔ ${target} (${slice.length} zdjęć)`);
    }
  }
}

await main();
