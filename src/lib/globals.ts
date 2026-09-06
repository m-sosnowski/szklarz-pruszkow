import { parse as parseYaml } from 'yaml';
import { z } from 'astro/zod';
import siteRaw from '../data/site.yml?raw';
import navigationRaw from '../data/navigation.yml?raw';

/**
 * Dane globalne serwisu. Sveltia zapisuje je jako pojedyncze pliki YAML
 * (kolekcje typu `files`), a tutaj są parsowane i walidowane raz, przy buildzie.
 *
 * Świadomie poza Content Collections: `file()` rozbiłby mapę YAML na osobne
 * wpisy po każdym kluczu najwyższego poziomu. Walidacja Zod jest ta sama,
 * a dostęp z komponentów jest synchroniczny.
 */

const siteSchema = z.object({
  companyName: z.string().min(1),
  legalName: z.string().default(''),
  tagline: z.string().min(1),
  contactPerson: z.string().default(''),
  phone: z.string().min(1),
  phoneHref: z.string().regex(/^\+?[0-9]+$/, 'phoneHref musi być numerem bez spacji'),
  /** Numer WhatsApp do linku wa.me; puste = używamy `phoneHref`. */
  whatsapp: z
    .string()
    .regex(/^$|^\+?[0-9]+$/, 'whatsapp musi być numerem bez spacji')
    .default(''),
  email: z.email(),
  /** Klucz Web3Forms; puste = formularz kontaktowy działa przez mailto. */
  web3formsKey: z.string().default(''),
  nip: z.string().default(''),
  /** Rok założenia — trafia do JSON-LD i do liczby lat na stronie głównej. */
  foundedYear: z.number().int().min(1900).max(2100).optional(),
  address: z
    .object({
      street: z.string().default(''),
      city: z.string().min(1),
      postalCode: z.string().default(''),
      region: z.string().default('mazowieckie'),
      country: z.string().default('PL'),
      publicOffice: z.boolean().default(false),
    })
    .optional(),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
  openingHours: z.array(z.object({ days: z.string(), hours: z.string() })).default([]),
  priceRange: z.string().default('$$'),
  areaServed: z
    .array(z.object({ name: z.string(), slug: z.string().optional() }))
    .default([]),
  /** Zakres usług — wchodzi do JSON-LD jako `makesOffer` i `knowsAbout`. */
  services: z
    .array(z.object({ name: z.string(), href: z.string().optional() }))
    .default([]),
  social: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
});

const navLink = z.object({ label: z.string(), href: z.string() });

// Serwis ma sześć stron i płaskie menu — bez rozwijanych podmenu.
const navigationSchema = z.object({
  main: z.array(navLink).default([]),
  footer: z
    .array(z.object({ heading: z.string(), links: z.array(navLink).default([]) }))
    .default([]),
});

function load<T>(schema: z.ZodType<T>, raw: string, filename: string): T {
  const result = schema.safeParse(parseYaml(raw));
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Błąd walidacji src/data/${filename}:\n${issues}`);
  }
  return result.data;
}

export const site = load(siteSchema, siteRaw, 'site.yml');
export const navigation = load(navigationSchema, navigationRaw, 'navigation.yml');

export type Site = typeof site;
export type Navigation = typeof navigation;
