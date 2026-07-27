/* The connection panel inside the real workspace.
 *
 * Mounted through GeneratorWorkspace rather than in isolation, because what is
 * worth testing is the interaction across the shell/tool boundary: adopting a
 * fragment, gating the pin option, dropping a stale selection when the channel
 * stops matching, and getting the id into the URL fragment. Testing the panel
 * alone would verify none of that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { multichatTool } from '@/lib/tools/multichat/config';
import { TWITCH_CONNECTION_KEY, workspaceDraftKey } from '@/lib/workspaceStorage';

const BASE = 'https://example.com';
const ID = '123e4567-e89b-12d3-a456-426614174000';

const mount = () => render(<GeneratorWorkspace tool={multichatTool} baseUrl={BASE} />);
const urlField = () => screen.getByLabelText('Overlay URL') as HTMLInputElement;
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

const byId = (id: string) => document.getElementById(id) as HTMLElement;
const channel = (key: string) => byId(`channel-${key}`) as HTMLInputElement;
const pinBox = (key: string) => byId(`setting-pinPlatforms-${key}`) as HTMLInputElement;
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });

/** Store a connection the way a previous session would have. */
function storeConnection(login = 'someone', id = ID) {
  window.sessionStorage.setItem(
    TWITCH_CONNECTION_KEY,
    JSON.stringify({ version: 1, connectionId: id, login }),
  );
}

/** Mount with a connection already adopted and the matching channel typed in. */
function mountConnected(login = 'someone') {
  storeConnection(login);
  mount();
  type(channel('twitch'), login);
  settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  window.location.hash = '';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.location.hash = '';
  cleanup();
});

describe('unconnected state', () => {
  it('offers Connect and claims nothing', () => {
    mount();
    expect(screen.getByText('Connect Twitch')).toBeTruthy();
    expect(screen.queryByText('Disconnect')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/connected as/i);
  });

  it('says the connection is optional', () => {
    mount();
    expect(document.body.textContent ?? '').toMatch(/optional/i);
  });

  it('gates the twitch pin option with a reason', () => {
    mount();
    expect(pinBox('twitch').disabled).toBe(true);
    expect(document.body.textContent ?? '').toMatch(/connect a twitch account/i);
  });

  it('leaves the other pin options usable', () => {
    mount();
    for (const key of ['kick', 'youtube', 'tiktok']) {
      expect(pinBox(key).disabled).toBe(false);
    }
  });

  it('generates a URL with no fragment', () => {
    mount();
    type(channel('twitch'), 'someone');
    settle();
    expect(urlField().value).not.toContain('#');
  });
});

describe('adopting a connection from the OAuth fragment', () => {
  it('reads it and shows the login', () => {
    window.location.hash = `#twitchConnectionId=${ID}&twitch=someone`;
    mount();
    settle();
    expect(screen.getByText('someone')).toBeTruthy();
    expect(screen.getByText('Disconnect')).toBeTruthy();
  });

  /* Stripped immediately: left in place, the id would land in anything the user
     copies or bookmarks, and in the history entry. */
  it('strips the fragment from the address bar', () => {
    window.location.hash = `#twitchConnectionId=${ID}&twitch=someone`;
    mount();
    settle();
    expect(window.location.hash).toBe('');
  });

  it('persists it so a reload does not silently drop pin capability', () => {
    window.location.hash = `#twitchConnectionId=${ID}&twitch=someone`;
    mount();
    settle();
    expect(window.sessionStorage.getItem(TWITCH_CONNECTION_KEY)).toContain(ID);
  });

  it('strips an unusable fragment too, rather than leaving it visible', () => {
    window.location.hash = `#twitchConnectionId=nope&twitch=someone`;
    mount();
    settle();
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Connect Twitch')).toBeTruthy();
  });

  it('adopts a stored connection when there is no fragment', () => {
    storeConnection('someone');
    mount();
    settle();
    expect(screen.getByText('someone')).toBeTruthy();
  });

  /* The full round trip: a draft holding the channel is restored by the shell
     while the panel adopts the connection from the fragment. Both land, and pins
     are available immediately — the user should not have to retype the channel
     they entered before authorizing. */
  it('adopts the connection and the restored channel together', () => {
    window.sessionStorage.setItem(
      workspaceDraftKey('multichat'),
      JSON.stringify({
        version: 1,
        channels: { twitch: 'someone', kick: 'kickuser' },
        style: {},
        background: 'dark',
      }),
    );
    window.location.hash = `#twitchConnectionId=${ID}&twitch=someone`;
    mount();
    settle();

    expect(channel('twitch').value).toBe('someone');
    expect(channel('kick').value).toBe('kickuser');
    expect(screen.getByText('Disconnect')).toBeTruthy();
    /* The point of the test: neither adoption clobbered the other. */
    expect(pinBox('twitch').disabled).toBe(false);
  });
});

