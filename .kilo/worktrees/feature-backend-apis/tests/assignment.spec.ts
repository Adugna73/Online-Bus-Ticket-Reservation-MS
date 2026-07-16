import { describe, it, expect } from 'vitest'
import { isAazOrHqSite, findPreferredManagerForSite } from '../lib/assignment'

describe('assignment helpers — HQ/AAZ preference', () => {
  it('isAazOrHqSite detects HQ/AAX cases correctly', () => {
    expect(isAazOrHqSite('hq-central', 'some')).toBe(true)
    expect(isAazOrHqSite('WAAZ-1', 'some')).toBe(true)
    expect(isAazOrHqSite('', 'AAZ')).toBe(true)
    expect(isAazOrHqSite('', 'CAAZ')).toBe(true)
    expect(isAazOrHqSite('north', 'region-x')).toBe(false)
  })

  it('findPreferredManagerForSite prefers HQ manager, then zone, then region', () => {
    const zones = [
      { id: 'z1', name: 'hq-central', regionId: 'r1' },
      { id: 'z2', name: 'waaz-01', regionId: 'r2' },
    ]
    const regions = [
      { id: 'r1', name: 'Region 1' },
      { id: 'r2', name: 'AAZ' },
    ]

    const mgrHQ = { id: 'm-hq', teamId: 't1', assignedRegion: [], assignedZone: [], locationCategory: 'Head Quarter' }
    const mgrZone = { id: 'm-zone', teamId: 't2', assignedRegion: [], assignedZone: ['z1'], locationCategory: '' }
    const mgrRegion = { id: 'm-region', teamId: 't3', assignedRegion: ['r1'], assignedZone: [], locationCategory: '' }

    // HQ exists -> chosen
    let chosen = findPreferredManagerForSite([mgrHQ, mgrZone, mgrRegion], 'z1', 'r1', zones, regions)
    expect(chosen?.id).toBe('m-hq')

    // Without HQ manager, prefer zone match
    chosen = findPreferredManagerForSite([mgrZone, mgrRegion], 'z1', 'r1', zones, regions)
    expect(chosen?.id).toBe('m-zone')

    // When no zone match but region is AAZ -> prefer region match
    const mgrR2 = { id: 'm-r2', teamId: 't4', assignedRegion: ['r2'], assignedZone: [], locationCategory: '' }
    chosen = findPreferredManagerForSite([mgrR2], undefined, 'r2', zones, regions)
    expect(chosen?.id).toBe('m-r2')

    // No preferred candidates -> undefined
    chosen = findPreferredManagerForSite([], 'z1', 'r1', zones, regions)
    expect(chosen).toBeUndefined()
  })
})
