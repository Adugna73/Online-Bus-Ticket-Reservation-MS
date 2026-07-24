import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const {
  mockCancel,
  mockRecordIntent,
  mockDirectCharge,
  mockFindIntent,
  mockAuthorizeDirect,
  mockConfirm,
  mockBookingFindUnique,
  mockPaymentFindFirst,
  mockReceiptFindUnique,
  mockReceiptUpdate,
} = vi.hoisted(() => ({
  mockCancel: vi.fn(),
  mockRecordIntent: vi.fn(),
  mockDirectCharge: vi.fn(),
  mockFindIntent: vi.fn(),
  mockAuthorizeDirect: vi.fn(),
  mockConfirm: vi.fn(),
  mockBookingFindUnique: vi.fn(),
  mockPaymentFindFirst: vi.fn(),
  mockReceiptFindUnique: vi.fn(),
  mockReceiptUpdate: vi.fn(),
}))

vi.mock('@/lib/services/chapa', () => ({
  cancel: mockCancel,
  recordPendingIntent: mockRecordIntent,
  directCharge: mockDirectCharge,
  findIntentByTxRef: mockFindIntent,
  authorizeDirectCharge: mockAuthorizeDirect,
  confirmPayment: mockConfirm,
  chapaConfigured: () => true,
  testAmount: (a: number) => a,
  initialize: vi.fn(),
  ChapaRateLimitError: class extends Error {},
  ChapaApiError: class extends Error {},
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: mockBookingFindUnique },
    payment: { findFirst: mockPaymentFindFirst },
    receipt: { findUnique: mockReceiptFindUnique, update: mockReceiptUpdate },
  },
}))

function req(body: any, path = '/api/payments/chapa/cancel') {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/payments/chapa/cancel', () => {
  let POST: any
  beforeEach(async () => { const m = await import('@/app/api/payments/chapa/cancel/route'); POST = m.POST })

  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({ tx_ref: 'TX-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 tx_ref_required', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('tx_ref_required')
  })

  it('cancels on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockCancel.mockResolvedValue(true)
    const res: any = await POST(req({ tx_ref: 'TX-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockCancel).toHaveBeenCalledWith('TX-1')
  })

  it('returns 500 on error', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockCancel.mockRejectedValue(new Error('boom'))
    const res: any = await POST(req({ tx_ref: 'TX-1' }))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/payments/chapa/charge', () => {
  let POST: any
  beforeEach(async () => { const m = await import('@/app/api/payments/chapa/charge/route'); POST = m.POST })
  const CH = '/api/payments/chapa/charge'

  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', phone: '0912345678' }, CH))
    expect(res.status).toBe(401)
  })

  it('charge: returns 400 booking_required', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'charge', phone: '0912345678' }, CH))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('booking_required')
  })

  it('charge: returns 400 invalid_method', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'NOPE', phone: '0912345678' }, CH))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_method')
  })

  it('charge: returns 400 invalid_phone when too short', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'TELEBIRR', phone: '123' }, CH))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_phone')
  })

  it('charge: returns 404 booking_not_found', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue(null)
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'TELEBIRR', phone: '0912345678' }, CH))
    expect(res.status).toBe(404)
  })

  it('charge: returns 403 forbidden when booking belongs to another user', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u2', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'P', user: { email: 'a@b.com' } })
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'TELEBIRR', phone: '0912345678' }, CH))
    expect(res.status).toBe(403)
  })

  it('charge: returns tx_ref on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u1', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'P', user: { email: 'a@b.com' } })
    mockRecordIntent.mockResolvedValue(undefined)
    mockDirectCharge.mockResolvedValue({ reference: 'ref1', auth_type: 'otp' })
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'TELEBIRR', phone: '0912345678' }, CH))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reference).toBe('ref1')
    expect(data.tx_ref).toBeDefined()
  })

  it('authorize: returns 400 tx_ref_and_reference_required', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'authorize', tx_ref: 'TX-1' }, CH))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('tx_ref_and_reference_required')
  })

  it('authorize: returns 404 intent_not_found when no intent recovered', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockFindIntent.mockResolvedValue(null)
    const res: any = await POST(req({ action: 'authorize', tx_ref: 'TX-1', reference: 'ref1' }, CH))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('intent_not_found')
  })

  it('authorize: confirms on happy path using recovered intent', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockFindIntent.mockResolvedValue({ bookingId: 'b1', method: 'TELEBIRR' })
    mockAuthorizeDirect.mockResolvedValue(undefined)
    mockConfirm.mockResolvedValue({ payment: { id: 'p1' }, receipt: { id: 'r1', receiptNumber: 'RC-1' }, alreadyConfirmed: false })
    const res: any = await POST(req({ action: 'authorize', tx_ref: 'TX-1', reference: 'ref1', otp: '1234' }, CH))
    expect(res.status).toBe(200)
    expect((await res.json()).paymentId).toBe('p1')
    expect(mockConfirm).toHaveBeenCalledWith('b1', 'TX-1', 'TELEBIRR')
  })

  it('returns 400 unknown_action', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ action: 'wat' }, CH))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('unknown_action')
  })

  it('maps payment_not_verified to 402', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u1', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'P', user: { email: 'a@b.com' } })
    mockRecordIntent.mockResolvedValue(undefined)
    mockDirectCharge.mockRejectedValue(new Error('payment_not_verified'))
    const res: any = await POST(req({ action: 'charge', bookingId: 'b1', method: 'TELEBIRR', phone: '0912345678' }, CH))
    expect(res.status).toBe(402)
  })
})

