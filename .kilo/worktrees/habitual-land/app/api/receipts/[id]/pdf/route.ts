import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function formatDate(value?: Date | null) {
    if (!value) return "-";
    return value.toLocaleString();
}

// Chapa brand colors.
const CHAPA_PURPLE = rgb(0.42, 0.17, 0.85);
const CHAPA_GREEN = rgb(0.05, 0.7, 0.45);
const DARK = rgb(0.12, 0.12, 0.15);
const MUTED = rgb(0.45, 0.45, 0.5);
const LIGHT_BG = rgb(0.96, 0.95, 0.98);

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
        const passengerEmail =
            (booking as any).passengerEmail || booking.user?.email || "-";

        const seatNumbers = (booking.seats || [])
            .map((s) => s.seat?.seatNumber)
            .filter(Boolean)
            .join(", ") || "-";

        const method = String(booking.payment?.method || "-");
        const isChapa = ["TELEBIRR", "CBE_BIRR", "M_BIRR"].includes(method);
        const providerLabel = isChapa ? "Chapa" : method;

        const pdfDoc = await PDFDocument.create();
        const pageW = 400;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Build the body lines first to compute height.
        type Row = { label: string; value: string };
        const sections: { title: string; rows: Row[] }[] = [
            {
                title: "Passenger",
                rows: [
                    { label: "Name", value: passengerFullName },
                    { label: "ID", value: passengerId },
                    { label: "Phone", value: passengerPhone },
                    { label: "Email", value: passengerEmail },
                ],
            },
            {
                title: "Trip",
                rows: [
                    { label: "From", value: `${origin?.name || "-"} (${origin?.code || ""})` },
                    { label: "To", value: `${destination?.name || "-"} (${destination?.code || ""})` },
                    { label: "Depart", value: formatDate(booking.trip?.departAt || null) },
                    { label: "Arrive", value: formatDate(booking.trip?.arriveAt || null) },
                    { label: "Bus", value: booking.trip?.bus?.plateNumber || "-" },
                    { label: "Model", value: booking.trip?.bus?.model || "-" },
                    { label: "Seat(s)", value: seatNumbers },
                ],
            },
            {
                title: "Payment",
                rows: [
                    { label: "Amount", value: `${booking.totalPrice.toFixed(2)} ETB` },
                    { label: "Method", value: method },
                    { label: "Provider", value: providerLabel },
                    { label: "Tx Ref", value: booking.payment?.transactionRef || "-" },
                    { label: "Status", value: booking.payment?.status || "-" },
                    { label: "Paid at", value: formatDate(booking.payment?.paidAt || null) },
                ],
            },
        ];

        const margin = 24;
        const headerH = 70;
        const sectionTitleH = 22;
        const rowH = 16;
        const sectionGap = 10;
        const footerH = 40;

        let bodyH = 0;
        for (const s of sections) {
            bodyH += sectionTitleH + s.rows.length * rowH + sectionGap;
        }
        const pageH = headerH + bodyH + footerH + margin;
        const page = pdfDoc.addPage([pageW, pageH]);
        const { height: ph } = page.getSize();

        // Header band (Chapa purple).
        page.drawRectangle({ x: 0, y: ph - headerH, width: pageW, height: headerH, color: CHAPA_PURPLE });
        page.drawText("BUS TICKET RECEIPT", { x: margin, y: ph - 30, size: 16, font: bold, color: rgb(1, 1, 1) });
        page.drawText(`Receipt: ${receipt.receiptNumber}`, { x: margin, y: ph - 48, size: 9, font, color: rgb(0.9, 0.88, 0.95) });
        page.drawText(`Booking: ${booking.bookingRef}`, { x: margin, y: ph - 60, size: 9, font, color: rgb(0.9, 0.88, 0.95) });

        // Chapa badge in header (right side).
        if (isChapa) {
            const badgeW = 70;
            const badgeH = 22;
            const bx = pageW - margin - badgeW;
            const by = ph - 40;
            page.drawRectangle({ x: bx, y: by, width: badgeW, height: badgeH, color: rgb(1, 1, 1) });
            page.drawText("CHAPA", { x: bx + 16, y: by + 7, size: 11, font: bold, color: CHAPA_PURPLE });
        }

        // Body sections.
        let y = ph - headerH - 16;
        for (const s of sections) {
            // Section title.
            page.drawText(s.title.toUpperCase(), { x: margin, y, size: 10, font: bold, color: CHAPA_GREEN });
            y -= 6;
            // Light background bar for the section rows.
            const rowsH = s.rows.length * rowH + 6;
            page.drawRectangle({ x: margin - 4, y: y - rowsH, width: pageW - margin * 2 + 8, height: rowsH, color: LIGHT_BG });
            y -= rowH;
            for (const r of s.rows) {
                page.drawText(r.label, { x: margin, y, size: 9, font, color: MUTED });
                const valStr = r.value.length > 42 ? r.value.slice(0, 42) + "…" : r.value;
                page.drawText(valStr, { x: margin + 110, y, size: 9, font, color: DARK });
                y -= rowH;
            }
            y -= sectionGap;
        }

        // Footer.
        const footerY = margin;
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: footerH, color: CHAPA_GREEN });
        if (isChapa) {
            page.drawText("Powered by Chapa", { x: margin, y: footerY + 14, size: 9, font: bold, color: rgb(1, 1, 1) });
        } else {
            page.drawText("Bus Ticket System", { x: margin, y: footerY + 14, size: 9, font: bold, color: rgb(1, 1, 1) });
        }
        page.drawText(`Issued: ${formatDate(receipt.issuedAt || null)}`, { x: pageW - margin - 150, y: footerY + 14, size: 8, font, color: rgb(0.95, 0.97, 0.95) });

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
