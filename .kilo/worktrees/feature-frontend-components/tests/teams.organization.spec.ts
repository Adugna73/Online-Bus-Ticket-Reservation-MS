import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock next-auth
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
import { getServerSession } from 'next-auth/next';

// stub prisma
const mockUserFindMany = vi.fn();
const mockSiteFindMany = vi.fn();
const mockRegionFindMany = vi.fn();
const mockZoneFindMany = vi.fn();
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findMany: mockUserFindMany },
    site: { findMany: mockSiteFindMany },
    region: { findMany: mockRegionFindMany },
    zone: { findMany: mockZoneFindMany },
  },
}));

let GET: any;
beforeEach(async () => {
  mockUserFindMany.mockReset();
  mockSiteFindMany.mockReset();
  mockRegionFindMany.mockReset();
  mockZoneFindMany.mockReset();
  const mod = await import('../app/api/teams/organization/route');
  GET = mod.GET;
});

describe('/api/teams/organization GET', () => {
  it('manager with unrelated zone assignment still sees supervisors in his region', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr1', role: 'manager', assignedRegion: ['r-wr'], assignedZone: ['other'] } });

    // region and zone metadata
    mockRegionFindMany.mockResolvedValue([{ id: 'r-wr', name: 'WR' }]);
    mockZoneFindMany.mockResolvedValue([{ id: 'z-wr', name: 'WR', regionId: 'r-wr' }, { id: 'other', name: 'OTHER', regionId: 'r-other' }]);

    // supervisors: one in WR region, one in OTHER
    mockUserFindMany.mockResolvedValue([
      { id: 'sup1', role: { key: 'supervisor' }, assignedRegion: ['r-wr'], assignedZone: [], locationCategory: 'WR', location: 'Loc1', employeeId: 's1', email: 'a' },
      { id: 'sup2', role: { key: 'supervisor' }, assignedRegion: ['r-other'], assignedZone: [], locationCategory: 'OTHER', location: 'Loc2', employeeId: 's2', email: 'b' },
      { id: 'sup3', role: { key: 'supervisor' }, assignedRegion: [], assignedZone: [], locationCategory: '', location: 'Bako', employeeId: 's3', email: 'c' },
      // manager record
      { id: 'mgr1', role: { key: 'manager' }, assignedRegion: ['r-wr'], assignedZone: ['other'], locationCategory: '', email: 'mgr' },
    ]);

    // include a site named Bako in WR region so the location-match logic picks up sup3
    mockSiteFindMany.mockResolvedValue([{ name: 'Bako', regionId: 'r-wr' }]);

    const req = new Request('http://localhost/api/teams/organization');
    const res: any = await GET(req as any);
    const org = await res.json();
    // should contain WR region with sup1 present
    expect(org.WR).toBeDefined();
    const areas = org.WR.areas;
    const supervisors = Object.values(areas).flat();
    const supIds = supervisors.map((s: any) => s.id);
    expect(supIds).toContain('sup1');
    // sup2 not in WR, only appears if region-other included
    expect(supIds).not.toContain('sup2');
  });

  it('manager with zone equal to region should still see all areas', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr2', role: 'manager', assignedRegion: ['r-wr'], assignedZone: ['z-wr'] } });

    mockRegionFindMany.mockResolvedValue([{ id: 'r-wr', name: 'WR' }]);
    mockZoneFindMany.mockResolvedValue([{ id: 'z-wr', name: 'WR', regionId: 'r-wr' }]);

    mockUserFindMany.mockResolvedValue([
      { id: 'sup1', role: { key: 'supervisor' }, assignedRegion: ['r-wr'], assignedZone: [], locationCategory: 'WR', location: 'Loc1', employeeId: 's1', email: 'a' },
      { id: 'sup3', role: { key: 'supervisor' }, assignedRegion: [], assignedZone: [], locationCategory: '', location: 'Bako', employeeId: 's3', email: 'c' },
      { id: 'mgr2', role: { key: 'manager' }, assignedRegion: ['r-wr'], assignedZone: ['z-wr'], locationCategory: '', email: 'mgr' },
    ]);

    mockSiteFindMany.mockResolvedValue([{ name: 'Bako', regionId: 'r-wr' }]);

    const req = new Request('http://localhost/api/teams/organization');
    const res: any = await GET(req as any);
    const org = await res.json();
    expect(org.WR).toBeDefined();
    const areas = org.WR.areas;
    const supervisors = Object.values(areas).flat();
    const supIds = supervisors.map((s: any) => s.id);
    expect(supIds).toContain('sup1');
    expect(supIds).toContain('sup3');
  });

  it('unassigned sites are limited to manager zones when zones assigned', async () => {
    // manager assigned only a single WR zone (zone-only assignment)
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr3', role: 'manager', assignedRegion: [], assignedZone: ['z-wr'] } });
    
    // debug output
    const origConsole = console.log;
    console.log = (msg: any, ...args: any[]) => {
      origConsole(msg, ...args);
    };

    mockRegionFindMany.mockResolvedValue([{ id: 'r-wr', name: 'WR' }]);
    mockZoneFindMany.mockResolvedValue([
      { id: 'z-wr', name: 'WR', regionId: 'r-wr' },
      { id: 'z-waaz', name: 'WAAZ', regionId: 'r-wr' },
    ]);

    // no supervisors needed here
    mockUserFindMany.mockResolvedValue([
      { id: 'mgr3', role: { key: 'manager' }, assignedRegion: ['r-wr'], assignedZone: ['z-wr'], locationCategory: '', email: 'mgr' },
    ]);

    // two unassigned sites: one in WR zone and one in WAAZ zone
    mockSiteFindMany.mockResolvedValue([
      { id: 'site1', name: 'Allowed', regionId: 'r-wr', zoneId: 'z-wr', supervisorStationId: null },
      { id: 'site2', name: 'Blocked', regionId: 'r-wr', zoneId: 'z-waaz', supervisorStationId: null },
    ]);

    const req = new Request('http://localhost/api/teams/organization');
    const res: any = await GET(req as any);
    const org = await res.json();
    console.log('debug org:', JSON.stringify(org, null, 2));
    const areas = org.WR.areas;
    // unassigned area should exist and its pseudo-supervisor should only have the allowed site
    expect(areas.Unassigned).toBeDefined();
    const unassignedSup = areas.Unassigned[0];
    expect(unassignedSup.name).toBe('Unassigned');
    const siteNames = (unassignedSup.sites || []).map((s: any) => s.name);
    expect(siteNames).toContain('Allowed');
    expect(siteNames).not.toContain('Blocked');
  });

  it('manager with both region and matching zone also prunes other-zone sites', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr4', role: 'manager', assignedRegion: ['r-wr'], assignedZone: ['z-wr'] } });

    mockRegionFindMany.mockResolvedValue([{ id: 'r-wr', name: 'WR' }]);
    mockZoneFindMany.mockResolvedValue([
      { id: 'z-wr', name: 'WR', regionId: 'r-wr' },
      { id: 'z-waaz', name: 'WAAZ', regionId: 'r-wr' },
    ]);

    mockUserFindMany.mockResolvedValue([
      { id: 'mgr4', role: { key: 'manager' }, assignedRegion: ['r-wr'], assignedZone: ['z-wr'], locationCategory: '', email: 'mgr' },
    ]);

    mockSiteFindMany.mockResolvedValue([
      { id: 'site1', name: 'Allowed', regionId: 'r-wr', zoneId: 'z-wr', supervisorStationId: null },
      { id: 'site2', name: 'Blocked', regionId: 'r-wr', zoneId: 'z-waaz', supervisorStationId: null },
    ]);

    const req = new Request('http://localhost/api/teams/organization');
    const res: any = await GET(req as any);
    const org = await res.json();
    const areas = org.WR.areas;
    expect(areas.Unassigned).toBeDefined();
    const names = areas.Unassigned[0].sites.map((s: any) => s.name);
    expect(names).toContain('Allowed');
    expect(names).not.toContain('Blocked');
  });
});
