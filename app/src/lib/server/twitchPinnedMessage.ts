export type TwitchPinnedMessage = {
  messageId: string;
  broadcasterId: string;
  senderUserId: string;
  senderUserLogin: string;
  senderUserName: string;
  pinnedByUserId: string;
  pinnedByUserLogin: string;
  pinnedByUserName: string;
  text: string;
  startsAt: string;
  endsAt: string | null;
  updatedAt: string;
};

export type TwitchPinnedMessageResult =
  | {
      status: 'ok';
      pin: TwitchPinnedMessage | null;
    }
  | {
      status: 'unauthorized';
    };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidTimestamp(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  if (v.trim().length === 0) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

function fail(): never {
  throw new Error('Twitch pinned message lookup failed.');
}

export async function fetchTwitchPinnedMessage(
  accessToken: string,
  broadcasterId: string,
  moderatorId: string,
): Promise<TwitchPinnedMessageResult> {
  // --- Validate inputs ---

  if (
    typeof accessToken !== 'string' ||
    typeof broadcasterId !== 'string' ||
    typeof moderatorId !== 'string'
  ) {
    fail();
  }

  if (
    accessToken.trim().length === 0 ||
    broadcasterId.trim().length === 0 ||
    moderatorId.trim().length === 0
  ) {
    fail();
  }

  if (!/^\d+$/.test(broadcasterId)) {
    fail();
  }

  if (!/^\d+$/.test(moderatorId)) {
    fail();
  }

  // --- Read client ID lazily ---

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (typeof clientId !== 'string' || clientId.trim().length === 0) {
    fail();
  }

  // --- Build URL ---

  const url = new URL('https://api.twitch.tv/helix/chat/pins');
  url.searchParams.set('broadcaster_id', broadcasterId);
  url.searchParams.set('moderator_id', moderatorId);

  // --- Request with timeout ---

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
      signal: controller.signal,
    });

    if (response.status === 401) {
      return { status: 'unauthorized' };
    }

    if (!response.ok) {
      fail();
    }

    // --- Parse JSON defensively ---

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      fail();
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as Record<string, unknown>).data)
    ) {
      fail();
    }

    const data = (body as Record<string, unknown[]>).data;

    if (data.length === 0) {
      return { status: 'ok', pin: null };
    }

    if (data.length !== 1) {
      fail();
    }

    const raw = data[0];

    if (typeof raw !== 'object' || raw === null) {
      fail();
    }

    const pin = raw as Record<string, unknown>;

    // --- Validate required string fields ---

    if (!isNonEmptyString(pin.message_id)) fail();
    if (!isNonEmptyString(pin.broadcaster_id)) fail();
    if (!isNonEmptyString(pin.sender_user_id)) fail();
    if (!isNonEmptyString(pin.sender_user_login)) fail();
    if (!isNonEmptyString(pin.sender_user_name)) fail();
    if (!isNonEmptyString(pin.pinned_by_user_id)) fail();
    if (!isNonEmptyString(pin.pinned_by_user_login)) fail();
    if (!isNonEmptyString(pin.pinned_by_user_name)) fail();
    if (!isNonEmptyString(pin.starts_at)) fail();
    if (!isNonEmptyString(pin.updated_at)) fail();

    // --- Validate broadcaster_id matches request ---

    if (pin.broadcaster_id !== broadcasterId) {
      fail();
    }

    // --- Validate timestamps ---

    if (!isValidTimestamp(pin.starts_at)) fail();
    if (!isValidTimestamp(pin.updated_at)) fail();

    // ends_at: null or valid non-empty string timestamp
    if (pin.ends_at !== null && !isValidTimestamp(pin.ends_at)) {
      fail();
    }

    // --- Validate message object ---

    const message = pin.message;
    if (typeof message !== 'object' || message === null) fail();
    const msg = message as Record<string, unknown>;
    if (!isNonEmptyString(msg.text)) fail();

    // --- Construct result ---

    return {
      status: 'ok',
      pin: {
        messageId: pin.message_id,
        broadcasterId: pin.broadcaster_id,
        senderUserId: pin.sender_user_id,
        senderUserLogin: pin.sender_user_login,
        senderUserName: pin.sender_user_name,
        pinnedByUserId: pin.pinned_by_user_id,
        pinnedByUserLogin: pin.pinned_by_user_login,
        pinnedByUserName: pin.pinned_by_user_name,
        text: msg.text,
        startsAt: pin.starts_at,
        endsAt: pin.ends_at as string | null,
        updatedAt: pin.updated_at,
      },
    };
  } catch {
    throw new Error('Twitch pinned message lookup failed.');
  } finally {
    clearTimeout(timer);
  }
}
