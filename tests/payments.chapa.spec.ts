import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const {
  mockBookingFindUnique,
  mockChapaConfigured,
  mockInitialize,
  mockRecordIntent,
  mockFindIntent,
  mockConfirm,
  ChapaRateLimitError,
  ChapaApiError,
} = vi.hoisted(() => {
  class ChapaRateLimitError extends Error {
    retryAfter?: number
    constructor(message: string, retryAfter?: number) {
      super(message)
      this.name = 'ChapaRateLimitError'
      this.retryAfter = retryAfter
    }
  }
  class ChapaApiError extends Error {
    status: number
    details: any
    constructor(message: string, status = 400, details?: any) {
      super(message)
      this.name = 'ChapaApiError'
      this.status = status
      this.details = details
    }
  }
  return {
    mockBookingFindUnique: vi.fn(),
    mockChapaConfigured: vi.fn(),
    mockInitialize: vi.fn(),
    mockRecordIntent: vi.fn(),
    mockFindIntent: vi.fn(),
    mockConfirm: vi.fn(),
    ChapaRateLimitError,
    ChapaApiError,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: { booking: { findUnique: mockBookingFindUnique } },
}))
vi.mock('@/lib/services/chapa', () => ({
  chapaConfigured: mockChapaConfigured,
  initialize: mockInitialize,
  recordPendingIntent: mockRecordIntent,
  findIntentByTxRef: mockFindIntent,
  confirmPayment: mockConfirm,
  testAmount: (a: number) => a,
  ChapaRateLimitError,
  ChapaApiError,
}))

import { getServerSession } from 'next-auth/next'
import * as chapa from '@/lib/services/chapa'

function req(body: any, method = 'POST', path = '/api/payments/chapa') {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockChapaConfigured.mockReturnValue(true)
})

describe('POST /api/payments/chapa (checkout init)', () => {
  let POST: any
  beforeEach(async () => {
    const mod = await import('@/app/api/payments/chapa/route')
    POST = mod.POST
  })

  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({ bookingId: 'b1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 booking_required when bookingId missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('booking_required')
  })

  it('returns 400 invalid_method for unknown method', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ bookingId: 'b1', method: 'NOPE' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_method')
  })

  it('returns 400 method_not_supported_by_chapa for CASH', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ bookingId: 'b1', method: 'CASH' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('method_not_supported_by_chapa')
  })

  it('returns 404 booking_not_found', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue(null)
    const res: any = await POST(req({ bookingId: 'b1', method: 'TELEBIRR' }))
    expect(res.status).toBe(404)
  })

  it('returns 403 forbidden when booking belongs to another user', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u2', bookingRef: 'BR-1', totalPrice: 100 })
    const res: any = await POST(req({ bookingId: 'b1', method: 'TELEBIRR' }))
    expect(res.status).toBe(403)
  })

  it('returns 500 chapa_not_configured when Chapa is not set up', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u1', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'A B', user: { email: 'a@b.com' }, trip: { route: { originStation: { name: 'X' }, destinationStation: { name: 'Y' } } } })
    mockChapaConfigured.mockReturnValue(false)
    const res: any = await POST(req({ bookingId: 'b1', method: 'TELEBIRR' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('chapa_not_configured')
  })

  it('returns checkout_url on happy path and records pending intent', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u1', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'A B', user: { email: 'a@b.com' }, trip: { route: { originStation: { name: 'X' }, destinationStation: { name: 'Y' } } } })
    mockInitialize.mockResolvedValue({ checkout_url: 'https://checkout.test/pay', tx_ref: 'TX-1' })
    mockRecordIntent.mockResolvedValue(undefined)

    const res: any = await POST(req({ bookingId: 'b1', method: 'TELEBIRR' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.checkout_url).toBe('https://checkout.test/pay')
    expect(data.tx_ref).toBe('TX-1')
    expect(mockRecordIntent).toHaveBeenCalledWith('b1', 'TX-1', 'TELEBIRR', 100)
  })

  it('returns 429 rate_limited on ChapaRateLimitError', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u1', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'A B', user: { email: 'a@b.com' }, trip: { route: { originStation: { name: 'X' }, destinationStation: { name: 'Y' } } } })
    mockInitialize.mockRejectedValue(new chapa.ChapaRateLimitError('too many', 30))

    const res: any = await POST(req({ bookingId: 'b1', method: 'TELEBIRR' }))
    expect(res.status).toBe(429)
    expect((await res.json()).error).toBe('rate_limited')
  })

  it('retries with a fallback email on Chapa validation.email error', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockBookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'u1', bookingRef: 'BR-1', totalPrice: 100, passengerFullName: 'A B', user: { email: 'a@bus.et' }, trip: { route: { originStation: { name: 'X' }, destinationStation: { name: 'Y' } } } })
    mockInitialize
      .mockRejectedValueOnce(new (chapa.ChapaApiError as any)('bad email', 400, { field: 'validation.email' }))
      .mockResolvedValueOnce({ checkout_url: 'https://checkout.test/pay2', tx_ref: 'TX-2' })
    mockRecordIntent.mockResolvedValue(undefined)

    const res: any = await POST(req({ bookingId: 'b1', method: 'TELEBIRR' }))
    expect(res.status).toBe(200)
    expect(mockInitialize).toHaveBeenCalledTimes(2)
    expect((await res.json()).tx_ref).toBe('TX-2')
  })
})

