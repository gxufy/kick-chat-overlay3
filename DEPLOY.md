# multichat-gxufy — VPS deploy (Oracle free tier / any Ubuntu VPS)

One Node process serves everything: landing page, overlay, YouTube proxy, TikTok SSE.
In front of it, Caddy handles your domain + automatic HTTPS.

```
visitors → https://yourdomain.com → Caddy (443) → Node app (localhost:3000)
```

## 1. Point your domain at the VPS

At your domain registrar, create an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `@` | your VPS public IP |
| A | `www` | your VPS public IP (optional) |

DNS can take a few minutes to propagate.

## 2. Open ports on Oracle

Oracle blocks inbound traffic in TWO places — do both:

**a) VCN Security List** (Oracle Cloud console → Networking → your VCN → Security Lists → Default):
add Ingress rules for TCP **80** and **443**, source `0.0.0.0/0`.

**b) OS firewall** (on the VPS):
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo apt install -y iptables-persistent
```

## 3. Install Node 20 + the app

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

git clone https://github.com/gxufy/multichat-gxufy.git
cd multichat-gxufy
npm install
npm run build
```

## 4. Run it with pm2 (survives crashes + reboots)

```bash
sudo npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # then run the command it prints
```

Optional — raise TikTok signing rate limits with a free key from https://www.eulerstream.com/:
```bash
pm2 restart multichat --update-env
# after adding TIKTOK_SIGN_API_KEY to ecosystem.config.js env block
```

## 5. Caddy (domain + auto-HTTPS)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# put your domain into the Caddyfile, then:
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy fetches and renews the TLS certificate automatically. That's it —
`https://yourdomain.com` is live; people enter channel names and go.

## Updating later

**Automatic (recommended):** every push to `main` deploys itself via
GitHub Actions (`.github/workflows/deploy.yml`). One-time setup — add
three repo secrets (GitHub → repo → Settings → Secrets and variables →
Actions):

| Secret | Value |
|---|---|
| `VPS_HOST` | your VPS public IP (or domain) |
| `VPS_USER` | the SSH user, e.g. `ubuntu` |
| `VPS_SSH_KEY` | a private key whose public half is in the VPS `~/.ssh/authorized_keys` |

