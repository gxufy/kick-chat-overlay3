/* Left column — product branding and tool navigation.
 *
 * Branding is the existing product's own: the same wordmark and logo asset the
 * homepage already uses. Nothing is renamed. There is no version line, no
 * support link, and no build timestamp.
 *
 * There is also no auth block here, and deliberately so now that the workspace
 * can connect Twitch: a connection belongs to the tool that uses it, next to the
 * channel it has to match, not to global chrome that every tool shares. The
 * counter has no use for one and shows nothing.
 *
 * Active state is derived from the current route rather than held in state.
 */
import Link from 'next/link';
import { OAUTH_RETURN_CLASSIC } from '@/lib/oauthReturn';
import { TOOLS } from '@/lib/tools/registry';

/**
 * The original generator, at its own stable address.
 *
 * Points at /classic/multichat rather than /multichat: the legacy path serves
 * the overlay as well as the generator, so it is the wrong thing to label as a
 * generator link. Same constant the OAuth allowlist uses, so a connection
 * started from that page returns to the page it started on.
 */
const CLASSIC = { href: OAUTH_RETURN_CLASSIC, label: 'MultiChat (Classic)' };

/**
 * Nav targets: every registered workspace tool, plus the original generator.
 *
 * The classic entry sits immediately after the registered MultiChat tool rather
 * than at the top, and carries a distinct label, so the two are never two items
 * both reading "MultiChat". It is no longer the only place a Twitch account can
 * be connected — the workspace does that now — but it stays listed so the
 * original UI is one click away if the workspace is wrong for someone.
 */
const ENTRIES: { href: string; label: string }[] = TOOLS.flatMap((tool) =>
  tool.id === 'multichat'
    ? [{ href: tool.workspaceRoute, label: tool.label }, CLASSIC]
    : [{ href: tool.workspaceRoute, label: tool.label }],
);

export default function WorkspaceNav({ currentPath }: { currentPath: string }) {
  return (
    <div className="flex h-full flex-col border-ws-border lg:border-r">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src="/tpl.webp" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
        <span className="truncate text-sm font-semibold text-ws-text">
          multichat-gxufy
        </span>
      </div>

      <nav aria-label="Overlay tools" className="px-2 pb-4">
        <ul className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
          {ENTRIES.map((entry) => {
            const active = currentPath === entry.href;
            return (
              <li key={entry.href} className="shrink-0 lg:shrink">
                <Link
                  href={entry.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ws-bg ${
                    active
                      ? 'bg-ws-control text-ws-text font-medium'
                      : 'text-ws-muted hover:bg-ws-control hover:text-ws-text'
                  }`}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
