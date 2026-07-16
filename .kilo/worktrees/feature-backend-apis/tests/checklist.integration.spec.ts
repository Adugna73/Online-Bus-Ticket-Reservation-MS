import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// prepare a temp sqlite file
const DB_PATH = path.join(process.cwd(), 'tmp', 'test-db.sqlite')

beforeAll(async () => {
  // ensure tmp exists and remove old db
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  try { fs.unlinkSync(DB_PATH) } catch (e) {}
  process.env.DATABASE_URL = `file:${DB_PATH}`
  // push prisma schema to sqlite
  execSync('npx prisma db push --schema=prisma/schema.prisma', { stdio: 'inherit' })
})

describe.skip('checklist finalize integration', () => {
  let prisma: any
  let POST: any
  beforeAll(async () => {
    // import prisma after DATABASE_URL set
    const pmod = await import('../lib/prisma')
    prisma = pmod.prisma
    // create minimal data: user, region, site, workorder
    const user = await prisma.user.create({ data: { username: 'tech1', fullName: 'Tech One', roleId: (await prisma.role.create({ data: { key: 'tech', displayName: 'Technician' } })).id } })
    const orgRegion = await prisma.region.create({ data: { name: 'R1', organization: { create: { name: 'Org1' } } } })
    const site = await prisma.site.create({ data: { siteCode: 'S1', name: 'Site 1', regionId: orgRegion.id } })
    const wo = await prisma.workOrder.create({ data: { title: 'WO1', siteId: site.id, type: 'maintenance', createdById: user.id } })

    // mock session to return this user id
    vi.mock('next-auth/next', () => ({ getServerSession: vi.fn(() => ({ user: { id: user.id } })) }))

    const mod = await import('../app/api/workorders/[id]/checklist/route')
    // @ts-ignore - dynamic import of route handler
    POST = (mod as any).POST
    // expose some vars
    (global as any).__testData = { prisma, user, site, wo }
  })

  it('rejects finalize when attachment URL not in records', async () => {
    const { wo } = (global as any).__testData
    const items = [ { label: 'I1', requiredPhoto: true, attachments: ['/uploads/checklist/' + wo.id + '/missing.jpg'] } ]
    const req = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, finalize: true }) })
    const res:any = await POST(req, { params: Promise.resolve({ id: wo.id }) } as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('attachment_urls_not_found')
  })

  it('accepts finalize when attachment exists in records', async () => {
    const { prisma, wo } = (global as any).__testData
    // create attachment record
    const url = `/uploads/checklist/${wo.id}/photo1.jpg`
    await prisma.workOrderAttachment.create({ data: { workOrderId: wo.id, fileName: 'photo1.jpg', fileUrl: url } })
    const items = [ { label: 'I1', requiredPhoto: true, attachments: [url] } ]
    const req = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, finalize: true }) })
    const res:any = await POST(req, { params: Promise.resolve({ id: wo.id }) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.workOrderId).toBe(wo.id)
  })
})

afterAll(() => {
  // cleanup
  try { fs.unlinkSync(DB_PATH) } catch (e) {}
})
