import "dotenv/config";
import { describe, it, expect } from 'vitest'
import { authOptions } from '../lib/auth'

const SEED_PASSWORD = 'bus@12345'

const getAuthorize = () => {
  const provider = authOptions.providers?.[0] as any
  const authorize = provider?.options?.authorize ?? provider?.authorize
  return authorize as (credentials: any, req: any) => Promise<any>
}

describe('authOptions authorize', () => {
  it('returns user when bcrypt password matches', async () => {
    const authorize = getAuthorize()
    const result = await authorize({ email: 'passenger@bus.et', password: SEED_PASSWORD }, null as any)

    expect(result).toBeTruthy()
    expect(result.email).toBe('passenger@bus.et')
    expect(result.role).toBe('passenger')
  })

  it('throws invalid_password when bcrypt does not match', async () => {
    const authorize = getAuthorize()
    await expect(authorize({ email: 'passenger@bus.et', password: 'wrongpassword' }, null as any)).rejects.toThrow('invalid_password')
  })

  it('throws invalid_email when identifier is not an email', async () => {
    const authorize = getAuthorize()
    await expect(authorize({ email: 'notanemail', password: 'p' }, null as any)).rejects.toThrow('invalid_email')
  })

  it('returns user with admin role for ADMIN user', async () => {
    const authorize = getAuthorize()
    const result = await authorize({ email: 'admin@bus.et', password: SEED_PASSWORD }, null as any)

    expect(result).toBeTruthy()
    expect(result.role).toBe('admin')
  })

  it('returns user with supervisor role for STAFF user', async () => {
    const authorize = getAuthorize()
    const result = await authorize({ email: 'staff@bus.et', password: SEED_PASSWORD }, null as any)

    expect(result).toBeTruthy()
    expect(result.role).toBe('supervisor')
  })
})
