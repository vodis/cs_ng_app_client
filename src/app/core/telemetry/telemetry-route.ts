/**
 * Turns a real URL into a route template that is safe to send as analytics:
 * query string and fragment are dropped and every dynamic-looking segment
 * becomes `[id]` (`/swap/9f2c…?x=1` -> `/swap/[id]`).
 *
 * Only plain lowercase/uppercase words (optionally dash-separated) are kept as
 * static segments; anything with digits, dots, `@`, `%`, `:`, non-ASCII or an
 * unusual length is treated as an identifier.
 */
const STATIC_SEGMENT = /^[A-Za-z]+(?:-[A-Za-z]+)*$/;
const MAX_STATIC_SEGMENT_LENGTH = 24;

export function toRouteTemplate(url: string): string {
  const path = (url ?? '').split(/[?#]/, 1)[0];
  const segments = path.split('/').filter(segment => segment.length > 0);
  if (segments.length === 0) return '/';
  return (
    '/' +
    segments
      .map(segment =>
        STATIC_SEGMENT.test(segment) &&
        segment.length <= MAX_STATIC_SEGMENT_LENGTH
          ? segment
          : '[id]'
      )
      .join('/')
  );
}