describe('the connection id is never exposed', () => {
  it('is absent from rendered text and markup', () => {
    mountConnected();
    expect(document.body.textContent ?? '').not.toContain(ID);
    /* The id does reach the readonly URL field's value, which is the one place
       it belongs. Checked separately below; the markup must not contain it as
       visible text or in any other attribute. */
    const withoutUrlField = Array.from(document.querySelectorAll('*'))
      .filter((el) => el.id !== 'overlay-url')
      .map((el) => el.textContent ?? '')
      .join('');
    expect(withoutUrlField).not.toContain(ID);
  });

  it('travels in the disconnect request body, not its URL', async () => {
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/twitch/oauth/disconnect');
    expect(url).not.toContain(ID);
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain(ID);
  });
});

describe('pin gating with a live connection', () => {
  it('enables the twitch pin option when the channel matches', () => {
    mountConnected();
    expect(pinBox('twitch').disabled).toBe(false);
  });

  it('keeps it gated while the channel names a different account', () => {
    storeConnection('someone');
    mount();
    type(channel('twitch'), 'someoneelse');
    settle();
    expect(pinBox('twitch').disabled).toBe(true);
    expect(document.body.textContent ?? '').toMatch(/connected as someone/i);
  });

  it('accepts a channel typed with @ or different case', () => {
    storeConnection('someone');
    mount();
    for (const typed of ['@someone', 'SomeOne', '  someone  ']) {
      type(channel('twitch'), typed);
      settle();
      expect(pinBox('twitch').disabled).toBe(false);
    }
  });

  /* The panel's own mismatch warning and the option gating must agree. They read
     the same rule; computing the comparison twice let them disagree for a channel
     typed as '@Someone' — enabled, but still warning it did not match. */
  it('shows no mismatch warning whenever the option is enabled', () => {
    storeConnection('someone');
    mount();
    for (const typed of ['someone', '@someone', 'SomeOne', 'other', '']) {
      type(channel('twitch'), typed);
      settle();
      const warned = /native pins need|set the twitch channel to/i.test(
        document.body.textContent ?? '',
      );
      expect(warned).toBe(pinBox('twitch').disabled);
    }
  });
});

describe('the URL fragment', () => {
  /** Select Twitch pins on a connected, matching workspace. */
  function enablePins() {
    mountConnected();
    if (!pinBox('twitch').checked) fireEvent.click(pinBox('twitch'));
    settle();
  }

  it('carries the id and login once pins are requested', () => {
    enablePins();
    const [, fragment] = urlField().value.split('#');
    const params = new URLSearchParams(fragment);
    expect(params.get('twitchConnectionId')).toBe(ID);
    expect(params.get('twitch')).toBe('someone');
  });

  it('appends exactly one #, and the query is untouched before it', () => {
    enablePins();
    const value = urlField().value;
    expect(value.split('#')).toHaveLength(2);
    expect(value.startsWith(`${BASE}/multichat?`)).toBe(true);
  });

  it('is dropped again when the channel stops matching', () => {
    enablePins();
    expect(urlField().value).toContain('#');
    type(channel('twitch'), 'someoneelse');
    settle();
    expect(urlField().value).not.toContain('#');
  });

  it('is absent while twitch is not among the selected pin platforms', () => {
    mountConnected();
    if (pinBox('twitch').checked) fireEvent.click(pinBox('twitch'));
    settle();
    expect(urlField().value).not.toContain(ID);
  });

  /* The preview loads the same URL, so it exercises the same connection — a
     fragment is not sent to the server, so this stays out of access logs. */
  it('reaches the preview iframe as well', () => {
    enablePins();
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain(ID);
  });
});

describe('a channel edit that invalidates the selection', () => {
  it('removes twitch from the pin list rather than leaving it stale', () => {
    mountConnected();
    if (!pinBox('twitch').checked) fireEvent.click(pinBox('twitch'));
    settle();
    expect(pinBox('twitch').checked).toBe(true);

    type(channel('twitch'), 'someoneelse');
    settle();
    /* Unchecked, gated, and gone from the URL — one rule, three consequences. */
    expect(pinBox('twitch').checked).toBe(false);
    expect(pinBox('twitch').disabled).toBe(true);
    expect(urlField().value).not.toContain('pinPlatforms=twitch');
  });

  it('leaves the other pin selections alone', () => {
    mountConnected();
    if (!pinBox('twitch').checked) fireEvent.click(pinBox('twitch'));
    if (!pinBox('kick').checked) fireEvent.click(pinBox('kick'));
    settle();

    type(channel('twitch'), 'nobody');
    settle();
    expect(pinBox('kick').checked).toBe(true);
  });
});