describe('POST /api/payments/chapa/recover', () => {
  let POST: any
  beforeEach(async () => { const m = await import('@/app/api/payments/chapa/recover/route'); POST = m.POST })
  const RC = '/api/payments/chapa/recover'

  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({}, RC))
    expect(res.status).toBe(401)
  })

  it('returns recent PAID receipt as alreadyConfirmed', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindFirst.mockResolvedValueOnce({ id: 'p1', bookingId: 'b1', method: 'TELEBIRR' }) // recentPaid
    mockReceiptFindUnique.mockResolvedValue({ id: 'r1', receiptNumber: 'RC-1', chapaReceiptUrl: null })
    const res: any = await POST(req({}, RC))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alreadyConfirmed).toBe(true)
    expect(data.receiptNumber).toBe('RC-1')
  })

  it('updates receipt with chapaReceiptUrl when provided and missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindFirst.mockResolvedValueOnce({ id: 'p1', bookingId: 'b1', method: 'TELEBIRR' })
    mockReceiptFindUnique.mockResolvedValue({ id: 'r1', receiptNumber: 'RC-1', chapaReceiptUrl: null })
    mockReceiptUpdate.mockResolvedValue({ id: 'r1', receiptNumber: 'RC-1', chapaReceiptUrl: 'https://ch.test/r' })
    const res: any = await POST(req({ chapaReceiptUrl: 'https://ch.test/r' }, RC))
    expect(res.status).toBe(200)
    expect(mockReceiptUpdate).toHaveBeenCalled()
    expect((await res.json()).chapaReceiptUrl).toBe('https://ch.test/r')
  })

  it('returns 404 no_pending_payment when nothing recent or pending', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindFirst.mockResolvedValue(null) // no recentPaid, no pending
    const res: any = await POST(req({}, RC))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('no_pending_payment')
  })

  it('confirms a pending payment on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindFirst
      .mockResolvedValueOnce(null) // no recentPaid
      .mockResolvedValueOnce({ id: 'p2', bookingId: 'b1', transactionRef: 'TX-2', method: 'TELEBIRR' }) // pending
    mockConfirm.mockResolvedValue({ payment: { id: 'p2' }, receipt: { id: 'r2', receiptNumber: 'RC-2', chapaReceiptUrl: null }, alreadyConfirmed: false })
    const res: any = await POST(req({}, RC))
    expect(res.status).toBe(200)
    expect(mockConfirm).toHaveBeenCalledWith('b1', 'TX-2', 'TELEBIRR', undefined)
  })

  it('maps payment_not_verified to 402', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'p2', bookingId: 'b1', transactionRef: 'TX-2', method: 'TELEBIRR' })
    mockConfirm.mockRejectedValue(new Error('payment_not_verified'))
    const res: any = await POST(req({}, RC))
    expect(res.status).toBe(402)
  })
})
