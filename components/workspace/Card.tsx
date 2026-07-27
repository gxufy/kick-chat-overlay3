/* Card and SectionTitle — the workspace's visual unit.
 *
 * The classic generator's card language, ported to the ws- tokens: every section
 * is a bordered charcoal card with a chunky doubled shadow, titled by a small
 * uppercase tracked label with an accent bar beside it. The workspace previously
 * had flat panels separated only by whitespace, which is the main reason it read
 * as unfinished next to the classic page.
 *
 * These are presentation only. They take a heading id so the caller keeps
 * ownership of its own `aria-labelledby` wiring rather than having a generated id
 * guessed for it, and they render a real heading element at a caller-chosen level
 * so card nesting cannot invent a broken heading hierarchy.
 */
import type { ReactNode } from 'react';

/** Heading levels a card title may render as. No h1: the page owns that. */
type Level = 2 | 3 | 4;

export function SectionTitle({
  id,
  level = 2,
  children,
  hint,
  actions,
}: {
  id?: string;
  level?: Level;
  children: ReactNode;
  /** One line under the title. Plain text. */
  hint?: ReactNode;
  /** Controls pinned to the title's right edge — a mode switch, a button. */
  actions?: ReactNode;
}) {
  const Heading = (`h${level}` as const) satisfies keyof JSX.IntrinsicElements;

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading
          id={id}
          className="flex items-center gap-2 text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ws-accent"
        >
          {/* The accent bar. Decorative, so it stays out of the a11y tree. */}
          <span
            aria-hidden="true"
            className="h-3.5 w-1 shrink-0 rounded-sm bg-ws-accent"
          />
          <span className="truncate">{children}</span>
        </Heading>
        {hint ? <p className="mt-1.5 text-xs text-ws-muted">{hint}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export default function Card({
  children,
  labelledBy,
  accent = false,
  raised = false,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  /** Id of the SectionTitle heading inside, for the landmark's accessible name. */
  labelledBy?: string;
  /** Accent top border, for the one card that is the page's primary subject. */
  accent?: boolean;
  /** Raised inner surface, for a group nested inside another card. */
  raised?: boolean;
  className?: string;
  /** `section` by default; pass `div` for a card that is not a landmark. */
  as?: 'section' | 'div';
}) {
  return (
    <Tag
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
      className={[
        'rounded-xl border border-ws-border p-4 sm:p-5',
        raised ? 'bg-ws-raised' : 'bg-ws-surface shadow-ws-card',
        accent ? 'border-t-2 border-t-ws-accent' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}