describe('disconnecting', () => {
  it('clears the connection, the stored copy, and the fragment', async () => {
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});
    settle();

    expect(screen.getByText('Connect Twitch')).toBeTruthy();
    expect(window.sessionStorage.getItem(TWITCH_CONNECTION_KEY)).toBeNull();
    expect(urlField().value).not.toContain(ID);
  });

  /* The user asked to disconnect. Leaving a connection that looks live but may
     already be revoked is worse than a stale server record — so local state is
     cleared either way, and the failure is surfaced rather than swallowed. */
  it('still clears locally when the server request fails, and says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});

    expect(screen.getByText('Connect Twitch')).toBeTruthy();
    expect(screen.getByRole('alert').textContent ?? '').toMatch(/could not fully disconnect/i);
  });

  it('re-gates the twitch pin option', async () => {
    mountConnected();
    expect(pinBox('twitch').disabled).toBe(false);
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});
    settle();
    expect(pinBox('twitch').disabled).toBe(true);
  });

  it('aborts an in-flight request when the workspace unmounts', async () => {
    /* Captures the signal the panel passed, so the assertion is about the
       request actually being cancelled rather than about React staying quiet. */
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => {
      signal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {});
    }));

    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});

    expect(signal).toBeDefined();
    expect(signal!.aborted).toBe(false);

    cleanup();
    expect(signal!.aborted).toBe(true);
  });

  it('recovers from a hung request instead of staying stuck on Disconnecting…', async () => {
    // Never resolves on its own — only the panel's own abort-on-timeout can
    // move this along, exactly as real fetch rejects once its signal aborts.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      const signal = (init as RequestInit | undefined)?.signal;
      signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })));
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});
    expect(screen.getByText('Disconnecting…')).toBeTruthy();

    // Advance past the request timeout without ever resolving the fetch.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText('Connect Twitch')).toBeTruthy();
    expect(screen.getByRole('alert').textContent ?? '').toMatch(/could not fully disconnect/i);
  });

  it('sends the connection id in the body, never the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/twitch/oauth/disconnect');
    expect(url).not.toContain(ID);
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain(ID);
  });

  it('does not re-adopt the connection it just cleared', async () => {
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    await act(async () => {});
    settle();
    expect(screen.queryByText('Disconnect')).toBeNull();
  });
});

describe('surviving the OAuth round trip', () => {
  /* OAuth is a full page navigation, so in-progress edits are lost unless they
     are written first. The link click is what triggers the write. */
  it('writes a draft when the connect link is clicked', () => {
    mount();
    type(channel('kick'), 'kickuser');
    type(channel('twitch'), 'someone');
    settle();

    fireEvent.click(screen.getByText('Connect Twitch'));
    const raw = window.sessionStorage.getItem(workspaceDraftKey('multichat')) ?? '';
    expect(raw).toContain('kickuser');
    expect(raw).toContain('someone');
  });

  it('restores that draft on the next mount', () => {
    mount();
    type(channel('kick'), 'kickuser');
    settle();
    fireEvent.click(screen.getByText('Connect Twitch'));
    cleanup();

    mount();
    settle();
    expect(channel('kick').value).toBe('kickuser');
  });

  it('consumes the draft, so a remount does not overwrite later edits', () => {
    mount();
    type(channel('kick'), 'kickuser');
    settle();
    fireEvent.click(screen.getByText('Connect Twitch'));
    cleanup();

    mount();
    settle();
    type(channel('kick'), 'edited');
    settle();
    cleanup();

    mount();
    settle();
    /* Nothing left to restore, so the field is empty rather than reverting. */
    expect(channel('kick').value).toBe('');
  });

  it('writes no connection id into the draft', async () => {
    mountConnected();
    fireEvent.click(screen.getByText('Disconnect'));
    /* Awaited so the disconnect settles inside act, rather than resolving after
       the test and updating an unmounted tree. */
    await act(async () => {});
    cleanup();
    mount();
    type(channel('kick'), 'kickuser');
    settle();
    const raw = window.sessionStorage.getItem(workspaceDraftKey('multichat')) ?? '';
    expect(raw).not.toContain(ID);
  });

  it('points the link at the workspace return destination', () => {
    mount();
    const href = screen.getByText('Connect Twitch').getAttribute('href') ?? '';
    expect(href).toContain(encodeURIComponent('/tools/multichat'));
    /* A path, never an absolute URL — the open-redirect shape the allowlist
       exists to refuse. */
    expect(href).not.toMatch(/https?:|%2F%2F/i);
  });
});
