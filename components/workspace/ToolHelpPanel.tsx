/* Reference material for the active tool, rendered from descriptor data.
 *
 * Knows nothing about chat commands. It renders `ToolHelpSection[]`, so the
 * MultiChat command list and any future tool's reference material share one
 * implementation. A tool declaring no help renders nothing — no empty heading,
 * no disclosure with an empty body.
 *
 * Collapsed by default via native <details>, so the settings catalog stays the
 * focus of the column and keyboard operation, focus, and the expanded/collapsed
 * announcement all come from the platform rather than from a custom widget.
 */
import type { ToolHelpSection } from '@/lib/tools/registry';

export default function ToolHelpPanel({
  sections,
}: {
  sections: readonly ToolHelpSection[];
}) {
  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <details
          key={section.id}
          className="group rounded-lg border border-ws-border bg-ws-surface"
        >
          <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium text-ws-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-ring">
            {section.title}
            {/* Decorative: <details> already announces its own state. */}
            <span aria-hidden="true" className="ml-2 text-xs text-ws-muted">
              <span className="group-open:hidden">show</span>
              <span className="hidden group-open:inline">hide</span>
            </span>
          </summary>

          <div className="border-t border-ws-border px-4 py-3">
            {section.intro ? (
              <p className="mb-3 text-xs text-ws-muted">{section.intro}</p>
            ) : null}

            <dl className="space-y-3">
              {section.entries.map((entry) => (
                <div key={entry.syntax} className="min-w-0">
                  {/* break-words, not overflow-x: a long line must wrap rather
                      than widen the column and scroll the page sideways. */}
                  <dt className="break-words font-mono text-xs text-ws-text">
                    {entry.syntax}
                  </dt>
                  <dd className="mt-0.5 text-xs text-ws-muted">
                    {entry.summary}
                    {entry.detail ? ` ${entry.detail}` : null}
                  </dd>
                </div>
              ))}
            </dl>

            {section.footnote ? (
              <p className="mt-3 border-t border-ws-border pt-3 text-xs text-ws-muted">
                {section.footnote}
              </p>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}
