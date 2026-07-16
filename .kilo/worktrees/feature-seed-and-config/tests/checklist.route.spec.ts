import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(() => ({ user: { id: 'user-1' } }))
}))

// mock prisma - declare mocks first
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('../lib/prisma', () => ({
  prisma: {
    checklist: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    }
    , workOrderAttachment: {
      findFirst: vi.fn(() => Promise.resolve({ id: 'a1' }))
    }
  }
}))

let POST: any
beforeAll(async () => {
  const mod = await import('../app/api/workorders/[id]/checklist/route')
  POST = mod.POST
})

function makeRequest(body: any) {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('checklist POST finalize validation', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockCreate.mockReset()
    mockUpdate.mockReset()
  })

  it('rejects finalize when required photos missing', async () => {
    const items = [
      { label: 'Item A', requiredPhoto: true, attachments: [] },
      { label: 'Item B', requiredPhoto: false }
    ]
    const req = makeRequest({ items, finalize: true })
    const res: any = await POST(req, { params: Promise.resolve({ id: 'wo-1' }) } as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('missing_required_photos')
    expect(Array.isArray(json.items)).toBeTruthy()
    expect(json.items).toContain('Item A')
  })

  it('creates checklist when finalize with attachments present', async () => {
    const items = [
      { label: 'Item A', requiredPhoto: true, attachments: ['/uploads/a.jpg'] },
      { label: 'Item B', requiredPhoto: false }
    ]
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'cl-1', workOrderId: 'wo-1', items })

    const req = makeRequest({ items, finalize: true })
    const res: any = await POST(req, { params: Promise.resolve({ id: 'wo-1' }) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('cl-1')
    expect(json.items).toEqual(items)
  })
})
