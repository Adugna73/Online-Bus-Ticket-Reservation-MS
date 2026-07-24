import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindFirst, mockFindUnique, mockBcryptCompare } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindUnique: vi.fn(),
  mockBcryptCompare: vi.fn(),
}))

vi.mock('../lib/prisma', () => ({
  prisma: { user: { findFirst: mockFindFirst, findUnique: mockFindUnique } },
}))
vi.mock('bcryptjs', () => ({
  default: { compare: mockBcryptCompare, hash: () => Promise.resolve('hashed') },
  compare: mockBcryptCompare,
  hash: () => Promise.resolve('hashed'),
}))

import { authOptions } from '../lib/auth'

const cb = authOptions.callbacks as any
const getAuthorize = () => {
  const provider = authOptions.providers?.[0] as any
  return (provider?.options?.authorize ?? provider?.authorize) as (c: any, r: any) => Promise<any>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBcryptCompare.mockResolvedValue(false)
})

describe('signIn callback', () => {
  it('always returns true', async () => {
    const result = await cb.signIn({ user: { id: 'u1' }, account: null, profile: null, email: null, credentials: null })
    expect(result).toBe(true)
  })
})

describe('jwt callback', () => {
  it('attaches user to token when user is present', async () => {
    const token = {}
    const out = await cb.jwt({ token, user: { id: 'u1', role: 'ADMIN' } })
    expect(out.user).toBeDefined()
    expect(out.user.role).toBe('admin')
  })

  it('refreshes token from DB when only token.user is present', async () => {
    mockFindUnique.mockResolvedValue({ id: 'u1', fullName: 'Name', email: 'a@b.com', role: 'PASSENGER', stationId: 's1', phone: 'p' })
    const token = { user: { id: 'u1', role: 'passenger' } }
    const out = await cb.jwt({ token, user: undefined })
    expect(out.user.name).toBe('Name')
    expect(out.user.role).toBe('passenger')
    expect(out.user.stationId).toBe('s1')
  })

  it('leaves token intact when DB user not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const token = { user: { id: 'ghost', role: 'passenger' } }
    const out = await cb.jwt({ token, user: undefined })
    expect(out.user.id).toBe('ghost')
  })

  it('swallows DB errors and returns token', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'))
    const token = { user: { id: 'u1', role: 'passenger' } }
    const out = await cb.jwt({ token, user: undefined })
    expect(out).toBe(token)
  })

  it('returns token unchanged when no user and no token.user', async () => {
    const token = {}
    const out = await cb.jwt({ token, user: undefined })
    expect(out).toBe(token)
  })
})

describe('session callback', () => {
  it('refreshes session.user from DB and lowercases role', async () => {
    mockFindUnique.mockResolvedValue({ id: 'u1', fullName: 'Name', email: 'a@b.com', role: 'ADMIN', stationId: 's1', phone: 'p' })
    const session = { user: {} }
    const out = await cb.session({ session, token: { user: { id: 'u1', role: 'admin' } } })
    expect(out.user.id).toBe('u1')
    expect(out.user.role).toBe('admin')
    expect(out.user.name).toBe('Name')
  })

  it('warns but still attaches when DB user not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const session = { user: {} }
    const out = await cb.session({ session, token: { user: { id: 'ghost', role: 'passenger' } } })
    expect(out.user.id).toBe('ghost')
  })

  it('swallows DB refresh errors and returns session', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'))
    const session = { user: {} }
    const out = await cb.session({ session, token: { user: { id: 'u1', role: 'passenger' } } })
    expect(out).toBe(session)
  })

  it('returns session unchanged when token has no user', async () => {
    const session = { user: {} }
    const out = await cb.session({ session, token: {} })
    expect(out).toBe(session)
  })
})

describe('authorize — remaining branches', () => {
  it('returns user via default seed password when no passwordHash', async () => {
    mockFindFirst.mockResolvedValue({ id: 'u1', fullName: 'Seed', email: 'seed@bus.et', role: 'PASSENGER', passwordHash: null })
    const authorize = getAuthorize()
    const result = await authorize({ email: 'seed@bus.et', password: 'bus@12345' }, null)
    expect(result?.id).toBe('u1')
    expect(result?.role).toBe('passenger')
  })

  it('throws invalid_password when bcrypt does not match and no seed fallback', async () => {
    mockFindFirst.mockResolvedValue({ id: 'u1', fullName: 'U', email: 'x@bus.et', role: 'PASSENGER', passwordHash: 'hash' })
    mockBcryptCompare.mockResolvedValue(false)
    const authorize = getAuthorize()
    await expect(authorize({ email: 'x@bus.et', password: 'wrong' }, null)).rejects.toThrow('invalid_password')
  })

  it('throws invalid_password when user not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    const authorize = getAuthorize()
    await expect(authorize({ email: 'nobody@bus.et', password: 'p' }, null)).rejects.toThrow('invalid_password')
  })

  it('throws invalid_password when DB lookup throws (catch branch)', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'))
    const authorize = getAuthorize()
    await expect(authorize({ email: 'err@bus.et', password: 'p' }, null)).rejects.toThrow('invalid_password')
  })
})
