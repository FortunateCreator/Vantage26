import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import {
  createLead,
  setTelegramMessageId,
  updateLeadStatus,
  getLead,
  findLeadByEmail,
  listRecentLeads,
  listLeadsByStatus,
  getStats
} from '@/lib/leads'
import {
  postLeadToChannel,
  editLeadCard,
  sendMessage,
  answerCallbackQuery,
  formatLeadCard,
  escapeHtml
} from '@/lib/telegram'
import { packages, getPackage } from '@/lib/packages'
import { LeadStatus, PackageSlug } from '@/lib/types'

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!

export async function POST(req: NextRequest) {
  const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (incomingSecret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = await req.json()

  try {
    /* ─── ADMIN: callback button tapped on a lead card ─── */
    if (update.callback_query) {
      await handleCallback(update.callback_query)
      return NextResponse.json({ ok: true })
    }

    /* ─── CUSTOMER OR ADMIN: text message ─── */
    if (update.message) {
      await handleMessage(update.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ ok: true }) /* always 200 to Telegram */
  }
}

/* ═══════════════════════════════════════════════════
   CALLBACK QUERIES (status buttons + bot inline keyboards)
═══════════════════════════════════════════════════ */
async function handleCallback(cb: any) {
  const { id, data, message, from } = cb
  const parts = data.split(':')

  /* Admin status update — only works in the leads channel */
  if (parts[0] === 'status') {
    const newStatus = parts[1] as LeadStatus
    const leadId = parts[2]
    const updated = await updateLeadStatus(leadId, newStatus)
    if (updated && updated.telegramMessageId) {
      await editLeadCard(updated.telegramMessageId, updated)
    }
    await answerCallbackQuery(id, `✓ ${leadId} → ${newStatus}`)
    return
  }

  /* Customer bot: package detail */
  if (parts[0] === 'pkg') {
    const slug = parts[1] as PackageSlug
    const pkg = getPackage(slug)
    if (!pkg) {
      await answerCallbackQuery(id, 'Package not found')
      return
    }
    const text = [
      `<b>${pkg.name}</b>`,
      `<i>${pkg.tagline}</i>`,
      '',
      `💰 <b>From:</b> ${pkg.priceFrom}`,
      `🎟 <b>Hospitality:</b> ${pkg.hospitality}`,
      `⚽ <b>Matches:</b> ${pkg.matches}`,
      '',
      '<b>Includes:</b>',
      ...pkg.includes.map(i => `  ✦ ${i}`)
    ].join('\n')

    await sendMessage(message.chat.id, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✦ Begin Enquiry', callback_data: `enquire:${slug}` }],
          [{ text: '← Back to Packages', callback_data: 'packages' }]
        ]
      }
    })
    await answerCallbackQuery(id, '')
    return
  }

  /* Customer bot: start enquiry flow */
  if (parts[0] === 'enquire') {
    const slug = parts[1] as PackageSlug
    const pkg = getPackage(slug)
    await kv.set(
      `tg-flow:${from.id}`,
      { step: 'name', packageSlug: slug, packageName: pkg?.name },
      { ex: 1800 } /* 30 minute expiry */
    )
    await sendMessage(
      message.chat.id,
      `<b>${pkg?.name}</b>\n\nLet's begin your enquiry. What is your <b>full name</b>?`
    )
    await answerCallbackQuery(id, '')
    return
  }

  /* Customer bot: show package list */
  if (parts[0] === 'packages') {
    await showPackageMenu(message.chat.id)
    await answerCallbackQuery(id, '')
    return
  }
}

/* ═══════════════════════════════════════════════════
   TEXT MESSAGES — admin commands + customer bot flow
═══════════════════════════════════════════════════ */
async function handleMessage(msg: any) {
  const chatId = msg.chat.id
  const fromId = msg.from?.id
  const text = (msg.text || '').trim()

  /* Admin commands run from the leads channel only */
  const isAdminChannel = String(chatId) === CHANNEL_ID

  if (isAdminChannel) {
    await handleAdminCommand(chatId, text)
    return
  }

  /* Otherwise: customer-facing bot conversation */
  if (text.startsWith('/')) {
    await handleCustomerCommand(chatId, fromId, text)
    return
  }

  /* Mid-flow text input (name → email → phone → notes) */
  await handleFlowInput(chatId, fromId, text)
}

