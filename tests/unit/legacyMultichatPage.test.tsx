/* pages/multichat — the legacy path, after the generator moved away from it.
 *
 * Two claims, and the first is the one that matters: a URL with a channel still
 * renders the overlay and issues no navigation. Those URLs are in OBS scene
 * collections nobody is going to edit, so this behaviour is permanent. The
 * second is that a channel-less visit forwards to the canonical generator
 * instead of rendering the old page.
 *
 * The overlay's own machinery (connectors, 7TV, pins) is not under test here and
 * is stubbed — this file is about which of the two things the route decides to be.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
/* vi.mock calls are hoisted above this import, so the page module below is
   evaluated with every mock already registered. */
import MultichatPage from '@/pages/multichat';

const replace = vi.fn();
let query: Record<string, string | string[]> = {};
let isReady = true;

vi.mock('next/router', () => ({
  useRouter: () => ({ isReady, query, replace }),
}));

/* The overlay renders a real ChatOverlay; stub it to a marker so this file does
   not depend on chat rendering, only on which branch the route took. */
vi.mock('../../components/ChatOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="chat-overlay" />,
}));

/* Connectors open sockets and timers on start; none of that is under test.
   Each factory builds its own stub inline — these calls are hoisted above every
   top-level binding, so a shared const would not exist yet when they run. */
vi.mock('../../lib/connectors/kick', () => ({
  createKickConnector: () => ({ start: () => {}, stop: () => {} }),
}));
vi.mock('../../lib/connectors/twitch', () => ({
  createTwitchConnector: () => ({ start: () => {}, stop: () => {} }),
}));
vi.mock('../../lib/connectors/youtube', () => ({
  createYouTubeConnector: () => ({ start: () => {}, stop: () => {} }),
}));
vi.mock('../../lib/connectors/tiktok', () => ({
  createTikTokConnector: () => ({ start: () => {}, stop: () => {} }),
}));
vi.mock('../../lib/cosmetics', () => ({
  createCosmeticsFetcher: () => ({ want: () => {}, stop: () => {} }),
}));
vi.mock('../../lib/twitchPinPoller', () => ({
  startTwitchPinPoller: () => () => {},
}));

/** A syntactically valid connection id. Synthetic — never a real one. */
const TEST_ID = '123e4567-e89b-12d3-a456-426614174000';

/* Sets the real fragment on jsdom's location.
 *
 * The page reads `window.location.hash`, not `router.query` — fragments are
 * never sent to the server and never appear in the query. Driving this through
 * the actual location object is the point: a test that only varied `query` could
 * not observe the fragment being dropped, which is exactly how that bug shipped.
 * Assigning `hash` in jsdom updates the URL without navigating. */
function setHash(hash: string): void {
  window.location.hash = hash;
}

beforeEach(() => {
  replace.mockClear();
  query = {};
  isReady = true;
  setHash('');
});

afterEach(() => {
  cleanup();
  setHash('');
});

