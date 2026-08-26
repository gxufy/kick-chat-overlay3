import type { NextApiHandler } from 'next';
import {
  PREVIEW_IDENTITY_PROVIDERS,
  type PreviewIdentityProvider,
  type PreviewIdentityProviderMap,
  type PreviewIdentityResponse,
} from '@/features/multichat/previewIdentity';
import {
  loadBTTVPreviewResources,
  loadFFZPreviewResources,
  loadSevenTVPreviewResources,
  loadTwitchPreviewIdentity,
} from '@/lib/previewIdentityProviders';
import { resolveTwitchCommunityBadges } from '@/lib/communityBadges';

const GENERIC_ERROR = { error: 'Unable to load Twitch preview identity.' };

function normalizeLogin(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return null;
  const normalized = (value ?? '').trim().replace(/^[@#]/, '').toLowerCase();
  return /^[a-z0-9_]{1,25}$/.test(normalized) ? normalized : null;
}

function requestedProviders(value: string | string[] | undefined): PreviewIdentityProvider[] | null {
  if (value === undefined) return [...PREVIEW_IDENTITY_PROVIDERS];
  const values = (Array.isArray(value) ? value : value.split(',')).map((item) => item.trim()).filter(Boolean);
  if (!values.length || values.some((item) => !(PREVIEW_IDENTITY_PROVIDERS as readonly string[]).includes(item))) return null;
  return [...new Set(values)] as PreviewIdentityProvider[];
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const login = normalizeLogin(req.query.login);
  const providers = requestedProviders(req.query.providers);
  if (!login || !providers) return res.status(400).json({ error: 'Invalid preview identity request.' });

  try {
    const twitch = await loadTwitchPreviewIdentity(login);
    if (!twitch) return res.status(404).json({ error: 'Twitch user not found.' });

    let twitchOutcome = twitch.outcome;
    if (providers.includes('Twitch')) {
      const communityBadges = await resolveTwitchCommunityBadges(
        twitch.identity.userId,
        twitch.identity.login,
      );
      const communityBadgeMap = Object.fromEntries(
        communityBadges.flatMap((badge) => badge.url ? [[`${badge.type}/1`, badge.url]] : []),
      );
      twitchOutcome = {
        ...twitch.outcome,
        resources: {
          ...twitch.outcome.resources,
          globalBadges: {
            ...twitch.outcome.resources.globalBadges,
            ...communityBadgeMap,
          },
        },
      };
    }

    const outcomes = await Promise.all(providers.map(async (provider) => {
      try {
        switch (provider) {
          case 'Twitch':
            return [provider, twitchOutcome] as const;
          case 'FFZ':
            return [provider, await loadFFZPreviewResources(twitch.identity.userId)] as const;
          case 'BTTV':
            return [provider, await loadBTTVPreviewResources(twitch.identity.userId)] as const;
          case '7TV':
            return [provider, await loadSevenTVPreviewResources(twitch.identity.userId)] as const;
        }
      } catch {
        switch (provider) {
          case 'FFZ':
            return [provider, { status: 'failed' as const, resources: { globalEmotes: [], roomEmotes: [], badgeOverrides: {} } }] as const;
          case 'BTTV':
            return [provider, { status: 'failed' as const, resources: { globalEmotes: [], channelEmotes: [], sharedEmotes: [] } }] as const;
          case '7TV':
            return [provider, { status: 'failed' as const, resources: { globalEmotes: [], channelEmotes: [], personalEmotes: [], paint: null, badge: null } }] as const;
          case 'Twitch':
            return [provider, { status: 'failed' as const, resources: { globalBadges: {}, channelBadges: {} } }] as const;
        }
      }
    }));

    const providerMap = Object.fromEntries(outcomes) as Partial<PreviewIdentityProviderMap>;
    const body: PreviewIdentityResponse = { identity: twitch.identity, providers: providerMap };
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(body);
  } catch {
    return res.status(502).json(GENERIC_ERROR);
  }
};

export default handler;