describe('POST /api/payments/chapa/verify', () => {
  let POST: any
  beforeEach(async () => {
    const mod = await import('@/app/api/payments/chapa/verify/route')
    POST = mod.POST
  })

  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({ tx_ref: 'TX-1' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(401)
  })

  it('returns 400 tx_ref_required when tx_ref missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    const res: any = await POST(req({ bookingId: 'b1' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('tx_ref_required')
  })

  it('confirms payment and returns receipt details on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockConfirm.mockResolvedValue({
      payment: { id: 'p1' },
      receipt: { id: 'r1', receiptNumber: 'RC-1', chapaReceiptUrl: 'https://r.test' },
      alreadyConfirmed: false,
    })
    const res: any = await POST(req({ tx_ref: 'TX-1', bookingId: 'b1', method: 'TELEBIRR' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentId).toBe('p1')
    expect(data.receiptNumber).toBe('RC-1')
  })

  it('returns 404 when confirmPayment throws booking_not_found', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockConfirm.mockRejectedValue(new Error('booking_not_found'))
    const res: any = await POST(req({ tx_ref: 'TX-1', bookingId: 'b1', method: 'TELEBIRR' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(404)
  })

  it('returns 402 when confirmPayment throws payment_not_verified', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockConfirm.mockRejectedValue(new Error('payment_not_verified'))
    const res: any = await POST(req({ tx_ref: 'TX-1', bookingId: 'b1', method: 'TELEBIRR' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(402)
  })
})

describe('POST /api/payments/chapa/webhook', () => {
  let POST: any
  beforeEach(async () => {
    const mod = await import('@/app/api/payments/chapa/webhook/route')
    POST = mod.POST
  })

  it('returns 200 ignored when tx_ref missing', async () => {
    const res: any = await POST(req({}, 'POST', '/api/payments/chapa/webhook'))
    expect(res.status).toBe(200)
    expect((await res.json()).error).toBe('ignored')
  })

  it('returns 200 no_intent when no booking can be recovered', async () => {
    mockFindIntent.mockResolvedValue(null)
    const res: any = await POST(req({ tx_ref: 'TX-1' }, 'POST', '/api/payments/chapa/webhook'))
    expect(res.status).toBe(200)
    expect((await res.json()).error).toBe('no_intent')
  })

  it('confirms payment via intent on happy path', async () => {
    mockFindIntent.mockResolvedValue({ bookingId: 'b1', method: 'TELEBIRR' })
    mockConfirm.mockResolvedValue({ payment: { id: 'p1' }, receipt: { id: 'r1' } })
    const res: any = await POST(req({ tx_ref: 'TX-1' }, 'POST', '/api/payments/chapa/webhook'))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockConfirm).toHaveBeenCalledWith('b1', 'TX-1', 'TELEBIRR')
  })

  it('returns 200 with error when confirmPayment throws', async () => {
    mockFindIntent.mockResolvedValue({ bookingId: 'b1', method: 'TELEBIRR' })
    mockConfirm.mockRejectedValue(new Error('payment_not_verified'))
    const res: any = await POST(req({ tx_ref: 'TX-1' }, 'POST', '/api/payments/chapa/webhook'))
    expect(res.status).toBe(200)
    expect((await res.json()).error).toBe('payment_not_verified')
  })
})

describe('POST /api/payments/chapa/verify — intent recovery & validation gaps', () => {
  let POST: any
  beforeEach(async () => {
    const mod = await import('@/app/api/payments/chapa/verify/route')
    POST = mod.POST
  })

  it('recovers bookingId + method from intent when client omits them', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockFindIntent.mockResolvedValue({ bookingId: 'b1', method: 'TELEBIRR' })
    mockConfirm.mockResolvedValue({ payment: { id: 'p1' }, receipt: { id: 'r1', receiptNumber: 'RC-1' }, alreadyConfirmed: false })
    const res: any = await POST(req({ tx_ref: 'TX-1' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(200)
    expect(mockFindIntent).toHaveBeenCalledWith('TX-1')
    expect(mockConfirm).toHaveBeenCalledWith('b1', 'TX-1', 'TELEBIRR', undefined)
  })

  it('returns 404 booking_not_found when no bookingId and no intent', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockFindIntent.mockResolvedValue(null)
    const res: any = await POST(req({ tx_ref: 'TX-1' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('booking_not_found')
  })

  it('returns 400 invalid_method when method unrecognized and no intent', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockFindIntent.mockResolvedValue(null)
    const res: any = await POST(req({ tx_ref: 'TX-1', bookingId: 'b1', method: 'NOPE' }, 'POST', '/api/payments/chapa/verify'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_method')
  })
})