describe('overlay visits', () => {
  it('renders the overlay for a Kick channel and navigates nowhere', () => {
    query = { kick: 'somechannel' };
    render(<MultichatPage />);
    expect(screen.getByTestId('chat-overlay')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders the overlay for the legacy channel alias', () => {
    query = { channel: 'somechannel' };
    render(<MultichatPage />);
    expect(screen.getByTestId('chat-overlay')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  /* A scene URL that happens to carry tab=counter must not be redirected. */
  it('renders the overlay when a channel and tab=counter are both present', () => {
    query = { twitch: 'somechannel', tab: 'counter' };
    render(<MultichatPage />);
    expect(screen.getByTestId('chat-overlay')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('generator visits', () => {
  it('forwards a bare visit to the MultiChat workspace', () => {
    render(<MultichatPage />);
    expect(replace).toHaveBeenCalledWith('/tools/multichat');
  });

  it('forwards tab=counter to the counter workspace', () => {
    query = { tab: 'counter' };
    render(<MultichatPage />);
    expect(replace).toHaveBeenCalledWith('/tools/counter');
  });

  it('renders no overlay while forwarding', () => {
    render(<MultichatPage />);
    expect(screen.queryByTestId('chat-overlay')).toBeNull();
  });

  it('does not render the old generator page', () => {
    render(<MultichatPage />);
    expect(screen.queryByText(/generator/i)).toBeNull();
  });

  it('forwards an empty channel value rather than serving a dead overlay', () => {
    query = { kick: '' };
    render(<MultichatPage />);
    expect(replace).toHaveBeenCalledWith('/tools/multichat');
  });
});

/* The release-blocking case. An authorization that began before the callback
   destination moved returns to /multichat carrying its connection in the
   fragment. Forwarding without it silently discards a completed authorization
   and sends the user back through Twitch for no reason. */
describe('OAuth return to the legacy path', () => {
  const VALID = `#twitchConnectionId=${TEST_ID}&twitch=someone`;

  it('preserves a valid fragment when forwarding to the workspace', () => {
    setHash(VALID);
    render(<MultichatPage />);
    expect(replace).toHaveBeenCalledWith(
      `/tools/multichat#twitchConnectionId=${TEST_ID}&twitch=someone`,
    );
  });

  it('preserves the fragment even when tab=counter is also present', () => {
    query = { tab: 'counter' };
    setHash(VALID);
    render(<MultichatPage />);
    expect(replace).toHaveBeenCalledWith(
      `/tools/multichat#twitchConnectionId=${TEST_ID}&twitch=someone`,
    );
    expect(replace).not.toHaveBeenCalledWith('/tools/counter');
  });

  it('never converts the fragment into a query string', () => {
    setHash(VALID);
    render(<MultichatPage />);
    const target = String(replace.mock.calls[0]?.[0] ?? '');
    expect(target).toContain('#');
    expect(target).not.toContain('?');
    expect(target.indexOf(TEST_ID)).toBeGreaterThan(target.indexOf('#'));
  });

  /* A channel-carrying overlay URL with a fragment is the OBS pin case: the
     fragment is the overlay's own poll credential, and the page must serve chat
     rather than forward anything. */
  it.each(['twitch', 'kick', 'youtube', 'tiktok'] as const)(
    'still serves the overlay for a %s channel carrying a fragment',
    (param) => {
      query = { [param]: 'somechannel' };
      setHash(VALID);
      render(<MultichatPage />);
      expect(screen.getByTestId('chat-overlay')).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a malformed uuid', '#twitchConnectionId=not-a-uuid&twitch=someone'],
    ['an invalid login', `#twitchConnectionId=${TEST_ID}&twitch=has%20spaces`],
    ['a duplicated login', `#twitchConnectionId=${TEST_ID}&twitch=someone&twitch=other`],
    ['a duplicated id', `#twitchConnectionId=${TEST_ID}&twitchConnectionId=${TEST_ID}&twitch=someone`],
    ['an unrelated fragment', '#section=faq'],
  ])('drops %s and forwards canonically', (_label, hash) => {
    setHash(hash);
    render(<MultichatPage />);
    expect(replace).toHaveBeenCalledWith('/tools/multichat');
  });

  it('carries only the two recognized fields', () => {
    setHash(`#twitchConnectionId=${TEST_ID}&twitch=someone&admin=1`);
    render(<MultichatPage />);
    const target = String(replace.mock.calls[0]?.[0] ?? '');
    expect(target).toBe(
      `/tools/multichat#twitchConnectionId=${TEST_ID}&twitch=someone`,
    );
    expect(target).not.toContain('admin');
  });

  it('replaces once, not once per render', () => {
    setHash(VALID);
    const view = render(<MultichatPage />);
    view.rerender(<MultichatPage />);
    view.rerender(<MultichatPage />);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  /* StrictMode double-invokes effects here (verified: the mount effect runs
     twice), which a plain rerender cannot simulate — unchanged deps simply do
     not re-run an effect. What this pins is the observable outcome: exactly one
     navigation, to the right place. It does not isolate *which* mechanism
     achieves that; the hash gate is what serializes the double mount, and the
     ref guard in the page is unexercised insurance on top of it. */
  it('replaces once under StrictMode double-invocation', () => {
    setHash(VALID);
    render(
      <StrictMode>
        <MultichatPage />
      </StrictMode>,
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      `/tools/multichat#twitchConnectionId=${TEST_ID}&twitch=someone`,
    );
  });

  it('replaces once for a bare visit under StrictMode', () => {
    render(
      <StrictMode>
        <MultichatPage />
      </StrictMode>,
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/tools/multichat');
  });

  it('renders nothing while forwarding, so the old page never flashes', () => {
    setHash(VALID);
    render(<MultichatPage />);
    expect(screen.queryByTestId('chat-overlay')).toBeNull();
  });
});

describe('before the router is ready', () => {
  it('navigates nowhere until the query is known', () => {
    isReady = false;
    query = {};
    render(<MultichatPage />);
    expect(replace).not.toHaveBeenCalled();
  });

  it('navigates nowhere with a fragment until the router is ready', () => {
    isReady = false;
    setHash(`#twitchConnectionId=${TEST_ID}&twitch=someone`);
    render(<MultichatPage />);
    expect(replace).not.toHaveBeenCalled();
  });
});
