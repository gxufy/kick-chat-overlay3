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

beforeEach(() => {
  replace.mockClear();
  query = {};
  isReady = true;
});

afterEach(cleanup);

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

describe('before the router is ready', () => {
  it('navigates nowhere until the query is known', () => {
    isReady = false;
    query = {};
    render(<MultichatPage />);
    expect(replace).not.toHaveBeenCalled();
  });
});
