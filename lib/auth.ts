import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

const isDev = process.env.NODE_ENV !== 'production';
const DEFAULT_SEED_PASSWORD = process.env.DEFAULT_SEED_PASSWORD || 'bus@12345';
const DISABLE_DEFAULT_SEED_PASSWORD = process.env.DISABLE_DEFAULT_SEED_PASSWORD === '1';

const normalizeRole = (role?: string | null) => {
  const rk = String(role || '').toLowerCase();
  if (!rk) return 'no-access';
  if (rk === 'staff') return 'supervisor';
  if (rk === 'passenger') return 'passenger';
  if (rk === 'admin') return 'admin';
  if (rk === 'mechanic') return 'mechanic';
  return rk;
};

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV !== 'production',
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, _req) {
        const rawIdentifier = (credentials?.email || '').trim();
        const identifier = String(rawIdentifier || '').trim().toLowerCase().replace(/[ \u00A0]+$/g, '').replace(/\.+$/g, '');
        const password = credentials?.password || '';

        console.debug('[auth] authorize start', { hasIdentifier: !!identifier, hasPassword: !!password });
        if (!identifier) return null;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
          console.debug('[auth] authorize failed: identifier is not a valid email');
          throw new Error('invalid_email');
        }

        try {
          const user = await prisma.user.findFirst({
            where: {
              email: { equals: identifier, mode: 'insensitive' },
            },
          });

          if (user && user.passwordHash) {
            console.debug('[auth] found user with passwordHash, comparing bcrypt');
            const match = await bcrypt.compare(password || '', user.passwordHash);
            console.debug('[auth] bcrypt compare result', { match });
            if (match) {
              const normalizedRole = normalizeRole(user.role as string);
              const ret = {
                id: String(user.id),
                name: String(user.fullName),
                email: user.email || undefined,
                role: normalizedRole,
                seeded: true,
              } as any;
              console.debug('[auth] returning user', { id: ret.id, role: ret.role });
              return ret;
            }
          }

          if (!DISABLE_DEFAULT_SEED_PASSWORD && user && !user.passwordHash && password === DEFAULT_SEED_PASSWORD) {
            const normalizedRole = normalizeRole(user.role as string);
            const ret = {
              id: String(user.id),
              name: String(user.fullName),
              email: user.email || undefined,
              role: normalizedRole,
              seeded: true,
            } as any;
            console.debug('[auth] returning user (default seed password)', { id: ret.id, role: ret.role });
            return ret;
          }
        } catch (e) {
          console.debug('[auth] auth error', { message: (e as any)?.message });
        }

        console.debug('[auth] failing authorize: invalid_password for', identifier);
        throw new Error('invalid_password');
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 5 * 60,
    updateAge: 60,
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      try {
        console.debug('[auth][signIn] called', { user, account, profile, email });
      } catch (e) {
        console.error('[auth][signIn] log error', { error: (e as any)?.message });
      }
      return true;
    },
    async jwt({ token, user }) {
      try {
        if (user) {
          if ((user as any).role) (user as any).role = String((user as any).role).toLowerCase();
          console.debug('[auth][jwt] user present, attaching to token', { user });
          token.user = user as any;
        } else if ((token as any).user) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: String((token as any).user.id) },
            });
            if (dbUser) {
              (token as any).user.id = String(dbUser.id);
              (token as any).user.name = String(dbUser.fullName);
              (token as any).user.email = dbUser.email || undefined;
              (token as any).user.role = normalizeRole(dbUser.role as string);
              (token as any).user.stationId = dbUser.stationId || undefined;
              (token as any).user.phone = dbUser.phone || undefined;
              console.debug('[auth][jwt] refreshed user data in token', { id: (token as any).user.id });
            }
          } catch (e) {
            console.error('[auth][jwt] refresh error', { error: (e as any)?.message });
          }
        }
      } catch (e) {
        console.error('[auth][jwt] error', { error: (e as any)?.message });
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (token && (token as any).user) {
          const u = (token as any).user as any;
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: String(u.id) },
            });
            if (dbUser) {
              u.id = String(dbUser.id);
              u.name = String(dbUser.fullName);
              u.email = dbUser.email || undefined;
              u.role = normalizeRole(dbUser.role as string);
              u.stationId = dbUser.stationId || undefined;
              u.phone = dbUser.phone || undefined;
              console.debug('[auth][session] refreshed user data from DB', { id: u.id, role: u.role });
            } else {
              console.warn('[auth][session] user not found in DB', { id: u.id });
            }
          } catch (e) {
            console.error('[auth][session] refresh user data error', {
              error: (e as any)?.message,
            });
          }

          if (u.role) u.role = String(u.role).toLowerCase();
          console.debug('[auth][session] attaching user to session', { user: u });
          session.user = u;
        }
      } catch (e) {
        console.error('[auth][session] error', { error: (e as any)?.message });
      }
      return session;
    },
  },
};
