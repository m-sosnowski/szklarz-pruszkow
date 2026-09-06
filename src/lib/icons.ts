/**
 * Zestaw ikon serwisu. Wszystkie rysowane jednym stylem (kontur, viewBox 24×24,
 * zaokrąglone końce), żeby nie ładować biblioteki ikon ani nie pilnować
 * spójności ręcznie.
 *
 * Klucze tej mapy są jednocześnie listą wyboru w panelu CMS (bloki „Wyróżniki"
 * i „Kroki"), więc dopisanie ikony tutaj od razu udostępnia ją redakcji.
 * Zgodności listy z `public/admin/config.yml` pilnuje check-cms-schema.
 */
export const ICONS = {
  /* --- branżowe --------------------------------------------------------- */

  /** Kabina prysznicowa: tafla z uchwytem i strumień z deszczownicy. */
  shower:
    '<path d="M4 21V6a3 3 0 0 1 6 0v15"/><path d="M4 21h6"/><path d="M13 4h7"/><path d="M16.5 4v3"/><path d="M13 10h7l-3.5-3z"/><path d="M15 14v1M18 14v1M16.5 17v1"/>',
  /** Tafla szkła w ujęciu perspektywicznym, z zaznaczoną krawędzią. */
  glass: '<path d="M4 3h13l3 18H7z"/><path d="M8 3 6 21"/><path d="M12.5 3 12 21"/>',
  /** Lustro: owal w ramie ze wspornikiem. */
  mirror:
    '<rect x="6" y="2" width="12" height="16" rx="6"/><path d="M12 18v4"/><path d="M8 22h8"/>',
  /** Rama do obrazu z passe-partout. */
  frame:
    '<rect x="2" y="3" width="20" height="18" rx="1"/><rect x="6" y="7" width="12" height="10" rx="1"/>',
  /** Piaskowanie: dysza i rozproszony strumień ścierniwa. */
  sandblast:
    '<path d="M3 8h6l4-3v14l-4-3H3z"/><path d="M17 7.5v.01M20 10v.01M17.5 13v.01M20.5 15v.01M17 17.5v.01"/>',
  /** Fartuch kuchenny ze szkła nad blatem. */
  kitchen:
    '<rect x="2" y="4" width="20" height="8" rx="1"/><path d="M2 15h20"/><path d="M6 15v6M18 15v6"/><path d="M2 21h20"/>',
  /** Balustrada szklana przy biegu schodów. */
  stairs: '<path d="M3 21V3"/><path d="M3 21h18"/><path d="M8 21v-5h5v-5h5V6"/>',
  /** Drzwi z szybą i klamką. */
  door: '<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M8 5h8v8H8z"/><circle cx="15.5" cy="17" r="1"/>',
  /** Suwmiarka — pomiar u klienta. */
  ruler:
    '<path d="m16 2 6 6L8 22l-6-6z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/>',

  /* --- ogólne ----------------------------------------------------------- */

  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="m8.2 13.4-1.4 8L12 19l5.2 2.4-1.4-8"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  truck:
    '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.3a2 2 0 0 0-.6-1.4L18 9h-4v8h3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  building: '<path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.8 2.8 0 0 1-4-4z"/><path d="m18 2 4 4"/>',
  bolt: '<path d="M13 2 3 14h8l-1 8 10-12h-8z"/>',
  lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',

  /* --- interfejs -------------------------------------------------------- */

  phone:
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.6-3.6"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
} as const;

export type IconName = keyof typeof ICONS;

/** Lista dla walidacji Zod i dla listy wyboru w config.yml. */
export const ICON_NAMES = Object.keys(ICONS) as [IconName, ...IconName[]];
