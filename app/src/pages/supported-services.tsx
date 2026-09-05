import SitePage from '@/components/site/SitePage';

const SERVICES = [
  {
    name: 'Twitch',
    href: 'https://www.twitch.tv/',
    detail: 'Live chat, native emotes, badges, moderation events, shared chat support, pinned messages, GIFs, and third-party emotes.',
  },
  {
    name: 'Kick',
    href: 'https://kick.com/',
    detail: 'Live chat, native emotes, badges, moderation events, and 7TV cosmetics.',
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/',
    detail: 'Live chat, channel emoji, owner/moderator/member badges, Super Chats, Super Stickers, memberships, and gifts.',
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/',
    detail: 'Live chat support inside the same MultiChat overlay.',
  },
  {
    name: '7TV',
    href: 'https://7tv.app/',
    detail: 'Global and channel emotes, zero-width emotes, paints, badges, cosmetics, and live set updates where provider identity is available.',
  },
  {
    name: 'BetterTTV',
    href: 'https://betterttv.com/',
    detail: 'Global and channel BTTV emotes.',
  },
  {
    name: 'FrankerFaceZ',
    href: 'https://www.frankerfacez.com/',
    detail: 'Global and channel FFZ emotes plus supported badge data.',
  },
] as const;

export default function SupportedServicesPage() {
  return (
    <SitePage
      title="Supported Services | Gxufy 🕊️"
      heading="Supported Services"
      path="/supported-services"
      description="Platforms and emote services supported by Gxufy MultiChat: Kick, Twitch, YouTube, TikTok, 7TV, BetterTTV, and FrankerFaceZ."
    >
      {SERVICES.map((service) => (
        <section key={service.name}>
          <h2><a href={service.href} target="_blank" rel="noreferrer">{service.name}</a></h2>
          <p>{service.detail}</p>
        </section>
      ))}
    </SitePage>
  );
}