/* ──────── ADMIN COMMANDS ──────── */
async function handleAdminCommand(chatId: number, text: string) {
  if (text === '/leads') {
    const leads = await listRecentLeads(20)
    if (!leads.length) {
      await sendMessage(chatId, 'No leads yet.')
      return
    }
    const lines = leads.map(
      l =>
        `${statusEmoji(l.status)} <code>${l.leadId}</code> · ${escapeHtml(l.name)} · ${escapeHtml(l.packageName || '—')}`
    )
    await sendMessage(chatId, `<b>Recent leads</b>\n\n${lines.join('\n')}`)
    return
  }

  if (text === '/pending') {
    const leads = await listLeadsByStatus(['new', 'contacted'])
    if (!leads.length) {
      await sendMessage(chatId, 'Nothing pending. ✓')
      return
    }
    const lines = leads.map(
      l => `${statusEmoji(l.status)} <code>${l.leadId}</code> · ${escapeHtml(l.name)}`
    )
    await sendMessage(chatId, `<b>Pending follow-ups</b>\n\n${lines.join('\n')}`)
    return
  }

  if (text === '/won') {
    const leads = await listLeadsByStatus(['won'])
    const lines = leads.length
      ? leads.map(
          l => `🟢 <code>${l.leadId}</code> · ${escapeHtml(l.name)} · ${escapeHtml(l.packageName || '—')}`
        )
      : ['No closed-won leads yet.']
    await sendMessage(chatId, `<b>Won leads</b>\n\n${lines.join('\n')}`)
    return
  }

  if (text === '/stats') {
    const s = await getStats()
    const t = [
      '<b>📊 Lead pipeline</b>',
      '',
      `🟡 New: ${s.new}`,
      `🟠 Contacted: ${s.contacted}`,
      `🔵 Quoted: ${s.quoted}`,
      `🟢 Won: ${s.won}`,
      `🔴 Lost: ${s.lost}`,
      '',
      `Total: ${s.total}`,
      '',
      `🌐 From website: ${s.bySource.website}`,
      `🤖 From Telegram: ${s.bySource.telegram}`
    ].join('\n')
    await sendMessage(chatId, t)
    return
  }

  if (text.startsWith('/lead ')) {
    const leadId = text.replace('/lead ', '').trim()
    const lead = await getLead(leadId)
    if (!lead) {
      await sendMessage(chatId, `Not found: ${leadId}`)
      return
    }
    await sendMessage(chatId, formatLeadCard(lead))
    return
  }

  if (text.startsWith('/search ')) {
    const q = text.replace('/search ', '').trim()
    const lead = q.includes('@')
      ? await findLeadByEmail(q)
      : await getLead(q)
    if (!lead) {
      await sendMessage(chatId, `No match for "${escapeHtml(q)}".`)
      return
    }
    await sendMessage(chatId, formatLeadCard(lead))
    return
  }

  if (text === '/help' || text === '/start') {
    const t = [
      '<b>Admin commands</b>',
      '',
      '/leads — recent 20 leads',
      '/pending — new + contacted',
      '/won — closed-won leads',
      '/stats — pipeline summary',
      '/lead VTG-2026-XXXX — full lead details',
      '/search someone@email.com — find by email or ID'
    ].join('\n')
    await sendMessage(chatId, t)
    return
  }
}

/* ──────── CUSTOMER BOT COMMANDS ──────── */
async function handleCustomerCommand(
  chatId: number,
  fromId: number | undefined,
  text: string
) {
  const cmd = text.split(' ')[0].toLowerCase()

  if (cmd === '/start') {
    /* clear any prior flow */
    if (fromId) await kv.del(`tg-flow:${fromId}`)
    await sendMessage(
      chatId,
      [
        '<b>Welcome to Vantage 26</b>',
        '',
        '<i>Private concierge for the FIFA World Cup 2026.</i>',
        '',
        'Hospitality packages, private aviation, Rolls-Royce transfers, and 24/7 concierge.',
        '',
        'Tap below to browse our curated experiences.'
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✦ View Packages', callback_data: 'packages' }],
            [{ text: '📞 Contact Concierge', callback_data: 'enquire:' }]
          ]
        }
      }
    )
    return
  }

  if (cmd === '/packages') {
    await showPackageMenu(chatId)
    return
  }

  /* Direct package shortcuts: /matchday /vip /champions /final /platinum */
  const slug = cmd.slice(1) as PackageSlug
  const pkg = getPackage(slug)
  if (pkg) {
    await sendMessage(
      chatId,
      [
        `<b>${pkg.name}</b>`,
        `<i>${pkg.tagline}</i>`,
        '',
        `💰 From: ${pkg.priceFrom}`,
        '',
        '<b>Includes:</b>',
        ...pkg.includes.map(i => `  ✦ ${i}`)
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✦ Begin Enquiry', callback_data: `enquire:${slug}` }],
            [{ text: '← All Packages', callback_data: 'packages' }]
          ]
        }
      }
    )
    return
  }

  if (cmd === '/contact') {
    if (fromId) {
      await kv.set(
        `tg-flow:${fromId}`,
        { step: 'name', packageName: 'General Enquiry' },
        { ex: 1800 }
      )
    }
    await sendMessage(chatId, 'What is your <b>full name</b>?')
    return
  }

  if (cmd === '/cancel') {
    if (fromId) await kv.del(`tg-flow:${fromId}`)
    await sendMessage(chatId, 'Enquiry cancelled. Send /start to begin again.')
    return
  }
}

