import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

/**
 * Model treści jest opisany w dwóch miejscach: `public/admin/config.yml`
 * (dla edytora) i `src/content.config.ts` (dla builda). Ten skrypt pilnuje,
 * żeby się nie rozjechały — bo rozjazd objawia się dopiero tym, że edytor
 * zapisuje pole, którego build nie zna, albo odwrotnie.
 *
 * Porównujemy nazwy pól, nie ich typy: pełne odwzorowanie typów wymagałoby
 * parsowania TypeScriptu, a 90% realnych pomyłek to literówka albo pole
 * dodane tylko po jednej stronie.
 */

interface CmsField {
  name: string;
  widget?: string;
  fields?: CmsField[];
  field?: CmsField;
  types?: CmsField[];
  required?: boolean;
}

interface CmsCollection {
  name: string;
  folder?: string;
  files?: { name: string; file: string; fields: CmsField[] }[];
  fields?: CmsField[];
}

const problems: string[] = [];
const note = (message: string) => problems.push(message);

/* --------------------------------------------------------------------------
   1. config.yml musi być poprawnym YAML-em z rozwiązywalnymi kotwicami
   -------------------------------------------------------------------------- */

const configRaw = readFileSync('public/admin/config.yml', 'utf8');
let config: { collections?: CmsCollection[]; media_folder?: string; public_folder?: string; backend?: { repo?: string } };

try {
  config = parseYaml(configRaw);
} catch (error) {
  console.error('✖ public/admin/config.yml nie jest poprawnym YAML-em:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const collections = config.collections ?? [];
if (collections.length === 0) {
  note('config.yml nie definiuje żadnej kolekcji.');
}

/* --------------------------------------------------------------------------
   2. Media muszą trafiać do src/assets/, inaczej omijają astro:assets
   -------------------------------------------------------------------------- */

if (!config.media_folder?.startsWith('src/assets/')) {
  note(
    `media_folder musi wskazywać na src/assets/… (jest: "${config.media_folder}"). ` +
      'W public/ zdjęcia omijają optymalizację astro:assets.',
  );
}

// Sveltia odrzuca ścieżki względne („must be an absolute path starting with /"),
// a Astro rozwiązuje absolutne resolverem Vite od katalogu projektu — nie z
// public/. Obie strony są zadowolone tylko przy /src/assets/… .
if (!config.public_folder?.startsWith('/src/assets/')) {
  note(
    `public_folder musi zaczynać się od /src/assets/ (jest: "${config.public_folder}"). ` +
      'Sveltia wymaga ścieżki absolutnej, a poza src/assets/ zdjęcia omijają astro:assets.',
  );
}

/* --------------------------------------------------------------------------
   3. Zbiór pól po obu stronach
   -------------------------------------------------------------------------- */

/** Spłaszcza drzewo pól CMS do ścieżek typu `hero.ctaPrimary.label`. */
function fieldPaths(fields: CmsField[] | undefined, prefix = ''): Set<string> {
  const paths = new Set<string>();
  for (const field of fields ?? []) {
    if (!field?.name) continue;
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    paths.add(path);
    for (const nested of fieldPaths(field.fields, path)) paths.add(nested);
    if (field.field) for (const nested of fieldPaths([field.field], path)) paths.add(nested);
    // `types` to warianty bloku — nazwa wariantu odpowiada wartości `type`
    // w discriminatedUnion, więc porównujemy ją osobno.
    for (const variant of field.types ?? []) {
      paths.add(`${path}[${variant.name}]`);
      for (const nested of fieldPaths(variant.fields, `${path}[${variant.name}]`)) {
        paths.add(nested);
      }
    }
  }
  return paths;
}

const contentConfig = readFileSync('src/content.config.ts', 'utf8');

/** Nazwy wariantów bloków zadeklarowane po stronie Zod. */
const zodBlockTypes = new Set(
  [...contentConfig.matchAll(/z\.literal\('([^']+)'\)/g)].map((match) => match[1]!),
);

/** Nazwy kolekcji eksportowane przez content.config.ts. */
const collectionsBlock = contentConfig.slice(contentConfig.lastIndexOf('export const collections'));
const zodCollections = new Set(
  [...collectionsBlock.matchAll(/^\s*'?([a-zA-Z-]+)'?\s*[,:]/gm)].map((match) => match[1]!),
);

/* --------------------------------------------------------------------------
   4. Porównania
   -------------------------------------------------------------------------- */

const cmsContentCollections = collections.filter((collection) => collection.folder);

for (const collection of cmsContentCollections) {
  if (!zodCollections.has(collection.name)) {
    note(
      `Kolekcja "${collection.name}" jest w config.yml, ale nie ma jej w content.config.ts.`,
    );
  }

  const folder = collection.folder!;
  const expected = `base: './${folder}'`;
  if (!contentConfig.includes(expected)) {
    note(
      `Kolekcja "${collection.name}" wskazuje folder "${folder}", ` +
        `ale content.config.ts nie ładuje go przez ${expected}.`,
    );
  }
}

for (const name of zodCollections) {
  if (!cmsContentCollections.some((collection) => collection.name === name)) {
    note(`Kolekcja "${name}" jest w content.config.ts, ale nie ma jej w config.yml.`);
  }
}

// Warianty bloków muszą się zgadzać co do joty — to one decydują,
// który komponent wyrenderuje treść zapisaną w panelu.
const cmsBlockTypes = new Set<string>();
for (const collection of collections) {
  for (const path of fieldPaths(collection.fields)) {
    const match = path.match(/^blocks\[([^\]]+)\]$/);
    if (match) cmsBlockTypes.add(match[1]!);
  }
}

for (const type of cmsBlockTypes) {
  if (!zodBlockTypes.has(type)) {
    note(`Blok "${type}" jest w config.yml, ale content.config.ts go nie zna.`);
  }
}

for (const type of zodBlockTypes) {
  if (!cmsBlockTypes.has(type)) {
    note(`Blok "${type}" jest w content.config.ts, ale nie da się go dodać z panelu.`);
  }
}

// Pola danych globalnych muszą pokrywać się z walidacją w src/lib/globals.ts.
const globals = readFileSync('src/lib/globals.ts', 'utf8');
const settings = collections.find((collection) => collection.files);

for (const fileEntry of settings?.files ?? []) {
  for (const field of fileEntry.fields ?? []) {
    if (!field?.name) continue;
    if (!new RegExp(`\\b${field.name}\\s*:`).test(globals)) {
      note(
        `Pole "${fileEntry.name}.${field.name}" z config.yml nie ma odpowiednika ` +
          'w schemacie src/lib/globals.ts.',
      );
    }
  }
}

// Repozytorium backendu musi być podmienione przed wdrożeniem produkcyjnym.
if (config.backend?.repo?.startsWith('OWNER/')) {
  const message = 'backend.repo w config.yml to wciąż placeholder "OWNER/…".';
  if (process.env['CI'] && process.env['CF_PAGES_BRANCH'] === 'main') {
    note(message);
  } else {
    console.warn(`⚠ ${message} Do czasu wdrożenia to w porządku.`);
  }
}

/* -------------------------------------------------------------------------- */

if (problems.length > 0) {
  console.error(`✖ Model treści rozjechał się między config.yml a content.config.ts:\n`);
  for (const problem of problems) console.error(`  · ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('✔ config.yml i content.config.ts opisują ten sam model treści.');
