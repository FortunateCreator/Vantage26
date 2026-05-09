/**
 * Run this once after deploying to Vercel to register your webhook.
 *
 * Usage:
 *   node scripts/setup-webhook.js
 *
 * Reads from .env.local — make sure these are set:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *   NEXT_PUBLIC_APP_URL
 */
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found')
    process.exit(1)
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2]
  }
}

async function main() {
  loadEnv()

  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!token || !secret || !appUrl) {
    console.error('❌ Missing required env vars in .env.local')
    process.exit(1)
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`

  console.log(`Registering webhook → ${webhookUrl}`)

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query']
    })
  })

  const data = await res.json()
  if (data.ok) {
    console.log('✅ Webhook registered successfully')
  } else {
    console.error('❌ Webhook registration failed:', data)
    process.exit(1)
  }

  /* Show current webhook info */
  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const infoData = await info.json()
  console.log('\nCurrent webhook info:')
  console.log(JSON.stringify(infoData.result, null, 2))
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
