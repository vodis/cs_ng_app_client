import { toRouteTemplate } from './telemetry-route';

describe('toRouteTemplate', () => {
  it('replaces dynamic segments with [id] and drops the query string', () => {
    expect(toRouteTemplate('/swap/9f2c4a1b8d?x=1')).toBe('/swap/[id]');
    expect(
      toRouteTemplate('/en/swap/3f1c2d4e-1111-4222-8333-944455556666#top')
    ).toBe('/en/swap/[id]');
    expect(toRouteTemplate('/portfolio/0xAbC123?tab=2')).toBe(
      '/portfolio/[id]'
    );
    expect(toRouteTemplate('/profile/alice.near')).toBe('/profile/[id]');
    expect(toRouteTemplate('/profile/user%40example.com')).toBe(
      '/profile/[id]'
    );
    expect(toRouteTemplate('/orders/12345/details')).toBe(
      '/orders/[id]/details'
    );
  });

  it('keeps static route words and handles the root', () => {
    expect(toRouteTemplate('/en/farm?ref=abc')).toBe('/en/farm');
    expect(toRouteTemplate('/proposals/')).toBe('/proposals');
    expect(toRouteTemplate('/?x=1')).toBe('/');
    expect(toRouteTemplate('')).toBe('/');
  });
});
