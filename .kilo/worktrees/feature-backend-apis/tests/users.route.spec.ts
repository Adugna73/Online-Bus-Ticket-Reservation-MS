import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock next-auth
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
import { getServerSession } from 'next-auth/next';

// stub prisma
const mockFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockUserUpdate = vi.fn()
const mockRoleFindUnique = vi.fn()
const mockRoleFindFirst = vi.fn()
const mockSiteFind = vi.fn()
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
      findMany: vi.fn()
    },
    role: {
      findUnique: mockRoleFindUnique,
      findFirst: mockRoleFindFirst
    },
    site: {
      findMany: mockSiteFind
    },
    team: {
      findUnique: vi.fn(() => Promise.resolve({ id: 'team1', managerId: 'mgr1' }))
    }
  }
}))

let POST: any
let GET: any
beforeEach(async () => {
  mockFindUnique.mockReset()
  mockUserCreate.mockReset()
  mockUserUpdate.mockReset()
  mockSiteFind.mockReset()
  mockFindUnique.mockReset()
  const mod = await import('../app/api/users/route')
  POST = mod.POST
  GET = mod.GET
})

describe('POST /api/users', () => {
  it('allows manager to create technician under supervisor', async () => {
    // prepare session user as manager
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr1', role: 'manager' } })
    // stub currentUser load
    mockFindUnique.mockResolvedValue({ id: 'mgr1', role: { key: 'manager' }, assignedRegion: ['r1'], assignedZone: ['z1'] })

    const body = {
      fullName: 'Tech One',
      roleKey: 'technician',
      email: 'tech1@example.com',
      staffId: 'S123',
      teamId: 'team1',
      immediateSupervisorId: 'sup1',
      assignedRegion: ['r1'],
      assignedZone: ['z1'],
      location: 'Sheshemene'
    }

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })

    mockUserCreate.mockResolvedValue({ id: 'u1', ...body })

    const res: any = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('u1')
    // ensure prisma.create called with team and supervisor
    expect(mockUserCreate).toHaveBeenCalled()
    const called = mockUserCreate.mock.calls[0][0].data
    expect(called.teamId).toBe('team1')
    expect(called.immediateSupervisorId).toBe('sup1')
    expect(called.location).toBe('Sheshemene')
  })

  it('returns 409 on duplicate staffId', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockFindUnique.mockResolvedValue({ id: 'admin1', role: { key: 'admin' } })

    const body = { fullName: 'User', roleKey: 'technician', email: 'u@test', staffId: 'DUP' }
    const req = new Request('http://localhost/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const error = new Error()
    ;(error as any).code = 'P2002'
    mockUserCreate.mockRejectedValue(error)

    const res: any = await POST(req as any)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('unique_violation')
  })

  it('inherits location from supervisor when none provided', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr1', role: 'manager' } });
    // first call for currentUser
    mockFindUnique
      .mockResolvedValueOnce({ id: 'mgr1', role: { key: 'manager' }, assignedRegion: ['r1'], assignedZone: ['z1'] })
      // second call inside POST to lookup supervisor
      .mockResolvedValueOnce({ id: 'sup1', location: 'Zwayne' });

    const body = {
      fullName: 'Blade Runner',
      roleKey: 'technician',
      email: 'br@future.com',
      staffId: 'B123',
      teamId: 'team2',
      immediateSupervisorId: 'sup1',
      assignedRegion: ['r1'],
      assignedZone: ['z1'],
      // no location property

    };

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    mockUserCreate.mockResolvedValue({ id: 'u2', ...body, location: 'Zwayne' });

    const res: any = await POST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.location).toBe('Zwayne');
    const called = mockUserCreate.mock.calls[0][0].data;
    expect(called.location).toBe('Zwayne');
  })
})

describe('GET /api/users filtering', () => {
  it('includes users whose location matches a site in the region', async () => {
    // no auth required for this check as we'll bypass with api key
    mockSiteFind.mockResolvedValue([{ name: 'Bako' }, { name: 'Other' }]);

    const req = new Request('http://localhost/api/users?role=supervisor&regionId=WR');
    // stub prisma.user.findMany to capture where
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const prisma = await import('../lib/prisma');
    (prisma.prisma.user.findMany as any) = mockFindMany;

    const res: any = await GET(req as any);
    expect(mockFindMany).toHaveBeenCalled();
    const whereArg = mockFindMany.mock.calls[0][0].where;
    // should contain an OR clause including location equals Bako
    const hasLocationOr = whereArg.AND.some((cl: any) =>
      cl.OR && cl.OR.some((o: any) => o.location && o.location.equals === 'Bako')
    );
    expect(hasLocationOr).toBe(true);
  });
});

// simple PUT test to cover location update

describe('PUT /api/users/[id]', () => {
  it('updates the location field', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'mgr1', role: 'manager' } })
    mockFindUnique.mockResolvedValue({ id: 'mgr1', role: { key: 'manager' }, assignedRegion: ['r1'], assignedZone: ['z1'] })

    const body = { location: 'Adama' }
    const req = new Request('http://localhost/api/users/u1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })

    // stub update call
    mockUserUpdate.mockResolvedValue({ id: 'u1', ...body })

    const mod = await import('../app/api/users/[id]/route')
    const PUT = mod.PUT
    const res: any = await PUT(req as any, { params: Promise.resolve({ id: 'u1' }) } as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.location).toBe('Adama')
  })

  it('prevents scoped HQ admin from promoting user to admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'hq1', role: 'admin' } });
    mockFindUnique.mockResolvedValue({ id: 'hq1', role: { key: 'admin' }, email: 'buzayehu.fininsa@ethiotelecom.et' });
    const body = { roleKey: 'admin' };
    const req = new Request('http://localhost/api/users/u1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    mockFindUnique.mockResolvedValueOnce({ id: 'u1', role: { key: 'technician' }, assignedRegion: [], assignedZone: [] });
    const mod = await import('../app/api/users/[id]/route');
    const PUT = mod.PUT;
    const res: any = await PUT(req as any, { params: Promise.resolve({ id: 'u1' }) } as any);
    expect(res.status).toBe(403);
  });
})

