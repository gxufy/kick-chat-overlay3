/* MultiChat's Twitch connection panel — the only component that names Twitch.
 *
 * Rendered by the shell through the descriptor's `runtime.Panel`, so nothing in
 * GeneratorWorkspace, LivePreviewPanel, or the settings list knows this exists.
 *
 * What it is for: Twitch's native pinned messages cannot be read over anonymous
 * IRC, so they need an authorized poll. Connecting authorizes exactly one scope
 * (`moderator:read:chat_messages`) and yields an opaque connection id that the
 * overlay hands to the pins API. Everything else in MultiChat keeps working with
 * no connection at all.
 *
 * The connection id is treated as sensitive: it is never rendered, never logged,
 * never placed in a query string, and never copied to the clipboard on its own.
 * It reaches exactly one place — the generated overlay URL's fragment — because
 * that is what the overlay reads.
 */
import { useEffect, useRef, useState } from 'react';
import type { RuntimePanelProps } from '@/lib/tools/registry';
import {
  OAUTH_RETURN_WORKSPACE,
  twitchPinsAvailable,
  type MultichatRuntime,
} from '@/lib/tools/multichat/runtime';
import {
  clearStoredConnection,
  readStoredConnection,
  writeStoredConnection,
} from '@/lib/workspaceStorage';
import { readConnectionFromFragment } from '@/lib/twitchConnection';

/** Remove the OAuth fragment from the address bar without a navigation. */
function stripFragment(): void {
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

export default function TwitchConnectionPanel({
  runtime,
  onChange,
  onBeforeLeave,
}: RuntimePanelProps<MultichatRuntime>) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  /* Guards the adoption effect against a second run (Strict Mode double-invokes
     effects in development), which would re-read an already-stripped fragment. */
  const adopted = useRef(false);

  /* Adopt a connection on mount: from the OAuth fragment if we just came back
     from it, otherwise from session storage.

     The fragment is stripped immediately either way. Leaving it in the address
     bar would put the connection id in anything the user copies or shares, in
     the history entry, and in a bookmark — and the value stays useful until it
     is disconnected. Stripping uses replaceState, so no navigation happens and
     the workspace's own URL never contains it. */
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;

    /* Adopted through the updater form, never by spreading the `runtime` this
       effect closed over: the shell folds the typed Twitch channel into runtime
       from its own effect, and the two orderings are not guaranteed. Spreading a
       mount-time snapshot would reset `twitchChannel` to '' if the draft restore
       had already populated it, silently gating pins on a matching account. */
    const adopt = (connectionId: string, connectedLogin: string) =>
      onChange((current) => ({ ...current, connectionId, connectedLogin }));

    const fromFragment = readConnectionFromFragment(window.location.hash);
    if (fromFragment) {
      stripFragment();
      writeStoredConnection(fromFragment);
      adopt(fromFragment.connectionId, fromFragment.login);
      return;
    }

    /* A fragment that was present but unusable is still removed, so a malformed
       or tampered value is not left sitting in the address bar. */
    if (window.location.hash) stripFragment();

    const stored = readStoredConnection();
    if (stored) adopt(stored.connectionId, stored.login);
    /* Mount only. `runtime` and `onChange` are deliberately not dependencies:
       re-running on every runtime change would re-adopt a connection the user
       just disconnected. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Revoke server-side, then clear locally.
   *
   * The id travels in a POST body, never a query string, so it stays out of
   * server access logs. Local state is cleared even when the request fails: the
   * user asked to disconnect, and leaving a connection that appears active but
   * may already be revoked is worse than a stale server record. The error is
   * surfaced so they know the server side may not have completed. */
  async function disconnect(): Promise<void> {
    if (!runtime.connectionId || disconnecting) return;

    setDisconnecting(true);
    setError('');

    try {
      const res = await fetch('/api/twitch/oauth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: runtime.connectionId }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setError('Could not fully disconnect on the server. Try again.');
    } finally {
      clearStoredConnection();
      /* Clearing the id drops the fragment from the overlay URL, and the tool's
         `sync` hook removes twitch from the pin selection — neither is done here,
         because both are consequences the descriptor owns. Updater form again:
         the channel may have been retyped while the request was in flight. */
      onChange((current) => ({ ...current, connectionId: '', connectedLogin: '' }));
      setDisconnecting(false);
    }
  }

  const connected = Boolean(runtime.connectionId);
  /* The shared rule, not a second copy of it. Comparing the logins here directly
     would miss the normalization and disagree with the option gating for a
     channel typed as '@Someone'. */
  const usable = twitchPinsAvailable(runtime);

  return (
    <section aria-labelledby="twitch-connection-heading" className="min-w-0">
      <h3
        id="twitch-connection-heading"
        className="text-xs font-semibold uppercase tracking-wide text-ws-muted"
      >
        Twitch account
      </h3>

      {connected ? (
        <div className="mt-2 space-y-2">
          {/* The login is shown; the connection id never is. */}
          <p className="text-sm text-ws-text">
            Connected as{' '}
            <span className="font-semibold">{runtime.connectedLogin}</span>
          </p>

          {!usable && (
            <p className="text-xs text-amber-400" role="status">
              {runtime.twitchChannel
                ? `Native pins need the Twitch channel to be ${runtime.connectedLogin}.`
                : `Set the Twitch channel to ${runtime.connectedLogin} to use its native pins.`}
            </p>
          )}

          <button
            type="button"
            onClick={disconnect}
            disabled={disconnecting}
            className="rounded-md border border-ws-border px-2.5 py-1.5 text-xs font-semibold text-ws-text hover:bg-ws-hover disabled:opacity-60"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-ws-muted">
            Optional. Only needed to show Twitch&rsquo;s own pinned messages —
            everything else works without it.
          </p>
          {/* A plain link, not a fetch: OAuth is a top-level browser navigation.
              The draft is written first so channels and settings survive it. */}
          <a
            href={`/api/twitch/oauth/start?returnTo=${encodeURIComponent(OAUTH_RETURN_WORKSPACE)}`}
            onClick={onBeforeLeave}
            className="inline-block rounded-md bg-ws-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Connect Twitch
          </a>
          <p className="text-xs text-ws-muted">
            Grants one read-only scope for pinned messages. No posting, no
            moderation, no message history.
          </p>
        </div>
      )}

      {/* Outside both branches deliberately. A failed disconnect still clears
          local state, so the panel has already switched to the unconnected view
          by the time this renders — inside the connected branch, the one message
          the user needs would be unmounted the moment it became relevant. */}
      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
