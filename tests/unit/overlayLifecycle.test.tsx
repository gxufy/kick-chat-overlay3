/* What the overlay page starts, and what it stops.
 *
 * A browser source is a page that runs for the length of a stream and then gets
 * replaced by another one in the same document. Every leak class here is therefore
 * cumulative rather than momentary: a connector that outlives its effect keeps a
 * socket open and keeps calling into a torn-down React tree, and a poller that
 * survives a remount doubles its request rate each time.
 *
 * The mocks count rather than merely silence. "Did not crash" is not the claim —
 * the claim is one connector per configured platform, exactly one start each, and
 * a matching stop for every one of them by the time the tree is gone. React Strict
 * Mode is the harness for that, because it mounts, tears down, and remounts every
 * effect, which is the cheapest available imitation of the thing that actually
 * happens in OBS.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import MultichatPage from '@/pages/multichat';

const replace = vi.fn();
let query: Record<string, string | string[]> = {};

vi.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query, replace }),
}));

vi.mock('../../src/components/ChatOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="chat-overlay" />,
  FONT_FAMILIES: {},
}));

vi.mock('../../src/components/classic/ClassicGenerator', () => ({
  __esModule: true,
  default: () => <div data-testid="classic-generator" />,
}));

/** One record per connector the page ever created. */
type Started = { platform: string; starts: number; stops: number };
const created: Started[] = [];

function connectorStub(platform: string) {
  const record: Started = { platform, starts: 0, stops: 0 };
  created.push(record);
  return {
    start() { record.starts += 1; },
    stop() { record.stops += 1; },
  };
}

vi.mock('../../src/lib/connectors/kick', () => ({
  createKickConnector: () => connectorStub('kick'),
}));
vi.mock('../../src/lib/connectors/twitch', () => ({
  createTwitchConnector: () => connectorStub('twitch'),
}));
vi.mock('../../src/lib/connectors/youtube', () => ({
  createYouTubeConnector: () => connectorStub('youtube'),
}));
vi.mock('../../src/lib/connectors/tiktok', () => ({
  createTikTokConnector: () => connectorStub('tiktok'),
}));

const cosmetics = { wants: 0, stops: 0 };
vi.mock('../../src/lib/cosmetics', () => ({
  createCosmeticsFetcher: () => {
    return {
      want: () => { cosmetics.wants += 1; },
      stop: () => { cosmetics.stops += 1; },
    };
  },
}));

/* The poller returns its own stop function, and whether that function is called
   is the whole question — an authorized Twitch poll that outlives its effect keeps
   spending a real credential against a real endpoint. */
const pollerStops = vi.fn();
const startPoller = vi.fn(() => pollerStops);
vi.mock('../../src/lib/twitchPinPoller', () => ({
  startTwitchPinPoller: (...args: unknown[]) => startPoller(...(args as [])),
}));

const TEST_ID = '123e4567-e89b-12d3-a456-426614174000';

/* Pins are *off* by default when parsed from a URL — the overlay schema reads
   showPinEnabled as `v === 'true'`, so anything absent is off, while the generator
   always writes it explicitly. Every "the poller does start" case below therefore
   has to enable it, and stating that here keeps the negative cases from passing
   for the accidental reason that nothing enabled pins in the first place. */
const PINS_ON = { showPinEnabled: 'true', pinPlatforms: 'twitch' } as const;

/** Every connector the page created, or a subset by platform. */
const forPlatform = (platform: string) => created.filter((c) => c.platform === platform);

beforeEach(() => {
  created.length = 0;
  cosmetics.wants = 0;
  cosmetics.stops = 0;
  replace.mockClear();
  startPoller.mockClear();
  pollerStops.mockClear();
  query = {};
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  vi.useRealTimers();
});

