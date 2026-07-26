/* Left column — product branding and tool navigation.
 *
 * Branding is the existing product's own: the same wordmark and logo asset the
 * homepage already uses. Nothing is renamed. There is no version line, no
 * support link, no build timestamp, and no auth block — Twitch connect and
 * disconnect stay where they already are, in the existing generator.
 *
 * Active state is derived from the current route rather than held in state.
 */
import Link from 'next/link';
import { TOOLS } from '@/lib/tools/registry';

/** Nav targets: registered workspace tools plus the not-yet-migrated generator. */
const ENTRIES: { href: string; label: string }[] = [
  { href: '/multichat', label: 'MultiChat' },
  ...TOOLS.map((tool) => ({ href: tool.workspaceRoute, label: tool.label })),
];

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
