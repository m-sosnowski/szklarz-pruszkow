/**
 * Reguły widoczności treści, wspólne dla wszystkich szablonów.
 */

/**
 * Szkice są ukryte na produkcji, ale widoczne w dev i na preview
 * deploymentach Cloudflare — dzięki temu da się obejrzeć wpis przed
 * publikacją, nie wystawiając go Google'owi (preview ma `noindex`).
 */
const showDrafts =
  import.meta.env.DEV ||
  (import.meta.env.CF_PAGES_BRANCH !== undefined && import.meta.env.CF_PAGES_BRANCH !== 'main');

export function isPublished(entry: { data: { draft?: boolean } }): boolean {
  return showDrafts || entry.data.draft !== true;
}
