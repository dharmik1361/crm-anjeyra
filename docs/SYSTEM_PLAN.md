# QuoteFollow — Full System Plan (ANJEYRA Technologies)

## Context

The PRD (`~/Downloads/PRD.md`) defines **QuoteFollow**: a WhatsApp-first tool that makes sure every quotation a Gujarat industrial supplier sends gets followed up, escalates stalled quotes to the owner, and reports rupees at risk every Monday. `/Users/dharmikjoshi/Documents/crm_anjeyra` is empty, so this is a greenfield build.

Constraints that shape every decision below:
- **Founder time:** about 8 hrs/week, solo. The P0 build is 80–100 hrs. Choose boring, low-ops tech, one deploy target, and no microservices.
- **Unit cost:** under Rs 700 per client per month. No BSP, a cheap Claude model by default, and a single small server.
- **Users live in WhatsApp.** Reps won't open an app, and owners read one message a week. The web app is secondary.
- **Gates:** the PRD says build nothing beyond concierge until Phase 1 passes. The plan respects this. Slice 0 is an internal console that *runs the concierge service*, and it becomes F7 later, so no hours are wasted.

---

## 1. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript (Node 22 LTS)** everywhere | One language across API, worker, web and shared domain logic |
| Monorepo | **pnpm workspaces + Turborepo** | Shared `core` package for cadence and status logic, used by both server and web |
| API | **Fastify** + `zod` (via `fastify-type-provider-zod`) | Fast, small, schema-validated webhooks and REST |
| Jobs | **BullMQ on Redis** for async work; a **Mongo `nextActionAt` sweeper** decides *what* is due | Mongo stays the source of truth, so a lost Redis never loses a follow-up. BullMQ gives retries, rate limits and idempotent job IDs |
| DB | **MongoDB Atlas, Mumbai (ap-south-1)**, Mongoose | Matches the PRD. Flexible `items[]` and extraction blobs. Built-in backups |
| Files | **S3 ap-south-1**, SSE-S3, per-tenant prefix, presigned URLs (15 min) | PRD requirement |
| AI | **Claude API**: `claude-haiku-5-5` for extraction and drafting, `claude-sonnet-5-5` fallback when confidence is low. Native PDF and image input, structured output via a tool/JSON schema | Model IDs come from env so they can be upgraded without a deploy |
| Messaging | **WhatsApp Cloud API direct** (Graph API), one shared number in MVP | No BSP fees |
| Email (F8) | **AWS SES inbound** → S3 → SNS → API | Cheap, same region |
| Web | **Next.js 15 (App Router) + Tailwind + shadcn/ui + TanStack Table** | Quote list, import, report page, cadence settings |
| Auth (web) | **Magic link over WhatsApp**: the user sends "login" and gets a signed one-time link (JWT, 15 min) that becomes an httpOnly session cookie | No passwords. Phone number is the identity everywhere |
| Hosting | **One EC2 t4g.small (Mumbai) running Docker Compose**: `caddy` (TLS), `api`, `worker`, `web`, `redis` | About Rs 1,500/month total. A single box is fine up to roughly 50 tenants. Move to ECS later if needed |
| Secrets | AWS SSM Parameter Store, loaded at boot | No `.env` on the box in prod |
| CI/CD | **GitHub Actions**: lint, typecheck and test, then build ARM images to GHCR, then SSH deploy with `docker compose pull && up -d` | Simple and repeatable |
| Observability | `pino` JSON logs → CloudWatch, **Sentry** (errors), **BetterStack** uptime on `/healthz`, a daily ops digest to the founder on WhatsApp | The founder learns about failures before clients do |
| Testing | **Vitest**, `mongodb-memory-server`, recorded WhatsApp webhook fixtures, and an **AI eval set** of real anonymised quotes from the concierge phase | Extraction accuracy is measured, not assumed |

---

## 2. System architecture

```
 Rep / Owner WhatsApp ──► Meta Cloud API ──webhook──► [api] Fastify
                                                       │  verify X-Hub-Signature-256
                                                       │  store raw Message, ack 200 fast
                                                       ▼
                                                 BullMQ queues (Redis)
              ┌────────────────────┬───────────────────┼──────────────────┬───────────────┐
         inbound.process     ai.extract           ai.draft          wa.send           report.weekly
              │                    │                   │                 │                 │
              ▼                    ▼                   ▼                 ▼                 ▼
      Conversation router   Claude Haiku→Sonnet   Claude Haiku     Graph API send    aggregate per tenant
      (state machine)       PDF/img/text→JSON     draft + wa.me    (template or      → WhatsApp summary
              │                    │              link             free-form by       + signed web link
              └──────────► MongoDB (source of truth) ◄─────────────24h window)
                                   ▲
                    [worker] sweeper every 60s: quotes where nextActionAt <= now
                    → enqueue cadence.step (jobId = quoteId:step, idempotent)

 Coordinator/Owner browser ──► [web] Next.js ──► [api] REST (/v1/*, tenant-scoped session)
 Email BCC (F8) ──► SES inbound ──► S3 ──► SNS ──► [api] /hooks/email ──► ai.extract
```

