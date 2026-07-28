/* The counter overlay's poll loop, through the real page.
 *
 * Everything here is about what a viewer sees when a provider misbehaves, which is
 * the ordinary case rather than the exceptional one: Kick's public endpoint rate
 * limits, the cached viewers route has its own upstreams, and a stream ending is
 * indistinguishable at the transport level from a request that failed.
 *
 * Two failure modes are worse than showing nothing. Fabricating a zero says "this
 * stream has no viewers", which is a claim the overlay cannot support from a failed
 * request and which looks, on stream, like a real measurement. Retaining a last
 * known value indefinitely says the same thing more slowly. So the policy under
 * test is: a measured value including a measured zero is shown, a failure retains
 * the previous value inside a bounded window and then admits it does not know, and
 * nothing at all renders until the first poll has settled.
 *
 * `fetch` is the seam — driven per URL, so Kick failing while the server route
 * succeeds is expressible, which is the mixed case that a single global stub would
 * hide.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import CounterPage from '@/pages/counter';

/* The page's own interval, restated because it is a module-private constant
   there. Only the loop's shape depends on the exact value, and the assertions
   below advance past it rather than landing on it. */
const COUNTER_POLL_INTERVAL_MS = 10_000;

/** What the display renders when it has presence but no measurement. */
const UNAVAILABLE = '—';

let query: Record<string, string | string[]> = {};
vi.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query, replace: vi.fn() }),
}));

/** Per-URL responses. A handler returning null rejects, imitating a transport error. */
type Handler = () => unknown | null;
const handlers: { match: (url: string) => boolean; handler: Handler }[] = [];
let requests: string[] = [];

function respond(match: (url: string) => boolean, handler: Handler) {
  handlers.unshift({ match, handler });
}

/** The shared /api/viewers route, answering for the platforms given. */
function serverViewers(body: Record<string, { live: boolean; viewers?: number }>) {
  respond((u) => u.includes('/api/viewers'), () => body);
}

/** Kick's public channel endpoint. `null` viewers means live with no count. */
function kickLive(viewers: number | null) {
  respond(
    (u) => u.includes('kick.com/api'),
    () => ({ livestream: viewers === null ? {} : { viewer_count: viewers } }),
  );
}

function kickOffline() {
  respond((u) => u.includes('kick.com/api'), () => ({ livestream: null }));
}

function kickFails() {
  respond((u) => u.includes('kick.com/api'), () => null);
}