Generate a dedicated deploy key (don't reuse your personal one):
```bash
# on your PC
ssh-keygen -t ed25519 -f deploykey -N ""
# put deploykey.pub on the VPS:
ssh ubuntu@YOUR_IP "cat >> ~/.ssh/authorized_keys" < deploykey.pub
# paste the contents of `deploykey` (private) into the VPS_SSH_KEY secret
```

After that: edit code → `git push` → live in ~2 minutes. The Actions tab
shows each deploy; the workflow can also be run manually from there.

**Manual (fallback):**
```bash
cd multichat-gxufy
git pull
npm ci
npm run build
pm2 restart multichat
```

## Twitch pinned messages (optional feature)

Everything above runs without this section. Twitch native pins are the one
feature needing OAuth, Supabase, and server-side secrets. Skip it and the
overlay still works for Kick, YouTube, TikTok, and 7TV cosmetics.

### Environment variables

Set these in the `env` block of `ecosystem.config.js` (production) or
`.env.local` (development). Names and formats only — never commit values.

| Variable | Format | Purpose |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | service-role JWT | Server-only DB access; bypasses RLS |
| `TWITCH_CLIENT_ID` | app client id | Twitch application identity |
| `TWITCH_CLIENT_SECRET` | app client secret | Code exchange and token refresh |
| `TWITCH_REDIRECT_URI` | absolute URL | Must byte-match the console entry |
| `TWITCH_TOKEN_ENCRYPTION_KEY` | 64 lowercase hex chars | AES-256-GCM key for tokens at rest |

`TIKTOK_SIGN_API_KEY` is unrelated and optional (see step 4).

`SUPABASE_SECRET_KEY` is the **service role** key, not the anon key. It is
read only inside `lib/server/**` and must never reach the browser.

Generate the encryption key — exactly 32 bytes as 64 hex characters, which is
what `lib/server/twitchTokenCrypto.ts` validates:

```bash
openssl rand -hex 32
```

Rotating this key makes every stored token undecryptable; users simply
reconnect. Losing it has the same effect.

### Twitch developer console

At https://dev.twitch.tv/console/apps, register **both** redirect URLs on the
same application:

| Environment | OAuth Redirect URL |
|---|---|
| Local | `http://localhost:3000/api/twitch/oauth/callback` |
| Production | `https://yourdomain.com/api/twitch/oauth/callback` |

`TWITCH_REDIRECT_URI` must equal the one for the environment you are running,
character for character — Twitch rejects any mismatch.

Required scope, and the only scope requested:

```
moderator:read:chat_messages
```

The connected account must be the broadcaster of, or a moderator in, the
channel whose pins you want to read.

### Database schema

This repository has **no migration tooling**. The SQL below is the schema the
application actually requires, reconstructed from the queries in
`lib/server/twitchConnection*.ts`. Run it once in the Supabase SQL editor as a
**manual step**. It is idempotent and contains no `DROP` or `DELETE`.

An existing working database is not proof this is complete — a fresh
deployment needs every statement here.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.twitch_connections (
  id                      uuid primary key default gen_random_uuid(),
  twitch_user_id          text        not null,
  twitch_login            text        not null,
  twitch_display_name     text        not null,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz not null,
  scopes                  text[]      not null,
  revoked_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Required by the upsert's onConflict: 'twitch_user_id' in
-- twitchConnectionStore.ts. Reconnecting the same account reuses its row.
create unique index if not exists twitch_connections_twitch_user_id_key
  on public.twitch_connections (twitch_user_id);

-- Every active-connection read filters on this column.
create index if not exists twitch_connections_active_idx
  on public.twitch_connections (id) where revoked_at is null;

alter table public.twitch_connections enable row level security;
```

Column notes:

- `revoked_at` **must** exist and **must** be nullable. `NULL` means active.
  Every reader (`twitchConnectionReader.ts`), the token updater
  (`twitchConnectionTokenUpdater.ts`), and the disconnect path filter on it.
- The two `*_encrypted` columns are nullable so disconnect can clear them.
  If your existing table declares them `not null`, disconnect still works —
  the revocation succeeds and only the cleanup is skipped.
- `scopes` is a `text[]`; readers require it to contain
  `moderator:read:chat_messages`.
- Tokens are stored as `v1:<iv>:<tag>:<ciphertext>` base64url strings, never
  plaintext.

### RLS and the service role

RLS is enabled with **no policies**, which is intentional: the table should be
unreachable by the anon key. All access goes through `SUPABASE_SECRET_KEY`,
which bypasses RLS. Do not add a permissive policy, and do not expose this
table through any client-side Supabase call.

### Deployment order

1. Create the Supabase project and run the schema SQL above.
2. Register both redirect URLs in the Twitch console.
3. Generate `TWITCH_TOKEN_ENCRYPTION_KEY`.
4. Add all six variables to the environment, then `pm2 restart multichat
   --update-env` (or restart `npm run dev`).
5. Build and verify.

Order matters: the app reads env vars lazily, so a missing variable surfaces
as an opaque failure at first use rather than at boot.

### Build and verification

```bash
npx tsc --noEmit     # strict type check
npm run build        # production build
```

`npm run build` regenerates `next-env.d.ts`; restore it if git reports it as
modified (`git restore -- next-env.d.ts`).

Connect flow — open the generator at `/multichat`, enter your channel, click
**Connect**, approve on Twitch. You should return to the generator showing
"Connected as <login>".

Pin check — with a message pinned in that channel, confirm the overlay URL
built by the generator shows the pin within ~5 seconds. Unpin it and confirm
the banner clears within ~5 seconds.

Disconnect check — click **Disconnect**. The connected-account row disappears
and the generated overlay URL loses its `twitchConnectionId` fragment.
Clicking it twice is safe; the endpoint is idempotent.

Reconnect check — click **Connect** again with the same account. It reconnects
and pins resume; the row is reused rather than duplicated.

Revoked-overlay check — an overlay tab left open on a disconnected connection
stops polling Twitch instead of retrying forever. Its other platforms keep
working.


- Kick, Twitch, and all emote/cosmetic APIs connect from each visitor's
  browser — zero load on the VPS regardless of user count.
- YouTube chat is polled through this server (light JSON proxying).
- TikTok holds one server-side connection **per overlay viewer** using a
  TikTok channel. Fine at launch; if TikTok usage grows, connections
  should be deduplicated per channel (planned improvement).
