import { kv } from '@vercel/kv'
import { Lead, LeadCreateInput, LeadStatus } from './types'

function generateLeadId(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `VTG-${year}-${rand}`
}

export async function createLead(input: LeadCreateInput): Promise<Lead> {
  const leadId = generateLeadId()
  const now = new Date().toISOString()

  const lead: Lead = {
    leadId,
    source: input.source,
    status: 'new',
    name: input.name,
    email: input.email,
    phone: input.phone,
    packageSlug: input.packageSlug,
    packageName: input.packageName,
    coin: input.coin,
    notes: input.notes,
    telegramUserId: input.telegramUserId,
    createdAt: now,
    updatedAt: now
  }

  await kv.set(`lead:${leadId}`, lead)
  await kv.zadd('leads:by-date', { score: Date.now(), member: leadId })
  await kv.sadd(`leads:status:new`, leadId)
  await kv.sadd(`leads:source:${input.source}`, leadId)

  /* secondary indexes for search */
  await kv.set(`lead-by-email:${input.email.toLowerCase()}`, leadId)
  if (input.telegramUserId) {
    await kv.set(`lead-by-tg:${input.telegramUserId}`, leadId)
  }

  return lead
}

export async function getLead(leadId: string): Promise<Lead | null> {
  return await kv.get<Lead>(`lead:${leadId}`)
}

export async function updateLeadStatus(
  leadId: string,
  newStatus: LeadStatus
): Promise<Lead | null> {
  const lead = await getLead(leadId)
  if (!lead) return null

  await kv.srem(`leads:status:${lead.status}`, leadId)
  await kv.sadd(`leads:status:${newStatus}`, leadId)

  const updated: Lead = {
    ...lead,
    status: newStatus,
    updatedAt: new Date().toISOString()
  }
  await kv.set(`lead:${leadId}`, updated)
  return updated
}

export async function setTelegramMessageId(
  leadId: string,
  messageId: number
): Promise<void> {
  const lead = await getLead(leadId)
  if (!lead) return
  await kv.set(`lead:${leadId}`, { ...lead, telegramMessageId: messageId })
}

export async function findLeadByEmail(email: string): Promise<Lead | null> {
  const leadId = await kv.get<string>(`lead-by-email:${email.toLowerCase()}`)
  if (!leadId) return null
  return getLead(leadId)
}

export async function findLeadByTelegramUser(
  tgUserId: number
): Promise<Lead | null> {
  const leadId = await kv.get<string>(`lead-by-tg:${tgUserId}`)
  if (!leadId) return null
  return getLead(leadId)
}

export async function listRecentLeads(limit = 20): Promise<Lead[]> {
  const ids = await kv.zrange<string[]>('leads:by-date', 0, limit - 1, {
    rev: true
  })
  if (!ids?.length) return []
  const leads = await Promise.all(ids.map(id => getLead(id)))
  return leads.filter((l): l is Lead => l !== null)
}

export async function listLeadsByStatus(
  statuses: LeadStatus[]
): Promise<Lead[]> {
  const sets = await Promise.all(
    statuses.map(s => kv.smembers(`leads:status:${s}`))
  )
  const ids = Array.from(new Set(sets.flat()))
  if (!ids.length) return []
  const leads = await Promise.all(ids.map(id => getLead(id)))
  return leads
    .filter((l): l is Lead => l !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getStats() {
  const [newL, contacted, quoted, won, lost] = await Promise.all([
    kv.scard('leads:status:new'),
    kv.scard('leads:status:contacted'),
    kv.scard('leads:status:quoted'),
    kv.scard('leads:status:won'),
    kv.scard('leads:status:lost')
  ])
  const [website, telegram] = await Promise.all([
    kv.scard('leads:source:website'),
    kv.scard('leads:source:telegram')
  ])
  return {
    new: newL,
    contacted,
    quoted,
    won,
    lost,
    total: newL + contacted + quoted + won + lost,
    bySource: { website, telegram }
  }
}
