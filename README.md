# QuoteFollow

> Har quotation ka follow-up, bina bhoole.

QuoteFollow makes sure no quotation a Gujarat industrial supplier sends goes more than 3 working days without a follow-up. The product spec is in [docs/PRD.md](docs/PRD.md) and the full system design in [docs/SYSTEM_PLAN.md](docs/SYSTEM_PLAN.md).

**Current milestone: S0, foundation and concierge console.** This is the internal tool the founder uses to run the Phase 1 concierge service: import a client's open quotes, let the cadence engine say what to chase each day, and record outcomes. WhatsApp capture (M1–M2) comes after the Phase 1 gate.

## Layout

| Path | What |
|---|---|
| `packages/core` | Pure domain logic: IST working-day calendar, cadence (Day 2/5/10 → escalate), quote status machine, ₹ amount parser (lakh/crore, Gujarati and Devanagari digits), phone and date normalisers, report totals |
| `packages/db` | Mongoose models and **tenant-scoped repositories**. Nothing outside this package touches models |
| `packages/config` | zod-validated env |
| `apps/server` | Fastify API (`src/api.ts`) and worker (`src/worker.ts`: cadence sweeper plus the 09:30 IST founder digest) |
| `apps/web` | Next.js console: clients, Today/chase list, quotes, quote history, CSV/XLSX import, settings |
| `infra` | Dockerfiles, Compose for a single EC2 box, Caddy (TLS), deploy script |

## Run locally

You need Node 22. pnpm comes through corepack. Docker is not required.

```bash
cp .env.example .env
```

Set `ADMIN_TOKEN` in `.env` to a long random string. Then install dependencies:

```bash
corepack pnpm install
```

Start the dev MongoDB (port 27018), API (4000), worker and web (3000):

```bash
corepack enable   # once, so turbo can find pnpm
corepack pnpm dev
```

In a second terminal, load demo data:

```bash
corepack pnpm seed
```

Open http://localhost:3000 and sign in with your `ADMIN_TOKEN`.

## Tests

```bash
corepack pnpm test
```

- **core:** calendar, cadence, status machine, amounts, phones and dates
- **db:** tenant isolation, sweep-to-escalation, revisions, concurrent writes
- **server:** auth, the quote API, CSV import with dry run and duplicates, the chase list

DB and API tests use an in-memory MongoDB.

## How the cadence works

- Confirming a quote schedules `nextActionAt` for Day 2. This counts **working days in IST**, skips Sundays and tenant holidays (the Diwali week is pre-seeded), and never lands in quiet hours (20:00–09:30).
- The worker sweeps every 60 s and advances quotes that are due: Day 2, then 5, then 10, then escalation to the owner 2 working days later.
- Each advance logs a `nudge_due` or `escalated` event. That event puts the quote on the **chase list** until someone records an action: Sent, Buyer replied, Won, Lost, Revised or Snooze.
- Overdue steps (for example, imported old quotes) go out one working day apart rather than all at once.
- Mongo is the only source of timing, so restarts are safe. Writes use optimistic locks, so the sweeper and a human acting at the same moment can't both win.

## Setup checklist (accounts you need to create)

Needed before the pilot:
- [ ] **GitHub** repo (private). Push this folder; CI runs on push.
- [ ] **MongoDB Atlas**: an M10 (or M0 to start) cluster in **AWS Mumbai (ap-south-1)**, a database user, the EC2 IP on the allowlist, and backups turned on.
- [ ] **AWS** account, region ap-south-1:
  - an EC2 **t4g.small** (Ubuntu 24.04 ARM) with Docker installed and `/opt/quotefollow/` holding `docker-compose.yml`, `Caddyfile` and `deploy.sh` from `infra/`
  - an IAM role allowing `ssm:GetParametersByPath` on `/quotefollow/prod/*`
  - SSM parameters `/quotefollow/prod/{MONGO_URL,ADMIN_TOKEN,NODE_ENV,GH_OWNER}`
- [ ] **Domain**: point `app.` and `api.` A records at the EC2 Elastic IP. Caddy gets TLS automatically.
- [ ] GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. Deploy by pushing a `v*` tag.

Needed for M1 (after the Phase 1 gate):
- [ ] **Meta Business** account, verified business, and a WhatsApp Cloud API app. Register the QuoteFollow number and submit the utility templates in EN/HI/GU.
- [ ] **Anthropic API** key for extraction and drafting.
- [ ] **Sentry** project and **BetterStack** uptime check on `https://api.<domain>/healthz`.
- [ ] Processing agreement (DPA) template for clients, as required by the DPDP Act. Tick "DPA signed" in each client's settings before go-live.

## Next milestones

See section 10 of [docs/SYSTEM_PLAN.md](docs/SYSTEM_PLAN.md).

- **M1:** WhatsApp plumbing and magic-link login
- **M2:** quote capture from a PDF or photo with Claude
- **M3:** reminders, drafts and outcomes on WhatsApp
- **M4:** owner escalation and the Monday report
- **M5:** hardening and pilot