**Key principles**
1. **Ack webhooks within 200 ms.** Persist the raw payload, enqueue, return 200. Meta retries on slowness, so processing is idempotent on `wamid`.
2. **Mongo decides time, Redis does work.** Every quote stores `nextActionAt`. The sweeper is the only thing that schedules cadence, so restarts and Redis loss are safe.
3. **Tenant scoping in the repository layer.** Every query helper requires a `tenantId`, and a lint rule bans raw model access outside `packages/db`.
4. **No outbound buyer messages in MVP.** We only ever message the client's staff. Buyer nudges go through a `wa.me/<buyer>?text=<draft>` link that the rep taps, so the message is sent from their own phone.

---

## 3. Repository layout

```
quotefollow/
├─ apps/
│  ├─ server/           # one image, two entrypoints
│  │  ├─ src/api.ts      # Fastify: /hooks/whatsapp, /hooks/email, /v1/*, /healthz
│  │  ├─ src/worker.ts   # BullMQ processors + sweeper + cron (Monday report)
│  │  ├─ src/routes/     # webhooks, quotes, import, reports, auth, settings
│  │  ├─ src/jobs/       # inbound, extract, draft, send, cadence, escalate, report, purge
│  │  └─ src/conversation/  # WhatsApp state machine + intent parser
│  └─ web/              # Next.js: /login, /quotes, /import, /report/[token], /settings
├─ packages/
│  ├─ core/             # PURE domain logic, no I/O: cadence calc, working days, status
│  │                    #   transitions, amount parser (lakh/crore/GST), metrics formulas
│  ├─ db/               # Mongoose models, indexes, tenant-scoped repositories
│  ├─ whatsapp/         # Graph API client, template registry, webhook types, interactive builders
│  ├─ ai/               # prompts, zod schemas, extract(), draft(), evals/ (fixtures + runner)
│  └─ config/           # env schema (zod), shared eslint/tsconfig
├─ infra/               # docker-compose.yml, Caddyfile, deploy.sh, SSM bootstrap
└─ .github/workflows/   # ci.yml, deploy.yml
```

---

## 4. Data model (MongoDB)

All collections carry `tenantId` and `createdAt`/`updatedAt`. Money is stored as **integer paise**, not floats.

| Collection | Key fields | Indexes |
|---|---|---|
| `tenants` | name, plan (`concierge/team/growth`), status, `cadence: {steps:[2,5,10], escalateAfter:2, quietHours:{start:'20:00',end:'09:30'}, workdays:[1..6]}`, holidays[], ownerUserId, reportDay/time, locale default, `dpaSignedAt` | — |
| `users` | tenantId, name, phone (E.164, **unique globally**), role (`owner/rep/coordinator/admin`), language pref, `lastInboundAt` (24h window), active | `phone` unique |
| `quotes` | tenantId, repId, buyer {name, company, phone, email}, quoteNumber, amountPaise, gstIncluded?, items[{desc, qty, unit, rate}], sentAt, source (`whatsapp/email/import/indiamart/manual`), attachmentKeys[], language, **status**, lostReason, revisedFromId, cadenceStep, **nextActionAt**, pausedReason, extraction {model, confidence per field, rawJson}, dedupeHash | `{tenantId,status,nextActionAt}`, `{nextActionAt}` partial (open only), `{tenantId,quoteNumber}`, `{tenantId,repId,status}` |
| `quote_events` | tenantId, quoteId, type (`logged, confirmed, edited, nudge_due, draft_sent_to_rep, rep_marked_sent, buyer_replied, outcome_won/lost/revised, snoozed, escalated, owner_action`), actorId, meta, at | `{quoteId,at}`, `{tenantId,type,at}` |
| `messages` | direction, wamid (unique), from/to, type, body/media, templateName, status (sent/delivered/read/failed), cost category, `quoteId?`, raw | `wamid` unique, `{quoteId}` |
| `conversations` | userId, state (`idle, awaiting_confirm, awaiting_edit_field, awaiting_lost_reason, awaiting_revised_amount`), contextQuoteId, expiresAt | `userId` unique, TTL on `expiresAt` |
| `import_batches` | tenantId, file key, rows, errors[], status | — |
| `audit_logs` | tenantId, actor, action, target, ip | TTL 1 yr |

