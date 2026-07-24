import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('../lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const { mockFindUnique, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))
vi.mock('../lib/prisma', () => ({
  prisma: { user: { findUnique: mockFindUnique, update: mockUpdate, delete: mockDelete } },
}))

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

let GET: any
let DELETE: any
beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../app/api/users/[id]/route')
  GET = mod.GET
  DELETE = mod.DELETE
})

describe('GET /api/users/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/users/u1'), ctx('u1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when user not found', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1' } })
    mockFindUnique.mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/users/ghost'), ctx('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns the user with a role key on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1' } })
    mockFindUnique.mockResolvedValue({ id: 'u1', fullName: 'User', email: 'u@bus.et', role: 'PASSENGER' })
    const res: any = await GET(new Request('http://localhost/api/users/u1'), ctx('u1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('u1')
    expect(data.role).toEqual({ key: 'PASSENGER' })
  })
})

describe('DELETE /api/users/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await DELETE(new Request('http://localhost/api/users/u1', { method: 'DELETE' }), ctx('u1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 forbidden when current user is not admin', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'staff1' } })
    mockFindUnique.mockResolvedValue({ id: 'staff1', role: 'STAFF' })
    const res: any = await DELETE(new Request('http://localhost/api/users/u1', { method: 'DELETE' }), ctx('u1'))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forbidden')
  })

  it('returns 404 when target user not found', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1' } })
    mockFindUnique.mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' }) // currentUser
    mockFindUnique.mockResolvedValueOnce(null) // target
    const res: any = await DELETE(new Request('http://localhost/api/users/ghost', { method: 'DELETE' }), ctx('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when trying to delete an admin user', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1' } })
    mockFindUnique.mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' }) // currentUser
    mockFindUnique.mockResolvedValueOnce({ id: 'admin2', role: 'ADMIN' }) // target
    const res: any = await DELETE(new Request('http://localhost/api/users/admin2', { method: 'DELETE' }), ctx('admin2'))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Cannot delete admin users')
  })

  it('deletes the user on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1' } })
    mockFindUnique.mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' }) // currentUser
    mockFindUnique.mockResolvedValueOnce({ id: 'u1', role: 'PASSENGER' }) // target
    mockDelete.mockResolvedValue({ id: 'u1' })
    const res: any = await DELETE(new Request('http://localhost/api/users/u1', { method: 'DELETE' }), ctx('u1'))
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })
})
