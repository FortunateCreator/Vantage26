export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

export type CoinSymbol = 'BTC' | 'BCH' | 'DOGE' | 'LTC' | 'XRP' | 'ETH'

export type PackageSlug =
  | 'matchday'
  | 'vip'
  | 'champions'
  | 'final'
  | 'platinum'

export interface Package {
  slug: PackageSlug
  name: string
  tagline: string
  priceFrom: string
  hospitality: string
  matches: string
  includes: string[]
}

export interface Lead {
  leadId: string
  source: 'website' | 'telegram'
  status: LeadStatus
  name: string
  email: string
  phone?: string
  packageSlug?: PackageSlug
  packageName?: string
  coin?: CoinSymbol | string
  notes?: string
  telegramUserId?: number
  telegramMessageId?: number
  createdAt: string
  updatedAt: string
}

export interface LeadCreateInput {
  source: 'website' | 'telegram'
  name: string
  email: string
  phone?: string
  packageSlug?: PackageSlug
  packageName?: string
  coin?: string
  notes?: string
  telegramUserId?: number
}
