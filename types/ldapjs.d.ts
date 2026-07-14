declare module 'ldapjs' {
  /* Minimal declarations to satisfy TS when @types/ldapjs is unavailable. */
  type Client = any
  type SearchOptions = any
  export function createClient(opts: any): Client
  export = { createClient } as any
}