**Quote status machine** (in `packages/core/status.ts`):
```
draft(extracted, unconfirmed) ─confirm─► open ─nudges(step 1..3)─► escalated
open/escalated ─buyer_replied─► replied (cadence paused; re-nudge rep after 3 working days)
any open state ─► won | lost(reason) | revised(→ new open quote, cadence reset, link revisedFromId)
snooze(n days) ─► open with nextActionAt = +n working days
```

---

## 5. Feature design (F1–F10)

### F1 Quote capture (WhatsApp) — target: median under 30 s
1. The rep forwards a PDF, photo or text. The webhook stores the message, then the inbound job downloads the media. **Meta media URLs expire in about 5 minutes, so download immediately and store in S3.**
2. `ai.extract` sends Claude Haiku the document/image block plus a system prompt. It returns JSON: `{buyerName, company, phone, email, quoteNumber, amount, currency, gstIncluded, items[], quoteDate, language, confidence:{field:0..1}}`.
   - If any of amount, phone or buyer is below 0.75 confidence, retry with Sonnet. If it is still low, ask the rep that one field.
   - `core/amount.ts` normalises "2.45 L", "₹2,45,000", "245000/-", Gujarati/Devanagari digits and crore.
3. Send the rep an **interactive reply-button card**: "Quote #Q-118 · Patel Chemicals · ₹2,45,000 · 3 items" with buttons **Confirm / Edit / Not a quote**.
4. Edit opens a list message of fields. The rep types the new value. A web edit link is also offered.
5. **Dedupe** on `hash(tenantId, quoteNumber || buyerPhone+amount+date)` and warn: "Looks like Q-118 already logged".
6. Log `logged` and `confirmed` events, and store the time between them for the logging-friction metric.

### F2 Cadence
- `core/cadence.ts`: `nextActionAt(sentAt, step, tenant)` counts **working days in IST**. It skips non-workdays and tenant holidays (seeded with the Gujarat calendar: Diwali week, Uttarayan, Holi and so on), and moves times inside quiet hours to 10:00 the next working day.
- The sweeper picks due quotes and enqueues `cadence.step` with `jobId=quoteId:step` so steps never run twice.
- The step job runs `ai.draft`, then sends the reminder to the rep.

