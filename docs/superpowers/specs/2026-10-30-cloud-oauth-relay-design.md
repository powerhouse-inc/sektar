# Cloud sign-in for Gmail and Calendar: relay and token broker

Date: 2026-10-30. Status: approved (Wouter); decisions below by Frank.

## Intent

Sektar's Gmail and Google Calendar integrations sign in with the publisher's
Google app `sektar-google` (`powerhouse.config.json` → `workflows.oauthApps`).
Locally this works: the switchboard runs on `localhost`, uses the app's
**desktop** client, and Google accepts any loopback redirect.

In the cloud it cannot work as is:

1. Every environment has its own host, and Google only accepts redirect URIs
   registered on the web client in advance.
2. The web client's secret must not be put into cloud environments: owners
   choose the packages their environment runs, so its code could read it.

So the cloud path gets a fixed home on the marketing site, `https://sektar.io`,
which is both the one registered **redirect URI** (a relay that forwards
Google's answer to the environment that asked) and the **token endpoint** for
those environments (a broker that adds the secret on the way to Google). The
environment keeps its tokens; sektar.io keeps nothing.

## Who is covered

| Deployment | Sign-in | Notes |
|---|---|---|
| Local (desktop app, `ph vetra`, localhost) | desktop client, as today | unchanged, byte for byte |
| Vetra cloud, `*.vetra.io` host | relay + broker | new |
| Vetra cloud, customer's own domain | not yet (falls back to the hand-off) | Vetra has no stored proof a custom domain points at it; see Open |
| Self-hosted with own Google client files | own web client, direct to Google, as today | a mounted web client always wins |
| Self-hosted / Portle home without client files | the hand-off to the computer, as today | the relay refuses such hosts, so it is never switched on |

## Goals

- A user on a Vetra cloud environment adds Gmail / Calendar and signs in right
  there, with no Google console change per environment and no secret in the environment.
- Local and self-hosted flows keep working exactly as today.
- Integrations in the cloud survive pod restarts.

## Non-goals

- Custom domains (until Vetra can prove routing, see Open).
- Self-hosters using the publisher's app.
- Google's verification / CASA assessment for `gmail.readonly` (separate track).

## Anti-goals

- The client secret anywhere but sektar.io (and OpenBao).
- Tokens or codes stored or logged on sektar.io.
- sektar.io usable as an open redirect.
- Any change for localhost / desktop sign-ins or for hosts with their own client files.

## Flow (cloud)

1. The card's *Sign in with Google* calls `startOAuth`. The app has a `relay`
   and no web client file on this host, the host's callback is not loopback:
   `redirect_uri` = `https://sektar.io/api/oauth/callback`, `client_id` =
   relay.clientId, PKCE on, `state` = `<random>.<base64url(own callback)>`.
2. Google → `sektar.io/api/oauth/callback`. The relay checks the target (https,
   path `…/oauth/callback`, host under `vetra.io` or confirmed by Vetra) and
   303s the browser to it with all of Google's parameters.
3. The environment's normal callback runs `completeOAuth`; the code exchange
   posts to relay.tokenUrl (`https://sektar.io/api/oauth/token`) without a
   secret; the broker adds it and returns Google's answer unchanged.
4. Every later refresh also goes through the broker.

## Parts

### 1. Framework (`powerhouse`, branch `feat/oauth-relay`)

- `workflows.oauthApps[].relay = { clientId, redirectUri, tokenUrl }`, from the
  config file or passed programmatically by the host.
- Applies only when: publisher app, web kind (non-loopback callback), **no web
  client file** on the host, relay present. Otherwise unchanged.
- Relayed start/exchange/refresh as in the flow; the attempt and the stored
  token record that they are relayed, so refresh never guesses from config.
- New query `workflowRuntime.oauthSignIn(appId, redirectUri): DESKTOP | WEB | RELAY | NONE`,
  the same decision `startOAuth` makes, for the UI.

### 2. Vetra (`vetra-cloud-package`, branch `feat/oauth-relay-host-lookup`)

- Public `vetraEnvironmentHostKnown(host): Boolean!` (observability subgraph):
  true for live environments' generated hosts; custom domains false for now.

### 3. sektar.io (`sektar-marketing-site`, branch `feat/oauth-relay`)

- `GET /api/oauth/callback` (relay), `POST /api/oauth/token` (broker),
  `GET /api/oauth/hosts/<host>` (`{accepted}`).
- Secret from OpenBao `kv/powerhouse/shared/sektar-google-oauth` into
  `SEKTAR_GOOGLE_CLIENT_ID` / `SEKTAR_GOOGLE_CLIENT_SECRET`.

### 4. Sektar (this repo, branch `feat/cloud-oauth`)

**Host (hosts/cli).** At start, when `PUBLIC_URL` is not loopback and no web
client file is mounted for `sektar-google`, ask
`GET https://sektar.io/api/oauth/hosts/<PUBLIC_URL host>` (short timeout, a few
retries). Only on `{accepted: true}` pass `sektar-google` with its `relay` to
the switchboard (`workflows.oauthApps`, programmatically); otherwise pass the
config as today. The relay values (client id, both URLs) are public and live in
code/config; the relay base is overridable by env for staging.

**Runner identity (processors/integration-reconciler).** Today the runner is
`switchboard@<os hostname>`, which changes with every pod restart and orphans
cloud integrations. When `PUBLIC_URL` is set and not loopback, the runner id
and label are the `PUBLIC_URL` host; otherwise the hostname as today (local
unchanged).

**User flows (editors/integrations, editors/sektar/kit).** The UI asks
`oauthSignIn("sektar-google")` instead of guessing from the page's hostname:

- page on loopback, or mode `DESKTOP`: today's flow, unchanged;
- mode `RELAY` or `WEB` (sign-in works from this browser): the cloud flow —
  no "Before you start / local-first" step, no "continue on your computer"
  ending; the card shows a primary *Sign in with Google* right away; copy says
  sign-in finishes here (and, for `RELAY`, that Google sends you back through
  sektar.io, which passes the sign-in on and keeps nothing);
- mode `NONE`, or the query unavailable (older framework): today's hand-off flow.

Card and reconciler texts that say "on this computer" / "on <host>" use the
environment wording in the cloud. Re-sign-in for lost tokens, scope changes and
wrong accounts uses the same card button; the detail page shows it too.
`startOAuth` errors are shown with a plain explanation instead of the raw text.

**Config.** `sektar-google` keeps its client files for local and self-hosted
use; the relay is added by the host as above, so self-hosters and Portle homes
are never switched to it.

## Rollout

framework release → Sektar pins it → Vetra release (lookup) → sektar.io deploy
with the two secrets set on its environment → Google console: add
`https://sektar.io/api/oauth/callback` to the `sektar-google` web client →
Sektar cloud environments pick it up on their next start.

## Security notes

- The relay forwards only to `*.vetra.io` / Vetra-confirmed hosts and only to
  `…/oauth/callback` paths; anything else gets a failure page.
- A forwarded code is useless without the PKCE verifier that never leaves the
  environment; the broker refuses a code exchange without a verifier or with
  another redirect URI.
- The broker refreshes for anyone holding a refresh token of this client; a
  refresh token only exists in the environment of the user who granted it.

## Open

- Custom domains: Vetra should record that the tenant's certificate for the
  domain was issued (proof it routes to Vetra); then the lookup can say yes.
- Integrations already claimed in the cloud by an old pod hostname stay
  orphaned (cloud sign-in never worked, so few exist); remove and re-add them.
