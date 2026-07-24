import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('../lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: { user: { findUnique: mockFindUnique } } }))

let GET: any
beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../app/api/users/me/route')
  GET = mod.GET
})

describe('GET /api/users/me', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/users/me'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when session has no user id', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: {} })
    const res: any = await GET(new Request('http://localhost/api/users/me'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the user is not found in DB', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'ghost' } })
    mockFindUnique.mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/users/me'))
    expect(res.status).toBe(404)
  })

  it('returns the current user with relations on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockFindUnique.mockResolvedValue({
      id: 'u1', fullName: 'Me', email: 'me@bus.et', role: { id: 'r1', key: 'PASSENGER', displayName: 'Passenger' },
      subordinates: [], immediateSupervisor: null,
    })
    const res: any = await GET(new Request('http://localhost/api/users/me'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('u1')
    expect(data.role.key).toBe('PASSENGER')
    expect(mockFindUnique.mock.calls[0][0].where.id).toBe('u1')
  })
})
