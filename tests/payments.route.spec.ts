import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const { mockList, mockCharge, mockRefund, mockRelease } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCharge: vi.fn(),
  mockRefund: vi.fn(),
  mockRelease: vi.fn(),
}))
vi.mock('@/lib/services/payments', () => ({
  listPayments: mockList,
  charge: mockCharge,
  refund: mockRefund,
  releaseEscrow: mockRelease,
  getAuditLog: vi.fn().mockResolvedValue([]),
}))

function req(body: any, method = 'POST') {
  return new Request('http://localhost/api/payments', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

let GET: any
let POST: any
beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('@/app/api/payments/route')
  GET = mod.GET
  POST = mod.POST
})

describe('GET /api/payments', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await GET()
    expect(res.status).toBe(401)
  })

  it('lists the current user payments', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockList.mockResolvedValue([{ id: 'p1' }])
    const res: any = await GET()
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith('u1')
    expect((await res.json())[0].id).toBe('p1')
  })
})

describe('POST /api/payments — charge', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'CASH' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 booking_required', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'charge', method: 'CASH' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('booking_required')
  })

  it('returns 400 invalid_method', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'NOPE' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_method')
  })

  it('charges on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockCharge.mockResolvedValue({ payment: { id: 'p1' }, provider: 'cash', ref: 'r1', held: true })
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'CASH', amount: 100 }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentId).toBe('p1')
    expect(mockCharge).toHaveBeenCalledWith('b1', 100, 'CASH')
  })
})

describe('POST /api/payments — refund', () => {
  it('returns 400 payment_required', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'refund', amount: 10 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('payment_required')
  })

  it('returns 400 amount_required when amount <= 0', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'refund', paymentId: 'p1', amount: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('amount_required')
  })

  it('refunds on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockRefund.mockResolvedValue({ refund: { id: 'rf1' }, ref: 'r1', processedAt: 'x' })
    const res: any = await POST(req({ action: 'refund', paymentId: 'p1', amount: 50, reason: 'test' }))
    expect(res.status).toBe(200)
    expect((await res.json()).refundId).toBe('rf1')
    expect(mockRefund).toHaveBeenCalledWith('p1', 50, 'test')
  })
})

describe('POST /api/payments — release_escrow', () => {
  it('returns 400 booking_required', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'release_escrow' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('booking_required')
  })

  it('releases escrow on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockRelease.mockResolvedValue({ releasedAt: 'x' })
    const res: any = await POST(req({ action: 'release_escrow', bookingId: 'b1' }))
    expect(res.status).toBe(200)
    expect(mockRelease).toHaveBeenCalledWith('b1')
  })
})

describe('POST /api/payments — error mapping', () => {
  it('returns 400 unknown_action for unrecognized action', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'wat' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('unknown_action')
  })

  it('maps booking_not_found to 404', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockCharge.mockRejectedValue(new Error('booking_not_found'))
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'CASH' }))
    expect(res.status).toBe(404)
  })

  it('maps invalid_amount to 400', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockCharge.mockRejectedValue(new Error('invalid_amount'))
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'CASH' }))
    expect(res.status).toBe(400)
  })
})
