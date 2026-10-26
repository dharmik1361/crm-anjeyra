# ANJEYRA QuoteFollow — Product Requirements

Owner @Dharmik · ANJEYRA Technologies · Status: Pre-validation draft

## Summary

QuoteFollow makes sure no quotation a Gujarat industrial supplier sends goes unanswered for more than 3 working days. It is not a CRM. It logs every quote sent, drafts and schedules follow-ups on WhatsApp and email, escalates stalled quotes to the owner, and reports the rupee value at risk every week.

- **For:** industrial suppliers and manufacturers in Gujarat with 2–15 salespeople and quote-driven B2B sales.
- **Promise:** every open quote has a next action and an owner; lost-to-silence quotes drop.
- **Working name:** QuoteFollow (replaces "SalesOS" from the original concept, which overpromised a full CRM).
- **Status:** pre-validation. Nothing gets built beyond a concierge service until the gates in Release phases pass.

## Problem

Industrial B2B sellers lose deals after the quote is sent, not before. RFQs arrive from IndiaMART, email, phone and WhatsApp; a salesperson sends a quote; then nobody owns the follow-up. The owner finds out a month later that the buyer went to a competitor.

**Why it happens**

- Quotes live in WhatsApp chats, email sent folders and Excel, so there is no single list of what is open.
- Salespeople chase new RFQs because they feel urgent; old quotes feel like nagging.
- Owners see revenue, not leakage. They cannot name how much quoted value died in silence.

**Evidence so far (to be confirmed in interviews)**

- Modular furniture and industrial firms hire people only to log leads and chase quotation status, which shows a budget line exists.
- Long B2B cycles mean a single recovered quote can cover a year of subscription.

**Hypothesis to test:** in at least half of target firms, 30% or more of quotes get no follow-up within 7 days of sending.

## Target user and ICP

The buyer is the owner; the daily user is the salesperson or sales coordinator.

| Attribute | Ideal customer |
| --- | --- |
| Industry | Industrial suppliers, chemical and oil traders, machinery and spares, packaging, fabrication |
| Location | Ahmedabad, GIDC estates, wider Gujarat |
| Team | Owner + 2–15 salespeople or coordinators |
| Volume | 30–300 quotations sent per month |
| Ticket size | Rs 50,000 and up per order |
| Lead sources | IndiaMART, email RFQs, WhatsApp, phone, repeat buyers |
| Current tools | WhatsApp, Excel, Tally, maybe IndiaMART lead manager |
| Language | Gujarati, Hindi, English mixed |

**Personas**

- **Owner (buyer):** wants to know which money is stuck and who is sleeping on it. Reads one report a week. Will not log in daily.
- **Salesperson (user):** wants fewer things to remember. Will only use it if logging a quote takes under 30 seconds from WhatsApp.
- **Coordinator (power user, optional):** maintains the quote list today in Excel; becomes the admin.

**Not the ICP for now:** retail shops, real estate, coaching institutes, single-person freelancers, and anyone wanting bulk marketing broadcasts.

## Goals, non-goals and success metrics

Success means owners renew because they can point to a quote the system saved.

**Goals**

1. Every logged quote has a scheduled next follow-up and an owner.
2. Quotes with no reply after the cadence are escalated to the owner, never silently dropped.
3. The owner gets a weekly rupee figure: open, at risk, won, lost.

**Non-goals (MVP)**

- Lead generation, ads, or scraped-number outreach.
- A full pipeline CRM, contacts database or invoicing.
- Fully autonomous AI replies to buyers. Every outbound message is approved or templated.
- Replacing Tally or IndiaMART.

**Metrics**

| Metric | Definition | Target by end of Phase 2 |
| --- | --- | --- |
| Follow-up coverage | Open quotes with a follow-up sent within 3 working days | 90% or more |
| Silent-loss rate | Quotes closed with no buyer reply ever | Down 30% vs the client's baseline |
| Reply rate | Quotes with any buyer reply after a follow-up | Track; baseline in Phase 1 |
| Attributed wins | Won quotes where the buyer replied only after our nudge | At least 1 per client per 6 weeks |
| Logging friction | Median time to log a quote | Under 30 seconds |
| Retention | Clients paying in month 3 | 2 of 3 |

## Positioning

We win only after the quote is sent. Answering enquiries is being commoditised; owning the follow-up is not.

