import { site } from './globals';
import { absoluteUrl, SITE_URL } from './seo';

/**
 * Generatory JSON-LD. Stara strona nie miała żadnych danych strukturalnych —
 * dla zakładu, którego klienci szukają frazą „szklarz Pruszków", to była
 * największa pojedyncza strata w wyszukiwarce.
 *
 * `@id` są stabilne i wzajemnie się referencują, żeby Google widział
 * jeden graf zamiast kilku niepowiązanych wysepek.
 */

export const ORGANIZATION_ID = `${SITE_URL}/#zaklad`;
export const WEBSITE_ID = `${SITE_URL}/#strona`;

type Json = Record<string, unknown>;

/** Usuwa puste gałęzie, żeby nie emitować `"streetAddress": ""` ani `null`. */
function compact<T extends Json>(value: T): T {
  const out: Json = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || val === null || val === '') continue;
    if (Array.isArray(val) && val.length === 0) continue;
    out[key] = val;
  }
  return out as T;
}

function postalAddress(): Json | undefined {
  const address = site.address;
  if (!address) return undefined;
  return compact({
    '@type': 'PostalAddress',
    streetAddress: address.publicOffice ? address.street : '',
    addressLocality: address.city,
    postalCode: address.publicOffice ? address.postalCode : '',
    addressRegion: address.region,
    addressCountry: address.country,
  });
}

/**
 * Mapuje „Poniedziałek – Piątek" / „10:00 – 17:00" na format schema.org.
 * Pomija wpisy, których nie umie odczytać — lepiej nie podać godzin,
 * niż wyemitować niepoprawny `openingHoursSpecification`.
 */
const DAY_CODES: Record<string, string> = {
  poniedziałek: 'Mo',
  wtorek: 'Tu',
  środa: 'We',
  czwartek: 'Th',
  piątek: 'Fr',
  sobota: 'Sa',
  niedziela: 'Su',
};

const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function openingHoursSpecification(): Json[] {
  const specs: Json[] = [];

  for (const entry of site.openingHours) {
    const days = entry.days
      .toLowerCase()
      .split(/[–—-]/)
      .map((part) => DAY_CODES[part.trim()])
      .filter((code): code is string => Boolean(code));
    const hours = entry.hours.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
    if (days.length === 0 || !hours) continue;

    const dayOfWeek =
      days.length === 2
        ? DAY_ORDER.slice(DAY_ORDER.indexOf(days[0]!), DAY_ORDER.indexOf(days[1]!) + 1)
        : days;

    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek,
      opens: hours[1],
      closes: hours[2],
    });
  }

  return specs;
}

/**
 * schema.org nie ma typu „szklarz", więc bazą jest LocalBusiness,
 * a `additionalType` wskazuje na odpowiednik z Wikidanych (Q1892459 —
 * zakład szklarski). Google czyta LocalBusiness, a `additionalType`
 * doprecyzowuje branżę dla tych, którzy potrafią go użyć.
 */
export function localBusinessSchema(): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': ORGANIZATION_ID,
    additionalType: 'https://www.wikidata.org/wiki/Q1892459',
    name: site.companyName,
    legalName: site.legalName || undefined,
    description: site.tagline,
    url: SITE_URL,
    telephone: site.phone,
    email: site.email,
    priceRange: site.priceRange,
    foundingDate: site.foundedYear ? String(site.foundedYear) : undefined,
    founder: site.contactPerson
      ? { '@type': 'Person', name: site.contactPerson }
      : undefined,
    address: postalAddress(),
    geo: site.geo
      ? { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng }
      : undefined,
    areaServed: site.areaServed.map((area) => ({ '@type': 'City', name: area.name })),
    openingHoursSpecification: openingHoursSpecification(),
    sameAs: site.social.map((profile) => profile.href),
    vatID: site.nip || undefined,
    knowsAbout: site.services.map((service) => service.name),
    hasOfferCatalog:
      site.services.length > 0
        ? {
            '@type': 'OfferCatalog',
            name: `Oferta — ${site.companyName}`,
            itemListElement: site.services.map((service) => ({
              '@type': 'Offer',
              itemOffered: compact({
                '@type': 'Service',
                name: service.name,
                url: service.href ? absoluteUrl(service.href) : undefined,
                provider: { '@id': ORGANIZATION_ID },
              }),
            })),
          }
        : undefined,
  });
}

export function webSiteSchema(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: site.companyName,
    inLanguage: 'pl-PL',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbSchema(crumbs: Crumb[]): Json | undefined {
  // Pojedynczy okruszek to sama strona główna — nie ma czego opisywać.
  if (crumbs.length < 2) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.href),
    })),
  };
}

/** Graf usługi dla podstron ofertowych: /uslugi-szklarskie, /piaskowanie… */
export function serviceSchema(service: {
  name: string;
  description: string;
  pathname: string;
}): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    url: absoluteUrl(service.pathname),
    serviceType: service.name,
    provider: { '@id': ORGANIZATION_ID },
    areaServed: site.areaServed.map((area) => ({ '@type': 'City', name: area.name })),
  });
}

export function faqSchema(items: { question: string; answer: string }[]): Json | undefined {
  if (items.length === 0) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function imageGallerySchema(gallery: {
  title: string;
  pathname: string;
  images: { url: string; alt: string }[];
}): Json | undefined {
  if (gallery.images.length === 0) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: gallery.title,
    url: absoluteUrl(gallery.pathname),
    image: gallery.images.map((image) => ({
      '@type': 'ImageObject',
      contentUrl: image.url,
      name: image.alt,
    })),
  };
}
