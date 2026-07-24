import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
import { getServerSession } from 'next-auth/next';

const mockFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockUserUpdate = vi.fn()
const mockFindMany = vi.fn()
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
      findMany: mockFindMany
    },
  }
}))

let POST: any
let GET: any
beforeEach(async () => {
  mockFindUnique.mockReset()
  mockUserCreate.mockReset()
  mockUserUpdate.mockReset()
  mockFindMany.mockReset()
  const mod = await import('../app/api/users/route')
  POST = mod.POST
  GET = mod.GET
})

describe('POST /api/users', () => {
  it('allows admin to create a new staff user', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockFindUnique.mockResolvedValue({ id: 'admin1', role: 'ADMIN' })

    const body = {
      fullName: 'Staff One',
      role: 'STAFF',
      email: 'staff1@example.com',
      phone: '+251912345678',
      password: 'Password123!'
    }

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })

    mockUserCreate.mockResolvedValue({ id: 'u1', fullName: body.fullName, email: body.email })

    const res: any = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('u1')
    expect(mockUserCreate).toHaveBeenCalled()
  })

  it('returns 409 on duplicate email', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockFindUnique.mockResolvedValue({ id: 'admin1', role: 'ADMIN' })

    const body = { fullName: 'User', role: 'PASSENGER', email: 'dup@test.com', password: 'Password123!' }
    const req = new Request('http://localhost/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const error = new Error()
    ;(error as any).code = 'P2002'
    mockUserCreate.mockRejectedValue(error)

    const res: any = await POST(req as any)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('unique_violation')
  })
})

describe('GET /api/users', () => {
  it('lists users', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockFindUnique.mockResolvedValue({ id: 'admin1', role: 'ADMIN' })
    mockFindMany.mockResolvedValue([{ id: 'u1', fullName: 'User One' }])

    const req = new Request('http://localhost/api/users?role=PASSENGER');
    const res: any = await GET(req as any);
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalled();
  });
});

describe('PUT /api/users/[id]', () => {
  it('updates user fields', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockFindUnique.mockResolvedValue({ id: 'admin1', role: 'ADMIN' })

    const body = { fullName: 'Updated Name' }
    const req = new Request('http://localhost/api/users/u1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })

    mockUserUpdate.mockResolvedValue({ id: 'u1', ...body })

    const mod = await import('../app/api/users/[id]/route')
    const PUT = mod.PUT
    const res: any = await PUT(req as any, { params: Promise.resolve({ id: 'u1' }) } as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.fullName).toBe('Updated Name')
  })
})
