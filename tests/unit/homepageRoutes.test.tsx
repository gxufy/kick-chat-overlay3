/* Homepage and classic-route wiring.
 *
 * These are the links a new user actually follows, and they are the kind of thing
 * that rots silently: nothing fails to build when a card points at a path that
 * has moved, and nobody notices until someone lands on a redirect or a 404. The
 * canonical hrefs are asserted directly rather than through a helper, because
 * hardcoded strings in JSX are exactly what could drift.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import HomePage from '@/pages/index';
import ClassicMultichatPage from '@/pages/classic/multichat';
import {
  CANONICAL_COUNTER_ROUTE,
  CANONICAL_MULTICHAT_ROUTE,
} from '@/lib/multichatRouting';
import { OAUTH_RETURN_CLASSIC } from '@/lib/oauthReturn';

const replace = vi.fn();
let query: Record<string, string> = {};

vi.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query, replace }),
}));

/* next/head renders nothing in jsdom, so its children are asserted by walking
   the element tree the page returns rather than by querying the document. */
vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  replace.mockClear();
  query = {};
});

afterEach(cleanup);

const hrefs = () =>
  Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'));

describe('homepage product cards', () => {
  it('links both generators at their canonical routes', () => {
    render(<HomePage />);
    expect(hrefs()).toContain(CANONICAL_MULTICHAT_ROUTE);
    expect(hrefs()).toContain(CANONICAL_COUNTER_ROUTE);
  });

  /* /multichat still serves the overlay and forwards a channel-less visit to
     the workspace, so linking it here would only add a redirect hop. */
  it('never links the legacy generator path', () => {
    render(<HomePage />);
    expect(hrefs()).not.toContain('/multichat');
    expect(hrefs()).not.toContain('/multichat?tab=counter');
  });

  it('gives each card a reachable call to action', () => {
    render(<HomePage />);
    const cards = Array.from(document.querySelectorAll('a.card'));
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.getAttribute('href')).toMatch(/^\/tools\//);
      expect(card.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it('points the footer at the canonical workspace', () => {
    render(<HomePage />);
    const footer = document.querySelector('footer');
    const link = footer?.querySelector('a[href]');
    expect(link?.getAttribute('href')).toBe(CANONICAL_MULTICHAT_ROUTE);
  });
});

/* The homepage keeps its own overlay forward: a /?kick=name link is an overlay
   request that predates the generator split, and it must still reach the
   overlay rather than the workspace. */
describe('homepage overlay forward', () => {
  it.each(['channel', 'kick', 'twitch', 'youtube', 'tiktok'])(
    'forwards ?%s= to the overlay, not the workspace',
    (param) => {
      query = { [param]: 'somechannel' };
      render(<HomePage />);
      expect(replace).toHaveBeenCalled();
      /* Forwarded as a {pathname, query} object so every parameter is carried
         through untouched, rather than a hand-built string. */
      const target = replace.mock.calls[0]?.[0] as {
        pathname: string;
        query: Record<string, string>;
      };
      expect(target.pathname).toBe('/multichat');
      expect(target.pathname).not.toContain('/tools/');
      expect(target.query[param]).toBe('somechannel');
    },
  );

  it('carries every parameter across the forward', () => {
    query = { kick: 'a', twitch: 'b', fade: '30' };
    render(<HomePage />);
    const target = replace.mock.calls[0]?.[0] as {
      pathname: string;
      query: Record<string, string>;
    };
    expect(target.query).toEqual({ kick: 'a', twitch: 'b', fade: '30' });
  });

  it('does not forward a bare visit', () => {
    render(<HomePage />);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('classic compatibility route', () => {
  it('is excluded from search indexing', () => {
    render(<ClassicMultichatPage />);
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toBe('noindex');
  });

  it('renders the classic generator rather than redirecting', () => {
    render(<ClassicMultichatPage />);
    expect(replace).not.toHaveBeenCalled();
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('is the path the OAuth allowlist names', () => {
    expect(OAUTH_RETURN_CLASSIC).toBe('/classic/multichat');
  });
});