### F3 AI-drafted follow-ups
- Context: the quote fields, the step number, the buyer language and the last buyer note if the rep provided one.
- Output: a short, polite message in Gujarati, Hindi or English (Hinglish is allowed) that references the quote number, items and amount. It never invents a discount or date.
- The reminder card shows the draft text, a **"Send to buyer" `wa.me` link** prefilled with the draft (one tap opens the rep's WhatsApp), and buttons **Sent ✓ / Buyer replied / More…**.
- "More…" opens a list message: Won, Lost, Revised, Snooze 3d, Snooze 7d, Regenerate draft. Reply buttons allow at most 3, so the list covers the rest.

### F4 Outcome logging
- Buttons or list rows plus a **keyword parser** for typed replies: `won`, `jeet`, `mali gayu`, `lost`, `gaya`, `revised 230000`, `snooze 5`, in English, Hindi and Gujarati.
- **Which quote?** Use the WhatsApp `context.id` of the message being replied to (we map outbound `wamid` → `quoteId`). Without context, use the conversation's `contextQuoteId`. If it is still ambiguous, ask with a list of the rep's 10 most recent open quotes.
- Lost asks for a reason from a list: price, delivery time, went to competitor, project cancelled, no response, specs mismatch, other.

### F5 Owner escalation
- If there is no outcome `escalateAfter` working days after the final step, set status `escalated` and send the owner: "⚠️ ₹2,45,000 · Patel Chemicals · Q-118 · Rep: Ramesh · 12 days silent" with buttons **Remind rep / I'll call / Mark lost**.
- Batch escalations into one message per owner per day (10:00) so owners don't get spammed.

### F6 Monday report (Monday 09:30 IST, configurable)
- Five lines, rupees first: Open ₹X (n) · At risk ₹Y (>7 days no reply) · Won this week ₹Z · Lost ₹W · Top stalled rep.
- Then a per-rep breakdown and a **signed link** (`/report/[token]`, valid 7 days, read-only, no login needed).
- Highlight: "Saved by QuoteFollow: ₹A". This counts **attributed wins**, meaning a `buyer_replied` or `won` event after a nudge and no buyer reply before it. This is the number that drives renewals.

### F7 Web quote list (P1, but Slice 0 builds it first for concierge)
- A TanStack table with filters (status, rep, age bucket, source, amount range), inline edit, bulk status change, and CSV/XLSX export.
- **Import:** upload CSV/XLSX (parsed with `exceljs`), a column-mapping screen that remembers mappings per tenant, a dry-run preview showing row errors, then commit as an `import_batch`.

### F8 Email capture (P1)
- Each tenant gets `<slug>@in.quotefollow.in`. The rep BCCs it, SES stores the email in S3, and SNS calls the API. Match the rep by sender email, then run the same `ai.extract`.
- A later buyer reply on the same thread (In-Reply-To/References) produces a `buyer_replied` event. This is real reply detection on the email channel.

### F9 IndiaMART sync (P2)
- A poll job runs every 15 minutes per tenant using the tenant's own IndiaMART CRM key (encrypted at rest with AWS KMS). It creates **RFQ** records, not quotes. When the rep later sends a quote, it links to the RFQ.

### F10 Auto-send to buyer (P2)
- This needs a per-tenant WhatsApp number (Embedded Signup), buyer opt-in records, approved templates (probably billed at the **marketing** rate), and a human escalation path. It is out of scope until Phase 3 pricing is validated.

---

## 6. WhatsApp design rules
- **24h window tracking:** `users.lastInboundAt`. Inside the window, send free-form or interactive messages (free). Outside it, send an approved **utility template**.
- Templates to submit on day 1, in EN, HI and GU: `quote_reminder`, `owner_escalation`, `weekly_report`, `login_link` (authentication category), `capture_confirm_fallback`.
- Every template ends with a button that **reopens the window**, so the rest of the exchange is free.
- Handle status webhooks (sent/delivered/read/failed) and alert when sends fail or a template is paused.
- Respect the Cloud API throughput limits through BullMQ `limiter` on `wa.send`.
- **Known limitation to tell clients:** in MVP we **can't see buyer replies on WhatsApp** because they go to the rep's phone. "Buyer replied" is reported by the rep with one tap. This changes the PRD's "any buyer reply pauses cadence" into "rep-reported reply pauses cadence". Email (F8) can detect replies automatically.

---

## 7. AI design
- `packages/ai/extract.ts`: one function, a zod-validated output, and a **prompt-cached** system prompt (the static instructions plus few-shot examples are cached, which cuts cost).
- `packages/ai/draft.ts`: 3 tone variants per step (gentle, value reminder, closing question). Temperature is low.
- **Guardrails:** drafts may only reference fields that exist on the quote. A post-check regex verifies that the amount and quote number in the draft match the record.
- **Eval harness** (`packages/ai/evals`): 50+ anonymised real quotes collected during concierge (PDFs, WhatsApp photos, typed Gujarati). `pnpm eval` reports field accuracy. **Gate: amount ≥ 98% and buyer phone ≥ 95% before launch.** It runs in CI on prompt changes.
- **Cost tracking:** store tokens per call per tenant in `messages`/`ai_usage`, and surface the monthly cost per tenant in the admin view.

---

## 8. Security, privacy, compliance (DPDP Act 2023)
- Webhook HMAC verification (`X-Hub-Signature-256`) and SNS signature verification.
- Tenant isolation is enforced in repositories and covered by tests: "user of tenant A cannot read quote of tenant B".
- PII: logs redact phone, email and amounts (pino redact paths). S3 objects are private and served through presigned URLs.
- Sessions: httpOnly, Secure, SameSite=Lax cookies. Report links are signed, expiring and read-only.
- Rate limiting (`@fastify/rate-limit`), helmet headers, and dependency scanning (Dependabot plus `pnpm audit` in CI).
- **DPDP:** the client is the data fiduciary and we are the processor. Every tenant needs a DPA before go-live (`tenant.dpaSignedAt`). Mongo and S3 stay in Mumbai.
  - **Delete-on-exit:** a `tenant.purge` job removes quotes, events, messages and S3 prefix files, then writes a deletion certificate to the audit log.
  - **Retention:** raw messages are kept 180 days, and quote data until the contract ends.
- Backups: Atlas daily snapshots with point-in-time restore, and S3 versioning on attachments.

---

## 9. Ops and admin
- **Super-admin console** (`/admin`, founder only): create tenant, add users by phone, set cadence, impersonate (logged in audit), see per-tenant AI and WhatsApp cost, and see failed jobs (Bull Board mounted behind admin auth).
- **Onboarding flow:** create the tenant, add the owner and reps by phone, each person receives a `welcome` template, and the owner taps "Activate". Concierge setup bulk-imports open quotes with F7.
- **Daily founder digest (WhatsApp):** new quotes, failed sends, low-confidence extractions, AI spend, and errors.

---

## 10. Build sequence (milestones, hours are estimates)

| # | Milestone | Contents | Hrs |
|---|---|---|---|
| **S0** | **Foundation + concierge console** *(allowed before the gate, because it runs the concierge)* | Monorepo, CI, Docker Compose, Atlas/S3/SSM, env schema, models, admin + `/quotes` table + CSV import, cadence calc in `core` with tests, founder-only WhatsApp reminders listing what to chase today | 20 |
| **M1** | WhatsApp plumbing | Meta app + number, webhook verify/sign, message store, send client, template registry, 24h window logic, conversation state store, magic-link login | 12 |
| **M2** | F1 capture | Media → S3, Claude extract + fallback, amount parser, confirm/edit flow, dedupe, eval harness seeded with concierge data | 18 |
| **M3** | F2 + F3 + F4 | Sweeper, cadence job, draft generation, wa.me link, outcome buttons/list/keywords, context-to-quote mapping, snooze, revised | 18 |
| **M4** | F5 + F6 | Escalation batching, owner actions, Monday report aggregation, signed report page, attributed-win calculation | 12 |
| **M5** | Hardening + pilot | Sentry, uptime, founder digest, tenant-isolation tests, purge job, DPA field, load test with 300 quotes/tenant, onboard pilot clients 1–3 | 10 |
| | **P0 total** | | **≈ 90** |
| M6 | F8 email capture | SES inbound, thread reply detection | 10 |
| M7 | F9 / F10 | Only after Phase 3 demand | — |

Order matters. **S0 runs during Phase 1 concierge.** M1–M5 start only after the Phase 1 gate (at least 2 paying concierge clients and at least 1 credited win by week 6). Concierge data becomes the AI eval set.

---

## 11. Metrics instrumentation (from PRD), computed from `quote_events`
- **Follow-up coverage:** the share of open quotes with `rep_marked_sent` within 3 working days of `sentAt`.
- **Silent-loss rate:** closed quotes with lostReason `no response` and no `buyer_replied` event, compared with the baseline captured at import.
- **Reply rate**, **attributed wins**, **logging friction** (median of confirmed.at minus logged.at), and **retention** (from tenant plan status).
- All of these are shown on `/admin/metrics` and per tenant on the report page.

---

## 12. Risks the system design addresses
| PRD risk | System answer |
|---|---|
| Reps don't forward quotes | 30-second capture, coordinator bulk import, a weekly per-rep "quotes logged" count in the owner report (social pressure) |
| AI misreads amounts | Confirm card on every quote, confidence threshold, Sonnet fallback, eval gate in CI |
| Template recategorised as marketing | Cost category tracked per message, alert on change, buyer messages stay on rep phones |
| Founder time | One box, one image, the sweeper is restart-safe, founder digest and Bull Board for triage |
| Meta copies the feature | Quote-first model, email and IndiaMART channels, owner rupee reporting |

---

## 13. Verification (how we know it works)
1. **Unit (Vitest):** `core/cadence` (working days, holidays, quiet hours, Diwali edge cases), `core/amount` (50+ formats), the status machine (every transition, including illegal ones).
2. **Integration:** spin up `mongodb-memory-server` and Redis, replay recorded WhatsApp webhook fixtures (PDF forward, confirm button, list reply, keyword "won"), and assert the quote state and outbound message payloads, with the Graph API mocked using `nock`.
3. **AI evals:** `pnpm eval` against the fixture set. Accuracy thresholds fail CI.
4. **End-to-end on staging:** a separate Meta test number plus `staging.quotefollow.in`. Run a script that forwards a sample quote PDF from a test phone, then fast-forward time by setting `nextActionAt` to now. Confirm the Day 2, 5 and 10 reminders, the escalation to the owner phone, and that `POST /admin/run-report` produces the Monday report with correct totals.
5. **Pilot acceptance:** for one real tenant over 2 weeks, median logging under 30 s, zero missed cadence steps (sweeper audit), and the report totals match the coordinator's Excel.

---

## What happens when this plan is approved
I scaffold **S0** in `/Users/dharmikjoshi/Documents/crm_anjeyra`:
- the monorepo, `packages/core` with cadence, amount and status logic plus tests, `packages/db` models, the Fastify server skeleton with `/healthz`, the Next.js app with the `/quotes` table and import, Docker Compose, and CI
- `pnpm test` green and the app running locally

Cloud accounts (Meta, Atlas, AWS) need you to create them and supply keys. I'll write the setup checklist.
