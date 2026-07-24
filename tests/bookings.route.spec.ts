import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const mockBookingFindMany = vi.fn()
const mockTripFindUnique = vi.fn()
const mockSeatFindFirst = vi.fn()
const mockUserFindFirst = vi.fn()
const mockUserCreate = vi.fn()
const txBookingCreate = vi.fn()
const txBookingSeatCreate = vi.fn()
const txPaymentCreate = vi.fn()
const txReceiptCreate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findMany: mockBookingFindMany },
    trip: { findUnique: mockTripFindUnique },
    seat: { findFirst: mockSeatFindFirst },
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
    $transaction: mockTransaction,
  },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: () => Promise.resolve('hashed'), compare: () => Promise.resolve(false) },
  hash: () => Promise.resolve('hashed'),
  compare: () => Promise.resolve(false),
}))

const txMock = {
  booking: { create: txBookingCreate },
  bookingSeat: { create: txBookingSeatCreate },
  payment: { create: txPaymentCreate },
  receipt: { create: txReceiptCreate },
}

let POST: any
let GET: any

beforeEach(async () => {
  vi.clearAllMocks()
  mockTransaction.mockImplementation(async (fn: any) => fn(txMock))
  const mod = await import('@/app/api/bookings/route')
  POST = mod.POST
  GET = mod.GET
})

