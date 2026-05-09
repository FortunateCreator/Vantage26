import { NextRequest, NextResponse } from 'next/server'
import { createLead, setTelegramMessageId } from '@/lib/leads'
import { postLeadToChannel } from '@/lib/telegram'
import { getPackage } from '@/lib/packages'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, packageSlug, coin, notes } = body

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: 'Name and email are required' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const pkg = packageSlug ? getPackage(packageSlug) : undefined

    const lead = await createLead({
      source: 'website',
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : undefined,
      packageSlug: pkg?.slug,
      packageName: pkg?.name,
      coin: coin ? String(coin).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined
    })

    /* fire-and-update — post to admin channel */
    try {
      const messageId = await postLeadToChannel(lead)
      await setTelegramMessageId(lead.leadId, messageId)
    } catch (err) {
      console.error('Failed to post lead to Telegram channel:', err)
      /* lead is already saved in DB; don't fail the request */
    }

    return NextResponse.json({ ok: true, leadId: lead.leadId })
  } catch (err) {
    console.error('Lead creation error:', err)
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 }
    )
  }
}
