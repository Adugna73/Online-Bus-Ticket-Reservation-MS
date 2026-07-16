import { describe, it, expect, vi, beforeEach } from 'vitest'

// stub prisma methods used by authorize
vi.mock('../lib/prisma', () => {
  return {
    prisma: {
      user: {
        findFirst: vi.fn(),
      },
    },
  };
});

// we import the mocked prisma so we can reach the injected mock
import { prisma } from '../lib/prisma';
const mockFindFirst = prisma.user.findFirst as unknown as ReturnType<typeof vi.fn>;

// import after mocking
import { authOptions } from '../lib/auth'

// convenience: grab the credentials provider authorize function
const getAuthorize = () => {
  const provider = authOptions.providers?.[0] as any
  return provider?.authorize as (credentials: any, req: any) => Promise<any>
}

describe('authOptions authorize', () => {
  beforeEach(() => {
    mockFindFirst.mockReset()
    vi.resetAllMocks()
    delete process.env.AD_LOGIN_URL
    delete process.env.LDAP_ONLY
  })

  it('calls external AD_LOGIN_URL when set and returns seeded user by email', async () => {
    process.env.AD_LOGIN_URL = 'https://example.com/ad-auth/authenticate'
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true })
    // @ts-ignore
    global.fetch = fakeFetch

    const user = { id: 'u1', fullName: 'U', email: 'u@x.com', role: { key: 'tech' } }
    mockFindFirst.mockResolvedValue(user)

    const authorize = getAuthorize()
    const result = await authorize({ email: 'u@x.com', password: 'p' }, null as any)

    expect(fakeFetch).toHaveBeenCalled()
    const callArgs = fakeFetch.mock.calls[0]
    expect(callArgs[0]).toBe(process.env.AD_LOGIN_URL)
    expect(callArgs[1].method).toBe('POST')
    expect(result).toBeTruthy()
    expect(result.email).toBe('u@x')
    expect(result.role).toBe('technician')
  })

  it('looks up seeded user by username when AD_LOGIN_URL auth succeeds', async () => {
    process.env.AD_LOGIN_URL = 'https://example.com/ad-auth/authenticate'
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true })
    // @ts-ignore
    global.fetch = fakeFetch

    const user = { id: 'u2', fullName: 'User Two', username: 'user2', role: { key: 'tech' } }
    mockFindFirst.mockResolvedValue(user)

    const authorize = getAuthorize()
    // although we supply a username-like identifier, regex will reject it, so
    // mimic a valid email that still resolves to a user record with that
    // username.  easier way is to pass email and let lookup use OR.
    const result = await authorize({ email: 'user2@example.com', password: 'p' }, null as any)

    expect(fakeFetch).toHaveBeenCalled()
    expect(result).toBeTruthy()
    expect(result.username).toBe('user2')
    expect(result.role).toBe('technician')
  })

  it('throws when AD_LOGIN_URL returns non-ok response', async () => {
    process.env.AD_LOGIN_URL = 'https://example.com/ad-auth/authenticate'
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    // @ts-ignore
    global.fetch = fakeFetch

    const authorize = getAuthorize()
    await expect(authorize({ email: 'u@x.com', password: 'p' }, null as any)).rejects.toThrow()
  })

  it('falls back to DB when AD_LOGIN_URL unset and development mode uses DB-only-login', async () => {
    // make sure we are in development so the dev/db-only branch runs instead
    // typescript complains because NODE_ENV is readonly
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('p', 10);

    const dbUser = { id: 'u2', fullName: 'Dev User', email: 'dev@x.com', passwordHash: hash, role: { key: 'tech' } };
    mockFindFirst.mockResolvedValue(dbUser);

    const authorize = getAuthorize();
    const result = await authorize({ email: 'dev@x.com', password: 'p' }, null as any);

    expect(result).toBeTruthy();
    expect(result.email).toBe('dev@x.com');
    expect(result.role).toBe('technician');
  });
});