describe('one connector per configured platform', () => {
  it('starts exactly the platforms in the URL', () => {
    query = { kick: 'somechannel', twitch: 'other' };
    render(<MultichatPage />);
    expect(forPlatform('kick')).toHaveLength(1);
    expect(forPlatform('twitch')).toHaveLength(1);
    expect(forPlatform('youtube')).toHaveLength(0);
    expect(forPlatform('tiktok')).toHaveLength(0);
    expect(created.every((c) => c.starts === 1)).toBe(true);
  });

  it.each(['kick', 'twitch', 'youtube', 'tiktok'] as const)(
    'starts one %s connector and no others',
    (platform) => {
      query = { [platform]: 'somechannel' };
      render(<MultichatPage />);
      expect(created.map((c) => c.platform)).toEqual([platform]);
      expect(created[0].starts).toBe(1);
    },
  );

  it('starts all four when all four are configured', () => {
    query = { kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' };
    render(<MultichatPage />);
    expect(created.map((c) => c.platform).sort()).toEqual(['kick', 'tiktok', 'twitch', 'youtube']);
    expect(created).toHaveLength(4);
  });

  it('starts nothing at all on a generator visit', () => {
    /* A channel-less visit renders the URL builder. Opening sockets there would
       connect to nothing and poll on a page nobody is streaming. */
    render(<MultichatPage />);
    expect(created).toEqual([]);
    expect(startPoller).not.toHaveBeenCalled();
  });
});

describe('unmount stops everything it started', () => {
  it('stops every connector', () => {
    query = { kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' };
    const { unmount } = render(<MultichatPage />);
    unmount();
    expect(created).toHaveLength(4);
    for (const record of created) {
      expect(record.stops, record.platform).toBe(record.starts);
    }
  });

  it('stops the cosmetics fetcher', () => {
    query = { kick: 'a' };
    const { unmount } = render(<MultichatPage />);
    unmount();
    expect(cosmetics.stops).toBeGreaterThanOrEqual(1);
  });

  it('stops the Twitch pin poller', () => {
    query = { ...PINS_ON, twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    const { unmount } = render(<MultichatPage />);
    expect(startPoller).toHaveBeenCalledTimes(1);
    unmount();
    expect(pollerStops).toHaveBeenCalledTimes(1);
  });

  it('leaves no timer able to fire after unmount', () => {
    /* The page runs a flush interval, a loader timeout, and a fade interval. A
       timer surviving unmount would call setState on a gone tree; React logs that
       rather than throwing, so the count is what is checked. */
    vi.useFakeTimers();
    query = { kick: 'a' };
    const { unmount } = render(<MultichatPage />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('a remount does not accumulate', () => {
  it('Strict Mode leaves one live connector per platform', () => {
    /* Strict Mode starts, stops, and starts again. Two connectors created is
       expected and correct; what must not happen is two *live* ones, so every
       created connector except the survivors has been stopped. */
    query = { kick: 'a', twitch: 'b' };
    render(
      <StrictMode>
        <MultichatPage />
      </StrictMode>,
    );
    for (const platform of ['kick', 'twitch']) {
      const records = forPlatform(platform);
      const live = records.filter((r) => r.starts > r.stops);
      expect(live, platform).toHaveLength(1);
    }
  });

  it('Strict Mode plus unmount leaves nothing live', () => {
    query = { kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' };
    const { unmount } = render(
      <StrictMode>
        <MultichatPage />
      </StrictMode>,
    );
    unmount();
    expect(created.length).toBeGreaterThanOrEqual(4);
    expect(created.filter((r) => r.starts > r.stops)).toEqual([]);
  });

  it('Strict Mode runs no more than one live pin poller', () => {
    query = { ...PINS_ON, twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    const { unmount } = render(
      <StrictMode>
        <MultichatPage />
      </StrictMode>,
    );
    expect(startPoller.mock.calls.length - pollerStops.mock.calls.length).toBe(1);
    unmount();
    expect(startPoller.mock.calls.length).toBe(pollerStops.mock.calls.length);
  });

  it('mounting twice in sequence never doubles what is live', () => {
    /* The OBS "refresh browser source" shape: the whole page goes and comes back
       in the same document. */
    query = { kick: 'a' };
    const first = render(<MultichatPage />);
    first.unmount();
    const second = render(<MultichatPage />);
    expect(created.filter((r) => r.starts > r.stops)).toHaveLength(1);
    second.unmount();
    expect(created.filter((r) => r.starts > r.stops)).toEqual([]);
  });
});

describe('the pin poller starts only when it can succeed', () => {
  it('starts once with a valid id, a Twitch channel, and pins on', () => {
    /* The positive case first, so every negative below differs from a known
       working fixture by exactly the one thing it is about. */
    query = { ...PINS_ON, twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    render(<MultichatPage />);
    expect(startPoller).toHaveBeenCalledTimes(1);
  });

  it('does not start without a connection fragment', () => {
    /* No credential means every request would 401, on a loop. */
    query = { ...PINS_ON, twitch: 'somechannel' };
    render(<MultichatPage />);
    expect(startPoller).not.toHaveBeenCalled();
  });

  it('does not start on a malformed connection id', () => {
    query = { ...PINS_ON, twitch: 'somechannel' };
    window.location.hash = '#twitchConnectionId=not-a-uuid';
    render(<MultichatPage />);
    expect(startPoller).not.toHaveBeenCalled();
  });

  it('does not start when pins are switched off', () => {
    query = { ...PINS_ON, showPinEnabled: 'false', twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    render(<MultichatPage />);
    expect(startPoller).not.toHaveBeenCalled();
  });

  it('does not start when pins are simply absent from the URL', () => {
    /* The default, and the case most existing OBS URLs are in. */
    query = { twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    render(<MultichatPage />);
    expect(startPoller).not.toHaveBeenCalled();
  });

  it('does not start when Twitch is excluded from pinPlatforms', () => {
    query = { showPinEnabled: 'true', pinPlatforms: 'kick,youtube', twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    render(<MultichatPage />);
    expect(startPoller).not.toHaveBeenCalled();
  });

  it('does not start for a Kick-only overlay carrying a Twitch fragment', () => {
    /* A stale fragment on a URL whose Twitch channel was since removed. There is
       no login to poll for, so polling would be a request that cannot succeed. */
    query = { ...PINS_ON, kick: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    render(<MultichatPage />);
    expect(startPoller).not.toHaveBeenCalled();
  });

  it('never puts the connection id in the address bar', () => {
    /* It arrives in the fragment and stays there. A query parameter would reach
       the server and its logs; a rewritten URL would also survive a copy-paste of
       the address bar into somewhere public. */
    query = { ...PINS_ON, twitch: 'somechannel' };
    window.location.hash = `#twitchConnectionId=${TEST_ID}`;
    render(<MultichatPage />);
    expect(window.location.search).not.toContain('twitchConnectionId');
    expect(window.location.hash).toBe(`#twitchConnectionId=${TEST_ID}`);
    expect(replace).not.toHaveBeenCalled();
  });
});
