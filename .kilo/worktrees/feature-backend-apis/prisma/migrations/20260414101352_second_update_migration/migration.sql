-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "passengerAge" INTEGER,
ADD COLUMN     "passengerEmail" TEXT,
ADD COLUMN     "passengerFullName" TEXT,
ADD COLUMN     "passengerGender" TEXT,
ADD COLUMN     "passengerIdNumber" TEXT,
ADD COLUMN     "passengerPhone" TEXT;

-- AlterTable
ALTER TABLE "Bus" ADD COLUMN     "amenities" JSONB,
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "safetyChecklist" JSONB,
ADD COLUMN     "seatLayout" JSONB;
