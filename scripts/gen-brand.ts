import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Generuje pliki graficzne marki: favicon.svg, favicon.ico i obrazek Open Graph.
 *
 * Stary serwis nie miał ani favikony, ani og:image — link wklejony na
 * Facebooka czy do Messengera pokazywał gołe URL-e. Wynik jest commitowany
 * do repo; skrypt uruchamiamy tylko wtedy, gdy zmienia się znak firmowy.
 */

const OUT_PUBLIC = 'public';
const OG_DIR = join(OUT_PUBLIC, 'og');

const INK = '#0b1f26';
const DEEP = '#123640';
const ACCENT = '#16bfa6';
const ACCENT_2 = '#7fd9e8';

/** Sygnet — ten sam rysunek co w src/components/ui/Logo.astro. */
const mark = (scale: number, x: number, y: number) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M13 3h18l-5 28H8z" fill="#ffffff" opacity=".18"/>
    <path d="M3 3h18l-5 28H8z" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <path d="M9 8h5l-3 18H8z" fill="${ACCENT}" opacity=".3"/>
  </g>`;

/* --- favicon.svg ---------------------------------------------------------- */

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${INK}"/>
  ${mark(1.5, 6, 6)}
</svg>
`;

mkdirSync(OUT_PUBLIC, { recursive: true });
writeFileSync(join(OUT_PUBLIC, 'favicon.svg'), faviconSvg, 'utf8');

/* --- favicon.ico ---------------------------------------------------------- */

/**
 * sharp nie zapisuje ICO, ale format dopuszcza PNG w środku — wystarczy
 * doklejić 22-bajtowy nagłówek. Jedna ikona 32×32 w zupełności wystarcza;
 * większe rozmiary przeglądarki i tak biorą z favicon.svg.
 */
function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // zarezerwowane
  header.writeUInt16LE(1, 2); // typ: ikona
  header.writeUInt16LE(1, 4); // liczba obrazów

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // szerokość (0 = 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1); // wysokość
  entry.writeUInt8(0, 2); // paleta
  entry.writeUInt8(0, 3); // zarezerwowane
  entry.writeUInt16LE(1, 4); // płaszczyzny
  entry.writeUInt16LE(32, 6); // bitów na piksel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const iconPng = await sharp(Buffer.from(faviconSvg)).resize(32, 32).png().toBuffer();
writeFileSync(join(OUT_PUBLIC, 'favicon.ico'), icoFromPng(iconPng, 32));

/* --- og/default.png ------------------------------------------------------- */

const FONT = 'Sora, "Segoe UI", Arial, sans-serif';

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${INK}"/>
      <stop offset="55%" stop-color="#0f2c34"/>
      <stop offset="100%" stop-color="${DEEP}"/>
    </linearGradient>
    <linearGradient id="pane" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT_2}" stop-opacity=".16"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- pasma refrakcji, jak na hero strony -->
  <path d="M760 -40 980 -40 700 670 480 670z" fill="url(#pane)"/>
  <path d="M1010 -40 1120 -40 840 670 730 670z" fill="url(#pane)"/>
  <g stroke="${ACCENT_2}" stroke-opacity=".22" stroke-width="1.5">
    <path d="M760 -40 480 670"/>
    <path d="M980 -40 700 670"/>
    <path d="M1120 -40 840 670"/>
  </g>

  ${mark(2.6, 96, 92)}

  <text x="190" y="150" font-family='${FONT}' font-size="62" font-weight="700"
        fill="#ffffff" letter-spacing="2">SZKLARZ</text>
  <text x="192" y="186" font-family='${FONT}' font-size="21" font-weight="600"
        fill="${ACCENT}" letter-spacing="4.5">TOMASZ SOSNOWSKI</text>

  <text x="96" y="330" font-family='${FONT}' font-size="60" font-weight="700" fill="#ffffff">
    Usługi szklarskie
  </text>
  <text x="96" y="404" font-family='${FONT}' font-size="60" font-weight="700" fill="#ffffff">
    Pruszków i okolice
  </text>

  <text x="96" y="470" font-family='${FONT}' font-size="27" fill="#a8c5cb">
    Kabiny · lustra · szkło do kuchni · oprawa obrazów · piaskowanie
  </text>

  <rect x="96" y="512" width="278" height="62" fill="${ACCENT}"/>
  <text x="235" y="553" font-family='${FONT}' font-size="29" font-weight="700"
        fill="#04252b" text-anchor="middle">602 230 068</text>

  <text x="1104" y="553" font-family='${FONT}' font-size="22" fill="#7fa3ac"
        text-anchor="end">szklarz.pruszkow.pl · od 1985</text>
</svg>`;

mkdirSync(OG_DIR, { recursive: true });
await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(join(OG_DIR, 'default.png'));

console.log('✔ public/favicon.svg');
console.log('✔ public/favicon.ico');
console.log('✔ public/og/default.png');