async function showPackageMenu(chatId: number) {
  await sendMessage(
    chatId,
    [
      '<b>Our Packages</b>',
      '',
      'Tap any package to see full details and begin an enquiry.'
    ].join('\n'),
    {
      reply_markup: {
        inline_keyboard: packages.map(p => [
          {
            text: `${p.name}  ·  ${p.priceFrom.split(' ')[0]}`,
            callback_data: `pkg:${p.slug}`
          }
        ])
      }
    }
  )
}

/* ──────── CUSTOMER BOT MULTI-STEP FLOW ──────── */
async function handleFlowInput(
  chatId: number,
  fromId: number | undefined,
  text: string
) {
  if (!fromId) return

  const flow = await kv.get<any>(`tg-flow:${fromId}`)
  if (!flow) {
    await sendMessage(
      chatId,
      'Send /start to begin browsing packages, or /contact to speak with a concierge.'
    )
    return
  }

  /* step: name → email → phone → notes → done */
  if (flow.step === 'name') {
    flow.name = text
    flow.step = 'email'
    await kv.set(`tg-flow:${fromId}`, flow, { ex: 1800 })
    await sendMessage(
      chatId,
      `Thank you, ${escapeHtml(text)}. What is your <b>email address</b>?`
    )
    return
  }

  if (flow.step === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      await sendMessage(chatId, 'That doesn\'t look like a valid email. Please try again.')
      return
    }
    flow.email = text
    flow.step = 'phone'
    await kv.set(`tg-flow:${fromId}`, flow, { ex: 1800 })
    await sendMessage(
      chatId,
      'What\'s the best <b>phone or WhatsApp</b> number to reach you on?\n\n<i>Send "skip" to skip this.</i>'
    )
    return
  }

  if (flow.step === 'phone') {
    if (text.toLowerCase() !== 'skip') flow.phone = text
    flow.step = 'notes'
    await kv.set(`tg-flow:${fromId}`, flow, { ex: 1800 })
    await sendMessage(
      chatId,
      'Any <b>special requirements</b>? (group size, dietary, dates, specific matches…)\n\n<i>Send "skip" to finish.</i>'
    )
    return
  }

  if (flow.step === 'notes') {
    if (text.toLowerCase() !== 'skip') flow.notes = text

    /* create the lead */
    const lead = await createLead({
      source: 'telegram',
      name: flow.name,
      email: flow.email,
      phone: flow.phone,
      packageSlug: flow.packageSlug,
      packageName: flow.packageName,
      notes: flow.notes,
      telegramUserId: fromId
    })

    /* post to admin channel */
    try {
      const messageId = await postLeadToChannel(lead)
      await setTelegramMessageId(lead.leadId, messageId)
    } catch (err) {
      console.error('Failed to post lead to channel:', err)
    }

    /* clear flow */
    await kv.del(`tg-flow:${fromId}`)

    await sendMessage(
      chatId,
      [
        '<b>✦ Enquiry Received</b>',
        '',
        `Reference: <code>${lead.leadId}</code>`,
        '',
        `Thank you, ${escapeHtml(lead.name)}. Your concierge will contact you at <b>${escapeHtml(lead.email)}</b> within 2 hours.`,
        '',
        '<i>Please keep your preferred cryptocurrency ready — your package can be confirmed today.</i>'
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [[{ text: '← Browse More Packages', callback_data: 'packages' }]]
        }
      }
    )
    return
  }
}

function statusEmoji(s: string) {
  return ({ new: '🟡', contacted: '🟠', quoted: '🔵', won: '🟢', lost: '🔴' } as any)[s] || '⚪️'
}