beforeEach(() => {
  /* performance is faked alongside the timers because the displayed number is
     animated: RollingCount eases from the old value to the new one over rAF
     frames, using performance.now() for progress. With a frozen clock the easing
     factor stays 0 and the old number is displayed forever, so a test asserting
     the new one would fail for a reason that has nothing to do with polling. */
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  handlers.length = 0;
  requests = [];
  query = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === 'string' ? input : (input as Request).url ?? input);
      requests.push(url);
      if (init?.signal?.aborted) throw new Error('aborted');
      const entry = handlers.find((h) => h.match(url));
      const body = entry?.handler() ?? null;
      if (body === null) throw new Error('network');
      return { ok: true, json: async () => body } as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Mounts the page and lets the first poll settle. */
async function mount() {
  const result = render(<CounterPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return result;
}

/** Advances one full poll interval, then lets the count animation finish. */
async function nextPoll() {
  await act(async () => { await vi.advanceTimersByTimeAsync(COUNTER_POLL_INTERVAL_MS + 10); });
  /* Separate advance: the rAF chain is only scheduled once the poll's state
     update commits, so it does not exist yet during the call above. */
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
}

/* The rendered text, with the inline <style> excluded.
 *
 * The display emits its @font-face and keyframes as a style element, whose text
 * contains `scale(0.85)` and `opacity: 0` — so a naive textContent read makes
 * every "no zero on screen" assertion pass or fail for reasons that have nothing
 * to do with viewer counts. Only element text is considered here. */
function text(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('nothing renders before the first poll settles', () => {
  it('renders no number while the first request is outstanding', () => {
    /* A zero here would be a fabricated measurement, on screen, in OBS, for as
       long as the first request takes. */
    query = { kick: 'somechannel' };
    kickLive(1234);
    const { container } = render(<CounterPage />);
    expect(text(container)).toBe('');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing at all when no channel is configured', async () => {
    const { container } = await mount();
    expect(text(container)).toBe('');
    expect(requests).toEqual([]);
  });
});

describe('measured values, including zero', () => {
  it('shows a measured Kick count', async () => {
    query = { kick: 'somechannel' };
    kickLive(1234);
    const { container } = await mount();
    expect(text(container)).toContain('1,234');
  });

  it('shows a measured zero rather than hiding it', async () => {
    /* Zero viewers is a fact about a live stream, not an absence of data. */
    query = { kick: 'somechannel' };
    kickLive(0);
    const { container } = await mount();
    expect(text(container)).toContain('0');
  });

  it('combines all four platforms into one total', async () => {
    query = { kick: 'k', twitch: 't', youtube: 'y', tiktok: 'tt', combined: 'true' };
    kickLive(1);
    serverViewers({
      twitch: { live: true, viewers: 20 },
      youtube: { live: true, viewers: 300 },
      tiktok: { live: true, viewers: 4000 },
    });
    const { container } = await mount();
    expect(text(container)).toContain('4,321');
  });

  it('lists platforms separately when combined is off', async () => {
    query = { kick: 'k', twitch: 't', combined: 'false' };
    kickLive(7);
    serverViewers({ twitch: { live: true, viewers: 11 } });
    const { container } = await mount();
    const rendered = text(container);
    expect(rendered).toContain('7');
    expect(rendered).toContain('11');
  });

  it('requests only the platforms that are configured', async () => {
    query = { kick: 'somechannel' };
    kickLive(5);
    await mount();
    expect(requests.some((u) => u.includes('kick.com/api'))).toBe(true);
    expect(requests.some((u) => u.includes('/api/viewers'))).toBe(false);
  });

  it('asks the server route for its three platforms in one request', async () => {
    query = { twitch: 't', youtube: 'y', tiktok: 'tt' };
    serverViewers({
      twitch: { live: true, viewers: 1 },
      youtube: { live: true, viewers: 2 },
      tiktok: { live: true, viewers: 3 },
    });
    await mount();
    const viewerCalls = requests.filter((u) => u.includes('/api/viewers'));
    expect(viewerCalls).toHaveLength(1);
    expect(viewerCalls[0]).toContain('twitch=t');
    expect(viewerCalls[0]).toContain('youtube=y');
    expect(viewerCalls[0]).toContain('tiktok=tt');
  });
});

describe('a failed request never becomes a measurement', () => {
  it('shows no fabricated zero when the only platform fails outright', async () => {
    /* An em-dash, not a number: the overlay says it does not know rather than
       asserting a count it never measured. */
    query = { kick: 'somechannel' };
    kickFails();
    const { container } = await mount();
    expect(text(container)).toBe(UNAVAILABLE);
    expect(text(container)).not.toMatch(/\d/);
  });

  it('keeps a live platform visible while the other fails', async () => {
    /* Partial success is preserved: one provider's outage must not blank a
       working one. */
    query = { kick: 'k', twitch: 't', combined: 'false' };
    kickFails();
    serverViewers({ twitch: { live: true, viewers: 42 } });
    const { container } = await mount();
    expect(text(container)).toContain('42');
  });

  it('reports an ended stream as nothing at all, not as zero', async () => {
    /* An offline platform has no presence, so the pill disappears rather than
       showing a count or a dash. */
    query = { kick: 'somechannel' };
    kickOffline();
    const { container } = await mount();
    expect(text(container)).toBe('');
  });

  it('treats a live stream with no usable count as unknown, not as zero', async () => {
    query = { kick: 'somechannel' };
    kickLive(null);
    const { container } = await mount();
    expect(text(container)).toBe(UNAVAILABLE);
    expect(text(container)).not.toMatch(/\d/);
  });
});

describe('a last good value is retained, then given up', () => {
  it('holds the previous count through one failed cycle', async () => {
    query = { kick: 'somechannel' };
    kickLive(500);
    const { container } = await mount();
    expect(text(container)).toContain('500');

    handlers.length = 0;
    kickFails();
    await nextPoll();
    /* Still 500: a blip should not make the number vanish and reappear. */
    expect(text(container)).toContain('500');
  });

  it('replaces a retained value the moment a real answer arrives', async () => {
    query = { kick: 'somechannel' };
    kickLive(500);
    const { container } = await mount();

    handlers.length = 0;
    kickFails();
    await nextPoll();

    handlers.length = 0;
    kickLive(900);
    await nextPoll();
    expect(text(container)).toContain('900');
    expect(text(container)).not.toContain('500');
  });

  it('lets an explicit offline replace a retained count immediately', async () => {
    /* Offline is an answer, not a failure, so it does not wait out the window. */
    query = { kick: 'somechannel' };
    kickLive(500);
    const { container } = await mount();

    handlers.length = 0;
    kickOffline();
    await nextPoll();
    expect(text(container)).toBe('');
  });
});

describe('the poll loop', () => {
  it('never overlaps two polls', async () => {
    /* The next poll is scheduled only once the current one has settled, so a
       slow provider cannot stack requests. */
    query = { kick: 'somechannel' };
    kickLive(1);
    await mount();
    const afterFirst = requests.length;
    await nextPoll();
    expect(requests.length).toBe(afterFirst * 2);
  });

  it('stops polling on unmount', async () => {
    query = { kick: 'somechannel' };
    kickLive(1);
    const { unmount } = await mount();
    const before = requests.length;
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(COUNTER_POLL_INTERVAL_MS * 4); });
    expect(requests.length).toBe(before);
  });

  it('leaves no timer behind after unmount', async () => {
    query = { kick: 'somechannel' };
    kickLive(1);
    const { unmount } = await mount();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no Twitch pin poll, whatever is in the URL', async () => {
    /* The counter has no pins and no connection. A fragment left on the URL by
       a copy-paste must not cause an authorized request from this page. */
    query = { twitch: 'somechannel', showPinEnabled: 'true', pinPlatforms: 'twitch' };
    window.location.hash = '#twitchConnectionId=123e4567-e89b-12d3-a456-426614174000';
    serverViewers({ twitch: { live: true, viewers: 3 } });
    await mount();
    expect(requests.some((u) => u.includes('/pins'))).toBe(false);
    expect(requests.every((u) => u.includes('/api/viewers'))).toBe(true);
    window.location.hash = '';
  });

  it('opens no websocket and no event source', async () => {
    /* The counter is a polling overlay. A socket here would be chat machinery
       leaking into a tool that does not need it. */
    const ws = vi.fn();
    const es = vi.fn();
    vi.stubGlobal('WebSocket', ws);
    vi.stubGlobal('EventSource', es);
    query = { kick: 'k', twitch: 't', youtube: 'y', tiktok: 'tt' };
    kickLive(1);
    serverViewers({ twitch: { live: true, viewers: 1 } });
    await mount();
    await nextPoll();
    expect(ws).not.toHaveBeenCalled();
    expect(es).not.toHaveBeenCalled();
  });
});
