import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const mockBookingFindFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { booking: { findFirst: mockBookingFindFirst } },
}))

let GET: any
beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('@/app/api/bookings/[id]/route')
  GET = mod.GET
})

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/bookings/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/bookings/bk1'), ctx('bk1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 invalid_id when id is empty', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    const res: any = await GET(new Request('http://localhost/api/bookings/'), ctx(''))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_id')
  })

  it('returns 404 not_found when booking missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockBookingFindFirst.mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/bookings/ghost'), ctx('ghost'))
    expect(res.status).toBe(404)
  })

  it('scopes by userId for passenger role', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'passenger' } })
    mockBookingFindFirst.mockResolvedValue(null)
    await GET(new Request('http://localhost/api/bookings/bk1'), ctx('bk1'))
    const where = mockBookingFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('bk1')
    expect(where.userId).toBe('u1')
  })

  it('returns mapped booking payload on happy path', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockBookingFindFirst.mockResolvedValue({
      id: 'bk1', bookingRef: 'BR-1', status: 'CONFIRMED', totalPrice: 150,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
      user: { id: 'u1', fullName: 'Pax', email: 'p@bus.et', phone: 'p' },
      passengerFullName: 'Pax', passengerPhone: 'p', passengerEmail: 'p@bus.et',
      passengerIdNumber: null, passengerGender: null, passengerAge: null,
      emergencyContact: null, notes: null,
      payment: { status: 'PAID', method: 'CASH', amount: 150, paidAt: 'x', transactionRef: 't' },
      receipt: { id: 'r1', receiptNumber: 'RC-1', pdfUrl: null, emailedTo: 'p@bus.et', issuedAt: 'x' },
      paymentProofs: [{ id: 'pf1', fileUrl: 'u', fileName: 'f.png', fileType: 'image/png', createdAt: 'x', uploadedBy: { id: 'u1', fullName: 'Admin' } }],
      seats: [{ id: 'bs1', seat: { seatNumber: '1A', seatType: 'REGULAR' }, fare: 150 }],
      trip: { id: 't1', departAt: 'd', arriveAt: 'a', basePrice: 150, status: 'SCHEDULED',
        bus: { id: 'b1', plateNumber: 'AA-1', model: 'M', seatCount: 40, level: 'STANDARD', driverName: 'Dr', imageUrl: null, amenities: [], safetyChecklist: [], seatLayout: {}, company: { name: 'Co' } },
        route: { id: 'r1', originStation: { id: 's1', name: 'Origin', code: 'O' }, destinationStation: { id: 's2', name: 'Dest', code: 'D' } } },
    })

    const res: any = await GET(new Request('http://localhost/api/bookings/bk1'), ctx('bk1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('bk1')
    expect(data.passenger.name).toBe('Pax')
    expect(data.payment.status).toBe('PAID')
    expect(data.receipt.receiptNumber).toBe('RC-1')
    expect(data.paymentProofs[0].uploadedBy.name).toBe('Admin')
    expect(data.seats[0].seatNumber).toBe('1A')
    expect(data.trip.bus.companyName).toBe('Co')
    expect(data.trip.route.destination.code).toBe('D')
  })
})
