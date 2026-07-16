-- CreateTable
CREATE TABLE "BookingPaymentProof" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingPaymentProof_bookingId_idx" ON "BookingPaymentProof"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPaymentProof_uploadedById_idx" ON "BookingPaymentProof"("uploadedById");

-- AddForeignKey
ALTER TABLE "BookingPaymentProof" ADD CONSTRAINT "BookingPaymentProof_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPaymentProof" ADD CONSTRAINT "BookingPaymentProof_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
