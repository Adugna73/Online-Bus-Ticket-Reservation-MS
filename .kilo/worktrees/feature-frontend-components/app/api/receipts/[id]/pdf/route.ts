import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, StandardFonts } from "pdf-lib";

function formatDate(value?: Date | null) {
    if (!value) return "-";
    return value.toLocaleString();
}

export async function GET(
    _req: Request,
    context: { params: { id: string } },
) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const receiptId = String(params?.id || "").trim();
        if (!receiptId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const receipt = await prisma.receipt.findUnique({
            where: { id: receiptId },
            include: {
                booking: {
                    include: {
                        user: true,
                        payment: true,
                        seats: { include: { seat: true } },
                        trip: {
                            include: {
                                route: {
                                    include: {
                                        originStation: true,
                                        destinationStation: true,
                                    },
                                },
                                bus: true,
                            },
                        },
                    },
                },
            },
        });

        if (!receipt) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const booking = receipt.booking;
        if (!booking) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const userId = String(session.user.id);
        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey === "passenger" && booking.userId !== userId) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const origin = booking.trip?.route?.originStation;
        const destination = booking.trip?.route?.destinationStation;

            const passengerFullName =
                (booking as any).passengerFullName || booking.user?.fullName || "-";
            const passengerId = (booking as any).passengerIdNumber || "-";
            const passengerPhone =
                (booking as any).passengerPhone || booking.user?.phone || "-";

            const seatNumbers = (booking.seats || [])
                .map((s) => s.seat?.seatNumber)
                .filter(Boolean)
                .join(", ") || "-";

            const lines = [
                `Receipt: ${receipt.receiptNumber}`,
                `Booking: ${booking.bookingRef}`,
                "-----------------------------",
                `Passenger: ${passengerFullName}`,
                `ID: ${passengerId}`,
                `Phone: ${passengerPhone}`,
                "-----------------------------",
                `From: ${origin?.name || "-"} (${origin?.code || ""})`,
                `To: ${destination?.name || "-"} (${destination?.code || ""})`,
                `Booked: ${formatDate(booking.createdAt || null)}`,
                `Travel: ${formatDate(booking.trip?.departAt || null)}`,
                `Bus Plate: ${booking.trip?.bus?.plateNumber || "-"}`,
                `Bus Side: ${booking.trip?.bus?.sideNumber || "-"}`,
                `Bus Model: ${booking.trip?.bus?.model || "-"}`,
                `Seat: ${seatNumbers}`,
                "-----------------------------",
                `Amount: ${booking.totalPrice.toFixed(2)} ETB`,
                `Method: ${booking.payment?.method || "-"}`,
                `Paid: ${formatDate(booking.payment?.paidAt || null)}`,
                `Issued: ${formatDate(receipt.issuedAt || null)}`,
            ];

            const lineGap = 14;
            const topPadding = 24;
            const bottomPadding = 24;
            const titleGap = 20;
            const height =
                topPadding + titleGap + lines.length * lineGap + bottomPadding;

            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([260, height]);
            const { height: pageHeight } = page.getSize();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const left = 20;
            let y = pageHeight - topPadding;

            page.drawText("BUS TICKET RECEIPT", {
                x: left,
                y,
                size: 12,
                font: titleFont,
            });
            y -= titleGap;

            for (const line of lines) {
                page.drawText(line, { x: left, y, size: 10, font });
                y -= lineGap;
            }

            const pdfBytes = await pdfDoc.save();
            const body = new Uint8Array(pdfBytes);
        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${receipt.receiptNumber}.pdf"`,
            },
        });
    } catch (error) {
        console.error("[receipt] pdf failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
