import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * Kopiuje bundle Sveltia CMS z node_modules do public/admin/.
 *
 * Panel celowo nie jest ładowany z CDN-a: dzięki temu CSP nie musi otwierać
 * zewnętrznego hosta (`script-src 'self'`), a dostępność panelu nie zależy
 * od cudzego serwera. Wersja CMS-a jest przypięta w package-lock.json.
 *
 * Pakiet eksportuje wyłącznie build ESM (`sveltia-cms.mjs`) — i to jego
 * chcemy, bo public/admin/index.html ładuje skrypt jako `type="module"`.
 */

const require = createRequire(import.meta.url);

const source = require.resolve('@sveltia/cms');
const target = join('public', 'admin', 'sveltia-cms.js');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

// Mapa źródeł vendorowego bundle'a waży ~7,7 MB, a nikt jej nie debuguje
// na produkcji — świadomie nie trafia do deploymentu.

// package.json pakietu nie jest w mapie `exports`, więc czytamy je ścieżką.
const manifest = JSON.parse(
  readFileSync(join(dirname(source), '..', 'package.json'), 'utf8'),
) as { version: string };

console.log(`✔ Sveltia CMS ${manifest.version} skopiowana do ${target}`);
