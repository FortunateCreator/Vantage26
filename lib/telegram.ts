import { Lead } from './types'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL = process.env.TELEGRAM_CHANNEL_ID!
const BASE = `https://api.telegram.org/bot${TOKEN}`

const STATUS_LABELS: Record<string, string> = {
  new: '🟡 NEW',
  contacted: '🟠 CONTACTED',
  quoted: '🔵 QUOTED',
  won: '🟢 WON',
  lost: '🔴 LOST'
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function formatLeadCard(lead: Lead): string {
  const lines = [
    `${STATUS_LABELS[lead.status]} | <b>${lead.leadId}</b>`,
    `<i>Source: ${lead.source}</i>`,
    '',
    `👤 <b>Name:</b> ${escapeHtml(lead.name)}`,
    `📧 <b>Email:</b> ${escapeHtml(lead.email)}`,
    lead.phone ? `📱 <b>Phone:</b> ${escapeHtml(lead.phone)}` : null,
    lead.packageName ? `📦 <b>Package:</b> ${escapeHtml(lead.packageName)}` : null,
    lead.coin ? `💰 <b>Payment:</b> ${escapeHtml(lead.coin)}` : null,
    lead.notes ? `📝 <b>Notes:</b> ${escapeHtml(lead.notes)}` : null,
    '',
    `🕐 <b>Created:</b> ${new Date(lead.createdAt).toUTCString()}`
  ]
  if (lead.updatedAt !== lead.createdAt) {
    lines.push(`🔄 <b>Updated:</b> ${new Date(lead.updatedAt).toUTCString()}`)
  }
  return lines.filter(l => l !== null).join('\n')
}

const STATUS_BUTTONS = [
  [
    { text: '📞 Contacted', callback_data: 'status:contacted' },
    { text: '💰 Quoted', callback_data: 'status:quoted' }
  ],
  [
    { text: '✅ Won', callback_data: 'status:won' },
    { text: '❌ Lost', callback_data: 'status:lost' }
  ]
]

export async function postLeadToChannel(lead: Lead): Promise<number> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHANNEL,
      text: formatLeadCard(lead),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: STATUS_BUTTONS.map(row =>
          row.map(b => ({ ...b, callback_data: `${b.callback_data}:${lead.leadId}` }))
        )
      }
    })
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || 'Telegram send failed')
  return data.result.message_id
}

export async function editLeadCard(
  messageId: number,
  lead: Lead
): Promise<void> {
  await fetch(`${BASE}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHANNEL,
      message_id: messageId,
      text: formatLeadCard(lead),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: STATUS_BUTTONS.map(row =>
          row.map(b => ({ ...b, callback_data: `${b.callback_data}:${lead.leadId}` }))
        )
      }
    })
  })
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, any> = {}
): Promise<void> {
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra
    })
  })
}

export async function answerCallbackQuery(
  id: string,
  text: string
): Promise<void> {
  await fetch(`${BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text })
  })
}
