import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { prisma } from './prisma';
import ldap from 'ldapjs';
import bcrypt from 'bcryptjs';

const isDev = process.env.NODE_ENV !== 'production';
const LDAP_DISABLED = process.env.LDAP_DISABLED === '1';
const DEFAULT_SEED_PASSWORD = process.env.DEFAULT_SEED_PASSWORD || 'bus@12345';
// Set to '1' in production to disable the default seed password fallback.
const DISABLE_DEFAULT_SEED_PASSWORD = process.env.DISABLE_DEFAULT_SEED_PASSWORD === '1';
// Set to '1' to disable DB fallback when LDAP bind fails (LDAP/AD only).
const LDAP_ONLY = process.env.LDAP_ONLY === '1';

const normalizeRole = (role?: string | null) => {
  const rk = String(role || '').toLowerCase();
  if (!rk) return 'no-access';
  if (rk === 'staff') return 'supervisor';
  if (rk === 'passenger' || rk === 'technician') return 'passenger';
  return rk;
};

// Export auth options from a library file people can import anywhere. This avoids Next
// app-route export conflicts when using 'export' in a route handler file.
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV !== 'production',
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Ethio Telecom Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, _req) {
          const LDAP_URL = process.env.LDAP_URL || 'ldap://172.22.186.7';
          const LDAP_DOMAIN = process.env.LDAP_DOMAIN || 'ethiotelecom.et';
          const ldapClient = ldap.createClient({ url: LDAP_URL });
        const rawIdentifier = (credentials?.email || '').trim();
        let identifier = rawIdentifier;
        try {
          identifier = String(rawIdentifier || '').trim();
          if (identifier.toLowerCase().startsWith('ethio') && identifier.includes('@')) {
            identifier = identifier.slice(5);
          }
          identifier = identifier.toLowerCase();
          identifier = identifier.replace(/[ \u00A0]+$/g, '');
          identifier = identifier.replace(/\.+$/g, '');
          if (identifier.includes('@')) {
            const [local, domain] = identifier.split('@');
            let d = domain || '';
            d = d.replace(/\.+$/g, '');
            if (d.match(/^ethiotelecom(\.?e(\.et)?)?$/i)) {
              d = 'ethiotelecom.et';
            }
            identifier = `${local}@${d}`;
          }
        } catch (e) {
          identifier = rawIdentifier;
        }
        const password = credentials?.password || '';
        console.debug('[auth] authorize start', { hasIdentifier: !!identifier, hasPassword: !!password });
        if (!identifier) return null;
        // Only allow email addresses for authentication
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
          console.debug('[auth] authorize failed: identifier is not a valid email');
          throw new Error('invalid_email');
        }

        // In development or when explicitly disabled, normally we skip
        // external AD/LDAP and just use the local database and seed password.
        // However, if `AD_LOGIN_URL` is configured we still call it even in
        // development so that the external auth flow can be tested.
        if ((isDev || LDAP_DISABLED) && !process.env.AD_LOGIN_URL) {
          console.debug('[auth] dev/db-only mode, skipping LDAP');
          try {
            const user = await prisma.user.findFirst({
              where: {
                email: { equals: identifier, mode: 'insensitive' },
              },
            });

            if (user && user.passwordHash) {
              console.debug('[auth] (dev) found seeded user with passwordHash, comparing bcrypt');
              const match = await bcrypt.compare(password || '', user.passwordHash);
              console.debug('[auth] (dev) bcrypt compare result', { match });
              if (match) {
                const normalizedRole = normalizeRole(user.role);

                const ret = {
                  id: String(user.id),
                  name: String(user.fullName),
                  email: user.email || undefined,
                  role: normalizedRole,
                  seeded: true,
                } as any;
                console.debug('[auth] (dev) returning user (db only)', { id: ret.id, role: ret.role });
                return ret;
              }
            }

            // For dev seeding, allow DEFAULT_SEED_PASSWORD for seeded users
            if (!DISABLE_DEFAULT_SEED_PASSWORD && user && !user.passwordHash && password === DEFAULT_SEED_PASSWORD) {
              const normalizedRole = normalizeRole(user.role);

              const ret = {
                id: String(user.id),
                name: String(user.fullName),
                email: user.email || undefined,
                role: normalizedRole,
                seeded: true,
              } as any;
              console.debug('[auth] (dev) returning user (db only, default seed password)', { id: ret.id, role: ret.role });
              return ret;
            }
          } catch (e) {
            console.debug('[auth] (dev) db-only auth error', { message: (e as any)?.message });
          }

          console.debug('[auth] (dev) failing authorize: invalid_password for', identifier);
          throw new Error('invalid_password');
        }

        // Attempt AD/LDAP authentication first (AD) or via HTTP proxy if
        // AD_LOGIN_URL is provided. This grants any Ethio Telecom account the
        // ability to sign in; access is then determined by presence in our DB.
        const usernameForBind = identifier;
        let ldapErr: any = null;
        try {
          if (process.env.AD_LOGIN_URL) {
            const adUrl = process.env.AD_LOGIN_URL;
            console.debug('[auth] using AD_LOGIN_URL for authentication', { url: adUrl });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(adUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: usernameForBind, password }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) {
              throw new Error(`ad_auth_failed_${response.status}`);
            }
          } else {
            await new Promise<void>((resolve, reject) => {
              ldapClient.bind(usernameForBind, password, (err: any) => {
                if (err) return reject(err);
                resolve();
              });
            });
          }

          // authentication succeeded — now check if the user is seeded in our DB
          let user = await prisma.user.findFirst({
            where: {
              email: { equals: identifier, mode: 'insensitive' },
            },
          });

          if (!user) {
            // No fallback to staffId/username for email-only login
          }

          await new Promise<void>((resolve) => ldapClient.unbind(() => resolve()));

          if (!user) {
            // Authenticated by AD but not seeded in our DB — allow a lightweight session
            // so the user can sign in but not access protected PM features. Mark
            // the session with role 'no-access' and seeded=false.
            const displayName = usernameForBind.split('@')[0]
            return {
              id: `ldap:${usernameForBind}`,
              name: displayName,
              email: usernameForBind,
              role: 'no-access',
              seeded: false,
            } as any
          }

          // seeded user exists — map DB role key to a normalized role string.
          // If no role is assigned in the DB yet, treat as 'no-access' so they
          // can sign in but won't accidentally get technician privileges.
          const normalizedRole = normalizeRole(user.role);

          const ret = {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: normalizedRole,
            seeded: true,
          } as any;
          console.debug('[auth] returning user (ldap success)', { id: ret.id, role: ret.role });
          return ret;
        } catch (err) {
          ldapErr = err;
          console.debug('[auth] ldap/ad bind failed for', usernameForBind, { message: (err as any)?.message });
          if (!process.env.AD_LOGIN_URL) {
            try {
              await new Promise<void>((resolve) => ldapClient.unbind(() => resolve()));
            } catch (_) {}
          }

          // If AD/LDAP failed, fall back to local DB password check for seeded users.
          if (LDAP_ONLY) {
            console.debug('[auth] LDAP_ONLY enabled; skipping DB fallback');
            throw new Error('invalid_password');
          }
          try {
            console.debug('[auth] attempting DB fallback lookup for', identifier);
            const user = await prisma.user.findFirst({
              where: {
                email: { equals: identifier, mode: 'insensitive' },
              },
            });

            if (user && user.passwordHash) {
              console.debug('[auth] found seeded user, comparing bcrypt');
              const match = await bcrypt.compare(password || '', user.passwordHash);
              console.debug('[auth] bcrypt compare result', { match });
              if (match) {
                console.debug('[auth] db-fallback matched — preparing return', { id: user.id });
                try {
                  const section = (user as any)?.section || '';
                  console.debug('[auth] user section', { section });

                  // Normalize DB role key to session role. If role is missing,
                  // mark as 'no-access' so seeded users without roles don't
                  // silently become technicians.
                  const normalizedRole = normalizeRole(user.role);

                  const ret = {
                    id: String(user.id),
                    name: String(user.fullName),
                    email: user.email || undefined,
                    role: normalizedRole,
                    seeded: true,
                  } as any;
                  console.debug('[auth] returning user (db fallback)', { id: ret.id, role: ret.role });
                  return ret;
                } catch (e) {
                  console.error('[auth] error while preparing db-fallback return', { error: (e as any)?.message, stack: (e as any)?.stack });
                  throw e;
                }
              }
            }
          } catch (innerErr) {
            // If the DB fallback raised an authorization-related error, propagate it
            if ((innerErr as any)?.message === 'not_authorized_section') throw innerErr;
            // otherwise ignore DB lookup errors and fall through to invalid_password
            console.debug('[auth] db fallback error (ignored)', { message: (innerErr as any)?.message });
          }

          // LDAP failed or the user is not permitted — surface a clear error
          if ((ldapErr as any)?.message === 'not_seeded_no_access') throw ldapErr;
          console.debug('[auth] failing authorize: invalid_password for', identifier);
          throw new Error('invalid_password');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 5 * 60, // 5 minutes - force more frequent refresh
    updateAge: 60, // Update session every 1 minute
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
          // ensure role is normalized on the token
          if ((user as any).role) (user as any).role = String((user as any).role).toLowerCase();
          console.debug('[auth][jwt] user present, attaching to token', { user });
          token.user = user as any;
        } else if ((token as any).user) {
          // On token refresh, always get fresh user data from DB
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: String((token as any).user.id) },
            });
            if (dbUser) {
              // Update the token user data with fresh database data
              (token as any).user.id = String(dbUser.id);
              (token as any).user.name = String(dbUser.fullName);
              (token as any).user.email = dbUser.email || undefined;

              // Update role if needed
              (token as any).user.role = normalizeRole(dbUser.role);

              // Include additional user fields
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

          // Always refresh user data from database to ensure any ID changes are reflected
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: String(u.id) },
            });
            if (dbUser) {
              // Update the user ID and other fields from database
              u.id = String(dbUser.id);
              u.name = String(dbUser.fullName);
              u.email = dbUser.email || undefined;
              
              // Update role if needed
              u.role = normalizeRole(dbUser.role);

              // Include additional user fields
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
