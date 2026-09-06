let counter = 0;

/**
 * Kolejny identyfikator dla elementów `<defs>` w SVG.
 *
 * Gradienty muszą mieć unikalny `id` w obrębie dokumentu, a ten sam
 * komponent bywa na stronie kilka razy. Licznik zamiast `Math.random()`,
 * żeby dwa buildy tej samej treści dawały bajt w bajt ten sam HTML —
 * inaczej każdy deploy unieważniałby cache na wszystkich stronach.
 */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
