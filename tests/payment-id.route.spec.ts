import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
import { getServerSession } from 'next-auth/next'

const {
  mockPaymentFindUnique,
  mockEscrowFindUnique,
  mockRefundFindMany,
  mockReceiptFindUnique,
  mockReceiptCreate,
  mockReceiptUpdate,
  mockReceiptFindUniqueOrThrow,
  mockGetAuditLog,
} = vi.hoisted(() => ({
  mockPaymentFindUnique: vi.fn(),
  mockEscrowFindUnique: vi.fn(),
  mockRefundFindMany: vi.fn(),
  mockReceiptFindUnique: vi.fn(),
  mockReceiptCreate: vi.fn(),
  mockReceiptUpdate: vi.fn(),
  mockReceiptFindUniqueOrThrow: vi.fn(),
  mockGetAuditLog: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findUnique: mockPaymentFindUnique },
    escrow: { findUnique: mockEscrowFindUnique },
    refund: { findMany: mockRefundFindMany },
    receipt: { findUnique: mockReceiptFindUnique, create: mockReceiptCreate, update: mockReceiptUpdate, findUniqueOrThrow: mockReceiptFindUniqueOrThrow },
  },
}))
vi.mock('@/lib/services/payments', () => ({ getAuditLog: mockGetAuditLog }))

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

let GET: any
beforeEach(async () => {
  vi.clearAllMocks()
  mockRefundFindMany.mockResolvedValue([])
  mockGetAuditLog.mockResolvedValue([])
  const mod = await import('@/app/api/payments/[id]/route')
  GET = mod.GET
})

const basePayment = {
  id: 'p1', bookingId: 'b1', method: 'CASH', status: 'PAID', amount: 100,
  transactionRef: 't', paidAt: 'x', createdAt: 'c',
  booking: { id: 'b1', bookingRef: 'BR-1', status: 'CONFIRMED', totalPrice: 100, userId: 'u1' },
}

describe('GET /api/payments/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as any).mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/payments/p1'), ctx('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 not_found when payment missing', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindUnique.mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/payments/ghost'), ctx('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns 403 forbidden when booking belongs to another user', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindUnique.mockResolvedValue({ ...basePayment, booking: { ...basePayment.booking, userId: 'u2' } })
    const res: any = await GET(new Request('http://localhost/api/payments/p1'), ctx('p1'))
    expect(res.status).toBe(403)
  })

  it('returns detail with escrow + receipt when receipt exists', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindUnique.mockResolvedValue(basePayment)
    mockEscrowFindUnique.mockResolvedValue({ id: 'e1', bookingId: 'b1', amount: 100, status: 'HELD', heldAt: 'h', releasedAt: null })
    mockReceiptFindUnique.mockResolvedValue({ id: 'r1', receiptNumber: 'RC-1', issuedAt: 'i', chapaReceiptUrl: null })
    const res: any = await GET(new Request('http://localhost/api/payments/p1'), ctx('p1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.payment.id).toBe('p1')
    expect(data.escrow.status).toBe('HELD')
    expect(data.receipt.receiptNumber).toBe('RC-1')
    expect(mockReceiptCreate).not.toHaveBeenCalled()
  })

  it('auto-creates a receipt for PAID payment missing one', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindUnique.mockResolvedValue(basePayment)
    mockEscrowFindUnique.mockResolvedValue(null)
    mockReceiptFindUnique.mockResolvedValueOnce(null) // no existing receipt
    mockReceiptCreate.mockResolvedValue({ id: 'rnew', receiptNumber: 'RC-new' })
    mockReceiptUpdate.mockResolvedValue({ id: 'rnew' })
    mockReceiptFindUniqueOrThrow.mockResolvedValue({ id: 'rnew', receiptNumber: 'RC-new', issuedAt: 'i', chapaReceiptUrl: null })
    const res: any = await GET(new Request('http://localhost/api/payments/p1'), ctx('p1'))
    expect(res.status).toBe(200)
    expect(mockReceiptCreate).toHaveBeenCalled()
    const data = await res.json()
    expect(data.receipt.receiptNumber).toBe('RC-new')
  })

  it('skips receipt auto-create for non-PAID payment', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: { id: 'u1' } })
    mockPaymentFindUnique.mockResolvedValue({ ...basePayment, status: 'PENDING' })
    mockEscrowFindUnique.mockResolvedValue(null)
    mockReceiptFindUnique.mockResolvedValue(null)
    const res: any = await GET(new Request('http://localhost/api/payments/p1'), ctx('p1'))
    expect(res.status).toBe(200)
    expect(mockReceiptCreate).not.toHaveBeenCalled()
    expect((await res.json()).receipt).toBeNull()
  })
})