function req(body: any, method = 'POST', qs = '') {
  return new Request(`http://localhost/api/bookings${qs}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/bookings', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await GET(req(undefined, 'GET'))
    expect(res.status).toBe(401)
  })

  it('scopes list to userId for passenger role', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockBookingFindMany.mockResolvedValue([])
    const res: any = await GET(req(undefined, 'GET', '?status=PENDING'))
    expect(res.status).toBe(200)
    const arg = mockBookingFindMany.mock.calls[0][0]
    expect(arg.where.userId).toBe('u1')
    expect(arg.where.status).toBe('PENDING')
  })
})

describe('POST /api/bookings', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await POST(req({ tripId: 't1', seatId: 's1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for an unsupported role', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'driver' } })
    const res: any = await POST(req({ tripId: 't1', seatId: 's1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 trip_required when tripId missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    const res: any = await POST(req({ seatId: 's1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('trip_required')
  })

  it('returns 400 seat_required when seatId missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    const res: any = await POST(req({ tripId: 't1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('seat_required')
  })

  it('returns 404 trip_not_found when trip missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockTripFindUnique.mockResolvedValue(null)
    const res: any = await POST(req({ tripId: 't1', seatId: 's1' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('trip_not_found')
  })

  it('returns 400 seat_invalid when seat not found on bus', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 150 })
    mockSeatFindFirst.mockResolvedValue(null)
    const res: any = await POST(req({ tripId: 't1', seatId: 's1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('seat_invalid')
  })

  it('creates a pending booking + seat + payment on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 150 })
    mockSeatFindFirst.mockResolvedValue({ id: 's1', seatNumber: '1A' })
    txBookingCreate.mockResolvedValue({ id: 'bk1', bookingRef: 'BR-1' })

    const res: any = await POST(req({ tripId: 't1', seatId: 's1', paymentMethod: 'CASH' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('bk1')
    expect(txBookingCreate).toHaveBeenCalled()
    expect(txBookingSeatCreate).toHaveBeenCalled()
    expect(txPaymentCreate).toHaveBeenCalled()
    expect(txReceiptCreate).not.toHaveBeenCalled()
  })

  it('creates a receipt when markPaid is true', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 150 })
    mockSeatFindFirst.mockResolvedValue({ id: 's1', seatNumber: '1A' })
    txBookingCreate.mockResolvedValue({ id: 'bk2', bookingRef: 'BR-2' })

    const res: any = await POST(req({ tripId: 't1', seatId: 's1', markPaid: true }))
    expect(res.status).toBe(200)
    expect(txReceiptCreate).toHaveBeenCalled()
  })

  it('returns 409 seat_occupied on unique-constraint violation', async () => {
    const { Prisma } = await import('@prisma/client')
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 150 })
    mockSeatFindFirst.mockResolvedValue({ id: 's1', seatNumber: '1A' })
    const err: any = Object.create(Prisma.PrismaClientKnownRequestError.prototype)
    err.code = 'P2002'
    err.message = 'unique'
    mockTransaction.mockRejectedValue(err)

    const res: any = await POST(req({ tripId: 't1', seatId: 's1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('seat_occupied')
  })
})

describe('POST /api/bookings — admin guest-user resolution', () => {
  it('uses an existing passenger account matched by email', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 200 })
    mockSeatFindFirst.mockResolvedValue({ id: 's1', seatNumber: '1A' })
    mockUserFindFirst.mockResolvedValue({ id: 'existing-pax' })
    txBookingCreate.mockResolvedValue({ id: 'bk3', bookingRef: 'BR-3' })

    const res: any = await POST(req({ tripId: 't1', seatId: 's1', passengerEmail: 'pax@bus.et' }))
    expect(res.status).toBe(200)
    expect(mockUserFindFirst).toHaveBeenCalled()
    expect(mockUserCreate).not.toHaveBeenCalled()
    const createData = txBookingCreate.mock.calls[0][0].data
    expect(createData.userId).toBe('existing-pax')
  })

  it('creates a guest passenger when no existing account is found', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 200 })
    mockSeatFindFirst.mockResolvedValue({ id: 's1', seatNumber: '1A' })
    mockUserFindFirst.mockResolvedValue(null)
    mockUserCreate.mockResolvedValue({ id: 'guest1' })
    txBookingCreate.mockResolvedValue({ id: 'bk4', bookingRef: 'BR-4' })

    const res: any = await POST(req({ tripId: 't1', seatId: 's1', passengerEmail: 'new@bus.et', passengerFullName: 'New Pax' }))
    expect(res.status).toBe(200)
    expect(mockUserCreate).toHaveBeenCalled()
    expect(txBookingCreate.mock.calls[0][0].data.userId).toBe('guest1')
  })

  it('uses an explicit userId when provided (no lookup)', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })
    mockTripFindUnique.mockResolvedValue({ id: 't1', busId: 'b1', basePrice: 200 })
    mockSeatFindFirst.mockResolvedValue({ id: 's1', seatNumber: '1A' })
    txBookingCreate.mockResolvedValue({ id: 'bk5', bookingRef: 'BR-5' })

    const res: any = await POST(req({ tripId: 't1', seatId: 's1', userId: 'explicitU' }))
    expect(res.status).toBe(200)
    expect(mockUserFindFirst).not.toHaveBeenCalled()
    expect(txBookingCreate.mock.calls[0][0].data.userId).toBe('explicitU')
  })
})

describe('GET /api/bookings — payload mapping', () => {
  it('maps a booking into the response payload', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockBookingFindMany.mockResolvedValue([{
      id: 'bk1', bookingRef: 'BR-1', status: 'CONFIRMED', totalPrice: 150,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
      user: { id: 'u1', fullName: 'Pax', email: 'p@bus.et', phone: 'p' },
      passengerFullName: 'Pax', passengerPhone: 'p', passengerEmail: 'p@bus.et',
      passengerIdNumber: null, passengerGender: null, passengerAge: null,
      emergencyContact: null, notes: null,
      payment: { id: 'pay1', status: 'PAID', method: 'CASH', amount: 150, paidAt: 'x', transactionRef: 't' },
      seats: [{ id: 'bs1', seat: { seatNumber: '1A', seatType: 'REGULAR' }, fare: 150 }],
      trip: { id: 't1', departAt: 'd', arriveAt: 'a', basePrice: 150, status: 'SCHEDULED',
        bus: { id: 'b1', plateNumber: 'AA-1', model: 'M', seatCount: 40, level: 'STANDARD', driverName: 'Dr', imageUrl: null, amenities: [], safetyChecklist: [], seatLayout: {}, company: { name: 'Co' } },
        route: { id: 'r1', originStation: { id: 's1', name: 'Origin', code: 'O' }, destinationStation: { id: 's2', name: 'Dest', code: 'D' } } },
      receipt: null,
    }])

    const res: any = await GET(req(undefined, 'GET'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('bk1')
    expect(data[0].passenger.name).toBe('Pax')
    expect(data[0].payment.status).toBe('PAID')
    expect(data[0].seats[0].seatNumber).toBe('1A')
    expect(data[0].trip.bus.companyName).toBe('Co')
    expect(data[0].trip.route.origin.code).toBe('O')
  })
})
