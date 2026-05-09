import { Package } from './types'

export const packages: Package[] = [
  {
    slug: 'matchday',
    name: 'The Matchday Experience',
    tagline: 'Single match · FIFA Pavilion · Rolls-Royce transfer',
    priceFrom: '$2,500 per person',
    hospitality: 'FIFA Pavilion',
    matches: '1 match',
    includes: [
      'Single match ticket — FIFA Pavilion hospitality',
      'Guaranteed entry — no lottery',
      'Rolls-Royce hotel-to-stadium transfer & return',
      'Complimentary food and beverages at the lounge',
      'Official FIFA World Cup 2026 welcome gift',
      '24/7 concierge support on match day'
    ]
  },
  {
    slug: 'vip',
    name: 'The VIP Weekend',
    tagline: 'Two matches · VIP Lounge · Private jet · Rolls-Royce',
    priceFrom: '$12,000 per person',
    hospitality: 'VIP Lounge',
    matches: '2 matches',
    includes: [
      'Two matches — VIP Lounge hospitality at both',
      'Private jet city hop between venues',
      'Rolls-Royce fleet for the full duration',
      'Five-star hotel reservation (1–2 nights)',
      'Pre-match restaurant reservation',
      '24/7 dedicated concierge contact'
    ]
  },
  {
    slug: 'champions',
    name: 'The Champions Journey',
    tagline: 'Four matches · Pitchside · Private jet · 5 nights luxury hotel',
    priceFrom: '$35,000 per person',
    hospitality: 'Pitchside Lounge',
    matches: '4 matches',
    includes: [
      'Four-match series — Pitchside Lounge at every match',
      'Private jet from your origin city',
      'Inter-city private jet hops between venues',
      'Rolls-Royce fleet at every destination',
      'Five-star hotel (5 nights)',
      'Michelin restaurant reservations nightly',
      'Official memorabilia package'
    ]
  },
  {
    slug: 'final',
    name: 'The Final Experience',
    tagline: '8 matches + Final · Private Suite · Manhattan 5-star',
    priceFrom: '$85,000 per person',
    hospitality: 'Private Suite',
    matches: '8 matches + Final',
    includes: [
      'New York/NJ Venue Series — 8 matches including the Final',
      'Pitchside Lounge or Private Suite',
      'Private jet from any international origin',
      'Rolls-Royce Phantom fleet throughout',
      'Manhattan five-star hotel — 8 nights',
      'Full concierge from arrival to departure',
      'Exclusive post-Final private dinner'
    ]
  },
  {
    slug: 'platinum',
    name: 'The Platinum Tour',
    tagline: 'Full tournament · Platinum Access · Ultra-long-range jet',
    priceFrom: '$250,000 per person — fully custom',
    hospitality: 'Platinum Access',
    matches: 'Full tournament',
    includes: [
      'Full tournament follow — group stage through the Final',
      'Platinum Access hospitality across all legs',
      'Ultra-long-range private jet on standby throughout',
      'Rolls-Royce fleet at every host city',
      'Aman or Four Seasons at every destination',
      'Dedicated personal concierge & security detail',
      'On-pitch photo experience',
      'Meet-and-greet with football legends'
    ]
  }
]

export function getPackage(slug: string): Package | undefined {
  return packages.find(p => p.slug === slug)
}
