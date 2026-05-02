# Inovus Email Worker

A single Cloudflare Worker that powers `support@inovuslabs.org`:

- Exposes `POST /contact` for project contact forms.
- Receives email at `support+<project>@inovuslabs.org` via Email Routing.
- Uses Workers AI to classify intent.
- Sends an auto-acknowledgment to the sender.
- Sends a per-ticket summary to `inovuslabs@kjcmt.ac.in`.
- Persists tickets per-project in Durable Object SQLite via the Agents SDK.

## Architecture

```
Project sites ─POST /contact─▶ Worker ─env.SEND.send─▶ support+<slug>@inovuslabs.org
                                                                 │
                                          Email Routing catch-all │
                                                                 ▼
Direct email ──────────────────────────────────────────▶ Worker email() handler
                                                                 │
                                                                 ▼
                                            SupportAgent (Durable Object, keyed by slug)
                                              ├─ PostalMime parse
                                              ├─ Workers AI classify
                                              ├─ this.sql INSERT ticket
                                              └─ returns reply + summary MIME
                                                                 │
                                                                 ▼
                                          Worker calls message.reply() + env.SEND.send()
```

## Local development

```sh
npm install
npm run cf-typegen     # generate Worker types from wrangler.jsonc
npm run typecheck
npm run dev            # wrangler dev
```

Test the contact endpoint:

```sh
curl -X POST http://127.0.0.1:8787/contact \
  -H 'content-type: application/json' \
  -d '{
    "projectSlug": "spectrum",
    "name": "Jane Doe",
    "fromEmail": "jane@example.com",
    "subject": "Question about Spectrum",
    "message": "Hi, how do I run the demo locally?",
    "turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"
  }'
```

For local testing of the Turnstile flow, use Cloudflare's documented test keys
(set `TURNSTILE_SECRET` to `1x0000000000000000000000000000000AA` to always pass).

Test the email handler:

```sh
wrangler email send \
  --from someone@example.com \
  --to support+spectrum@inovuslabs.org \
  --subject "Test" \
  --body "Hello, this is a test."
```

## Cloudflare dashboard setup (one-time)

1. Add `inovuslabs.org` to Cloudflare DNS.
2. **Email → Email Routing → Enable** on `inovuslabs.org`. Cloudflare will add the required MX + SPF records.
3. **Destination addresses → Add** `inovuslabs@kjcmt.ac.in` and confirm via the verification email. (Required so `env.SEND.send()` is allowed to deliver to it.)
4. **Routing rules → Catch-all → Send to Worker → `inovus-email-worker`**. This is what makes `support+anything@inovuslabs.org` reach the Worker.
5. Create a Turnstile site for the project form domains; copy the **secret** key:
   ```sh
   wrangler secret put TURNSTILE_SECRET
   ```
6. Confirm DKIM is auto-configured by Email Routing for `inovuslabs.org`. The reply API rejects messages without valid DMARC.

## Contact form contract

Each project site sends:

```http
POST https://inovus-email-worker.<subdomain>.workers.dev/contact
Content-Type: application/json

{
  "projectSlug": "spectrum",
  "name": "Jane Doe",
  "fromEmail": "jane@example.com",
  "subject": "Question about Spectrum",
  "message": "...",
  "turnstileToken": "<token from cf-turnstile widget>"
}
```

Response:

```json
{ "ok": true, "ticketRef": "abc123XYZ_" }
```

Project slugs: lowercase letters, digits, hyphens; 1–32 characters.

## File layout

| File | Purpose |
| --- | --- |
| `src/index.ts` | `fetch` + `email` entry points; routes by project slug |
| `src/agent.ts` | `SupportAgent` Durable Object: parse, classify, persist, render |
| `src/contact.ts` | `POST /contact` handler with Turnstile + Zod validation |
| `src/classify.ts` | Workers AI Llama 3.1 prompt → JSON intent |
| `src/templates.ts` | Auto-reply, team summary, contact-form MIME builders |
| `src/routing.ts` | `parseSubAddress` for `support+slug@domain` |
| `src/types.ts` | `Env`, `Intent`, classification + ticket types |
| `wrangler.jsonc` | Bindings: `AI`, `SEND`, `SupportAgent` (DO with SQLite) |

## Deferred (v1 scope)

- Autonomous FAQ replies (knowledge base lookup before reply step).
- Per-project RAG.
- Web dashboard for browsing tickets.
- Slack / Discord notifications.
- Rate limiting beyond Turnstile.
