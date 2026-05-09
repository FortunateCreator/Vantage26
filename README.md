# Vantage 26 — FIFA 2026 Luxury Concierge

End-to-end stack: luxury website storefront + Telegram bot storefront + queryable lead database, all wired through a single Next.js backend.

## What's included

```
vantage26/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       # Loads luxury storefront HTML
│   ├── storefront.html                # The full luxury website
│   └── api/
│       ├── leads/route.ts             # Website → creates lead → Telegram
│       └── telegram/webhook/route.ts  # Bot conversations + admin commands
├── lib/
│   ├── types.ts                       # Shared TypeScript types
│   ├── packages.ts                    # 5 packages — single source of truth
│   ├── leads.ts                       # KV database operations
│   └── telegram.ts                    # Telegram API helpers
├── scripts/
│   └── setup-webhook.js               # Run once after deploy
├── .env.local.example
├── package.json
├── next.config.js
└── tsconfig.json
```

---

## Setup checklist

### Phase 1 — Telegram (15 min)

1. Open Telegram → search **@BotFather** → `/newbot`
   - Save the token (e.g. `7412345678:AAFxyz...`)
2. Customise the bot:
   ```
   /setdescription  → "Private concierge for FIFA World Cup 2026"
   /setabouttext    → "Vantage 26 — luxury FIFA 2026 concierge"
   /setuserpic      → upload your logo
   /setcommands     → paste:
   start - View packages and start an enquiry
   packages - Browse all packages
   matchday - The Matchday Experience
   vip - The VIP Weekend
   champions - The Champions Journey
   final - The Final Experience
   platinum - The Platinum Tour
   contact - Speak with a concierge
   cancel - Cancel current enquiry
   ```
3. Create a private channel "Vantage 26 Leads"
4. Add your bot as admin with **Post Messages** + **Edit Messages** rights
5. Get the channel ID: send a message in the channel → forward it to **@JsonDumpBot** → copy `forward_from_chat.id` (negative number like `-1001234567890`)
6. Generate a webhook secret — any random string (e.g. `vtg_wh_8x4f2k9p1m`)

### Phase 2 — Local setup (5 min)

```bash
# 1. Install deps
npm install

# 2. Copy env template
cp .env.local.example .env.local

# 3. Fill in your values in .env.local:
#    TELEGRAM_BOT_TOKEN       (from BotFather)
#    TELEGRAM_CHANNEL_ID      (from @JsonDumpBot)
#    TELEGRAM_WEBHOOK_SECRET  (any random string)
#    NEXT_PUBLIC_APP_URL      (set after deploy — for now skip)

# 4. Test locally
npm run dev
# Visit http://localhost:3000 — site loads
```

The bot won't work locally without a public webhook URL — you'll wire that up in Phase 4.

### Phase 3 — Deploy to Vercel (10 min)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial Vantage 26 build"
git remote add origin https://github.com/YOU/vantage26.git
git push -u origin main

# 2. Connect to Vercel
#    - vercel.com → New Project → import the repo
#    - Add all env vars from .env.local in Project Settings → Environment Variables
#    - Deploy

# 3. Add Vercel KV (the lead database)
#    - Project → Storage → Create Database → KV
#    - Vercel auto-injects KV_REST_API_URL, KV_REST_API_TOKEN, etc.
#    - Redeploy to pick up the new env vars

# 4. After first successful deploy, add NEXT_PUBLIC_APP_URL
#    - Set it to your live URL (e.g. https://vantage26.vercel.app)
#    - Redeploy
```

### Phase 4 — Register the Telegram webhook (1 min)

After your site is live:

```bash
# pull production env vars locally
vercel env pull .env.local

# register the webhook
npm run setup-webhook
```

You should see `✅ Webhook registered successfully`.

### Phase 5 — Smoke test (2 min)

**Test the website:**
1. Visit your live site
2. Click any package → fill name + email → Submit
3. Lead should appear in your Leads channel within 1 second with status buttons

**Test the Telegram bot:**
1. Open Telegram → search your bot → `/start`
2. Tap "View Packages" → pick one → "Begin Enquiry"
3. Walk through name → email → phone → notes
4. Lead appears in your Leads channel, source: telegram

**Test admin commands:**
In your Leads channel, send:
- `/leads` — see recent leads
- `/stats` — pipeline summary
- `/pending` — new + contacted only
- `/lead VTG-2026-XXXX` — full details
- `/search someone@email.com` — find a lead

**Test status buttons:**
On any lead card, tap "📞 Contacted" → message updates in place.

---

## Architecture

```
┌──────────────────┐         ┌──────────────────┐
│ Website          │         │ Telegram bot     │
│ (vantage26.com)  │         │ (@your_bot)      │
└──────────┬───────┘         └─────────┬────────┘
           │                           │
           │ POST /api/leads           │ webhook
           ▼                           ▼
   ┌─────────────────────────────────────────┐
   │  Next.js backend (Vercel)               │
   │  ┌──────────────────────────────────┐   │
   │  │  Vercel KV — lead database       │   │
   │  └──────────────────────────────────┘   │
   │           │                             │
   └───────────┼─────────────────────────────┘
               │ post lead card
               ▼
       ┌────────────────────┐
       │ Leads channel      │
       │ (admin view)       │
       │ Status buttons +   │
       │ admin commands     │
       └────────────────────┘
```

## How leads flow

**From website:**
1. Customer fills form → POST `/api/leads`
2. Backend creates lead in KV with status `new`
3. Backend posts lead card to Leads channel with status buttons
4. Customer sees confirmation with reference ID

**From Telegram bot:**
1. Customer messages bot → `/start` → picks package → `/enquire`
2. Bot walks them through name → email → phone → notes
3. On completion, backend creates lead, posts to Leads channel
4. Customer sees confirmation in chat with reference ID

**Status updates:**
1. You tap a status button on any lead card
2. Webhook updates the lead in KV
3. Webhook edits the message in place — no clutter, status changes inline

## Adding new packages

Edit `lib/packages.ts` — both the website and bot pick up changes automatically.

## Limits & scaling notes

- Vercel KV free tier: 30K commands/day (~3K leads/day capacity, plenty)
- Telegram bots: 30 messages/sec in groups, 1 message/sec in private chat
- For >100 leads/day, consider adding email notifications via Resend
- For multi-staff, use `/lead VTG-XXX assigned-to @username` (not implemented but easy to add)

## Security

- Bot token never exposed to client — only in server env vars
- Webhook protected by `x-telegram-bot-api-secret-token` header
- All form inputs validated server-side
- HTML escaping on all user-supplied data going into Telegram messages
