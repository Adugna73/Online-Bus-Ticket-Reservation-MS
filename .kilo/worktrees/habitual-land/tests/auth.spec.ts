import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma', () => {
  return {
    prisma: {
      user: {
        findFirst: vi.fn(),
      },
    },
  };
});

import { prisma } from '../lib/prisma';
const mockFindFirst = prisma.user.findFirst as unknown as ReturnType<typeof vi.fn>;

import { authOptions } from '../lib/auth'

const getAuthorize = () => {
  const provider = authOptions.providers?.[0] as any
  return provider?.authorize as (credentials: any, req: any) => Promise<any>
}

describe('authOptions authorize', () => {
  beforeEach(() => {
    mockFindFirst.mockReset()
    vi.resetAllMocks()
  })

  it('returns user when bcrypt password matches', async () => {
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('p', 10);

    const dbUser = { id: 'u1', fullName: 'Dev User', email: 'dev@x.com', passwordHash: hash, role: 'PASSENGER' };
    mockFindFirst.mockResolvedValue(dbUser);

    const authorize = getAuthorize();
    const result = await authorize({ email: 'dev@x.com', password: 'p' }, null as any);

    expect(result).toBeTruthy();
    expect(result.email).toBe('dev@x.com');
    expect(result.role).toBe('passenger');
  });

  it('throws invalid_password when bcrypt does not match', async () => {
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct', 10);

    const dbUser = { id: 'u1', fullName: 'Dev User', email: 'dev@x.com', passwordHash: hash, role: 'PASSENGER' };
    mockFindFirst.mockResolvedValue(dbUser);

    const authorize = getAuthorize();
    await expect(authorize({ email: 'dev@x.com', password: 'wrong' }, null as any)).rejects.toThrow('invalid_password');
  });

  it('throws invalid_email when identifier is not an email', async () => {
    const authorize = getAuthorize();
    await expect(authorize({ email: 'notanemail', password: 'p' }, null as any)).rejects.toThrow('invalid_email');
  });

  it('returns user with admin role for ADMIN user', async () => {
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('p', 10);

    const dbUser = { id: 'u2', fullName: 'Admin User', email: 'admin@x.com', passwordHash: hash, role: 'ADMIN' };
    mockFindFirst.mockResolvedValue(dbUser);

    const authorize = getAuthorize();
    const result = await authorize({ email: 'admin@x.com', password: 'p' }, null as any);

    expect(result).toBeTruthy();
    expect(result.role).toBe('admin');
  });

  it('returns user with supervisor role for STAFF user', async () => {
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('p', 10);

    const dbUser = { id: 'u3', fullName: 'Staff User', email: 'staff@x.com', passwordHash: hash, role: 'STAFF' };
    mockFindFirst.mockResolvedValue(dbUser);

    const authorize = getAuthorize();
    const result = await authorize({ email: 'staff@x.com', password: 'p' }, null as any);

    expect(result).toBeTruthy();
    expect(result.role).toBe('supervisor');
  });
});