| Alternative | What it does well | Why it does not solve quote leakage |
| --- | --- | --- |
| [Meta Business Agent](https://www.newsbytesapp.com/news/science/you-can-now-use-whatsapp-business-s-ai-assistant-in-india/story) | Free or low-cost AI that answers, qualifies and books inside WhatsApp | Lives in one chat; no quote list, no cadence, no owner escalation, no IndiaMART or email |
| WhatsApp CRMs (AiSensy, Interakt, Gallabox, Wati) | Inbox, broadcasts, chatbots | Marketing-first; quote follow-up is a manual workflow the client must design |
| AI WhatsApp CRMs ([Groweon](https://www.groweon.com/blog/?p=1582), CRM Astra OS, Opswake) | Lead capture, AI qualification, generic follow-up | Horizontal; not built around the quotation as the unit of work |
| Vertical tools ([InteriorOS](https://www.hunted.space/product/interioros), QuickEst for solar) | Industry workflows | Not built for industrial B2B suppliers |
| Zoho Bigin, Excel | Cheap, flexible | Needs discipline the team does not have |

**Positioning line:** "Har quotation ka follow-up, bina bhoole." Every quote you send gets followed up, and you see the money at risk every Monday.

**Our edge**

- Quote-first data model, not contact-first.
- Logging by forwarding a PDF or message on WhatsApp, in Gujarati, Hindi or English.
- Founder access to Gujarat factories for warm introductions.
- Concierge setup: we import their open quotes on day one.

## MVP scope

Six features ship in the MVP; everything else waits for paying demand.

| # | Feature | User story | Acceptance criteria | Priority |
| --- | --- | --- | --- | --- |
| F1 | Quote capture | As a salesperson, I forward a quote PDF or message to the QuoteFollow WhatsApp number so it is logged without opening an app | AI extracts buyer, company, phone, amount, items, date; salesperson confirms with one tap; median under 30 s; works for Gujarati, Hindi, English | P0 |
| F2 | Follow-up cadence | As a salesperson, I get reminded when a quote needs a nudge | Default cadence Day 2, Day 5, Day 10, then escalate; editable per client; reminders arrive on WhatsApp | P0 |
| F3 | AI-drafted follow-ups | As a salesperson, I get a ready message I can send or edit | Draft references the quote number, items and amount; language matches the buyer thread; never sent without approval in MVP | P0 |
| F4 | Outcome logging | As a salesperson, I mark a quote won, lost (with reason) or revised in one reply | Reply keywords or buttons: Won, Lost, Revised, Snooze; lost reason picked from a list | P0 |
| F5 | Owner escalation | As an owner, I hear about stalled quotes before they die | Quote with no update after the last cadence step goes to the owner with salesperson name and amount | P0 |
| F6 | Monday report | As an owner, I see money open, at risk, won and lost each week | WhatsApp summary + link to a web page; per-salesperson breakdown; rupee totals | P0 |
| F7 | Web quote list | As a coordinator, I bulk-import and edit quotes | CSV or Excel import; filter by status, salesperson, age | P1 |
| F8 | Email capture | As a salesperson, I BCC a forwarding address to log emailed quotes | Same extraction as F1 | P1 |
| F9 | IndiaMART lead sync | As a salesperson, RFQs from IndiaMART appear automatically | Uses the client's own IndiaMART CRM API key | P2 |
| F10 | Auto-send to buyer | As an owner, approved templates go out without manual send | Only via approved utility templates with buyer opt-in | P2 |

**Out of scope:** contacts database, deal stages beyond quote status, invoicing, marketing broadcasts, mobile app.

## Core flows

Every quote ends in one of two places: an outcome the rep logged, or the owner's desk.

&#91;embedded content: quote lifecycle · capture, cadence, escalation, report\]

1. **Capture.** Rep forwards the quote PDF, photo or text to the QuoteFollow WhatsApp number. AI extracts fields; rep taps Confirm or corrects.
2. **Cadence.** Day 2, Day 5 and Day 10 reminders go to the rep with a drafted message. Rep sends from their own WhatsApp (MVP) and replies Sent.
3. **Outcome.** Rep replies Won, Lost + reason, Revised (new amount) or Snooze. Any buyer reply pauses the cadence until the rep updates.
4. **Escalation.** No outcome after Day 10 sends the quote to the owner with rep name, buyer and amount.
5. **Monday report.** Owner gets totals open, at risk (over 7 days without reply), won and lost, by rep, plus a link to the full list.

## Technical approach and compliance

Build on the stack you already run: Node.js, MongoDB, AWS ap-south-1, WhatsApp Cloud API direct (no BSP), Claude API for extraction and drafting.

**Components**

| Component | Choice | Note |
| --- | --- | --- |
| Messaging | WhatsApp Cloud API, one number per tenant later; one shared number in MVP | Avoids BSP fees |
| Extraction | Claude Haiku on PDF, image or text; Sonnet fallback on low confidence | Structured JSON output with confidence per field |
| Drafting | Claude Haiku with the quote and last buyer message as context | Gujarati, Hindi, English |
| Scheduler | MongoDB-backed job queue (Agenda or BullMQ on Redis) | Cadence and Monday report |
| Storage | S3 for attachments, signed URLs | Per-tenant prefix |
| Web | Next.js page: quote list, import, report | No mobile app |

**Data model (MVP)**

- `Tenant` — name, plan, cadence settings, owner phone.
- `User` — tenant, name, phone, role (owner, rep, coordinator).
- `Quote` — tenant, rep, buyer name, company, phone, amount, items, quote number, sentAt, source, attachment, status (open, replied, won, lost, revised, escalated), lostReason, cadenceStep, nextActionAt.
- `QuoteEvent` — quote, type (logged, nudged, sent, buyer-replied, outcome, escalated), actor, timestamp. Powers attribution.

**WhatsApp rules we design around**

- In MVP, QuoteFollow messages only the client's own staff. Reps message QuoteFollow first, so most traffic falls in free service windows.
- Reminders outside a window use approved utility templates at about Rs 0.115 per message plus GST.
- Buyer-facing messages are sent by the rep from their own WhatsApp. No buyer opt-in needed from us in MVP.
- Auto-send to buyers (F10) needs buyer opt-in, approved templates and a human escalation path. Quote follow-ups may be classed as marketing (about Rs 0.86 per message), which changes unit cost.

**Data protection:** the client is the data owner; we process buyer contact data on their behalf. Add a processing agreement and delete-on-exit to the contract, in line with India's DPDP Act.

## Pricing, unit economics and capacity

Charge from the first client; margins are healthy, but founder hours are the real constraint.

**Pricing (to validate, excluding GST)**

| Plan | Price | Includes |
| --- | --- | --- |
| Concierge (Phase 1 only) | Rs 2,999 per month | We run the follow-up list manually for them |
| Team | Rs 3,999 per month | Up to 5 reps, F1–F6 |
| Growth | Rs 6,999 per month | Up to 15 reps, F1–F8, IndiaMART sync when built |
| Setup | Rs 5,000 one-time | Import of open quotes, cadence setup, staff onboarding |

**Unit cost per client per month (approximate, at 150 quotes)**

| Cost line | Estimate | Basis |
| --- | --- | --- |
| WhatsApp templates | Rs 50–100 | Up to 450 utility reminders at about Rs 0.115, many free inside service windows |
| Claude API | Rs 250–400 | Extraction per quote plus drafts per nudge, mostly Haiku |
| Hosting share | Rs 200 | Shared AWS stack, small instance + MongoDB |
| **Total** | **Rs 500–700** | Gross margin about 80–85% on the Team plan |

**Honest revenue math:** 10 Team clients = Rs 39,990 per month before GST and churn. That covers costs and proves demand; it does not replace a salary. Reaching Rs 1 lakh per month needs about 20 clients on a mix of plans.

**Founder capacity (at about 8 hours per week outside GoDinDin)**

| Work | Hours per week |
| --- | --- |
| Concierge service, 3 clients | 4–5 |
| Interviews and selling | 3 |
| Building | 0–1 |

The P0 build is roughly 80–100 hours. At 8 hours a week with concierge clients running, that is 12 or more weeks. Do not start the build until Phase 1 passes, and drop one other side project before Phase 2.

## Release phases

Four phases, each unlocked by a gate; failing a gate means stop or switch niche, not push on.

&#91;embedded content: release phases · 4 phases, 3 gates, relative weeks\]

Weeks are counted from the first interview. The detailed week-by-week plan, interview script and concierge offer are in the tabs of this doc.

## Risks, open questions and kill criteria

The biggest risk is that reps will not log quotes; everything else is solvable.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Reps do not forward quotes | High | Fatal | Owner mandates it; coordinator bulk-imports weekly; measure logging rate from week 1 |
| Owner does not read the report | Medium | High | Report is 5 lines on WhatsApp, rupees first |
| Meta adds quote follow-up to Business Agent | Medium | High | Stay quote-first, multi-channel (email, IndiaMART), owner reporting |
| Follow-ups classed as marketing templates | Medium | Medium | MVP sends buyer messages from rep phones; price Phase 3 at the marketing rate |
| Founder time runs out | High | High | Hard cap of 3 concierge clients; drop one side project before Phase 2 |
| AI misreads amounts | Medium | Medium | Rep confirms every extraction; confidence threshold triggers a question |

**Open questions**

- Which sub-segment leaks most: chemicals and oil, machinery spares, or packaging?
- Will owners pay Rs 2,999 for a manual service, or only for software?
- Do buyers reply better to rep-sent nudges or company-number nudges?
- Is IndiaMART the main RFQ source for the ICP?

**Kill criteria**

- Fewer than 5 of 15 interviews show 30%+ quotes unchased → stop.
- Fewer than 2 paying concierge clients by week 6 → stop or switch niche once.
- No credited win across 3 clients by week 6 → do not build.
- Fewer than 2 of 3 renew by month 3 → stop building features; fix retention or exit.
