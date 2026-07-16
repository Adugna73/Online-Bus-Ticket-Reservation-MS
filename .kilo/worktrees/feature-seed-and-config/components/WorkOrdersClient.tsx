"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import DataTable, { WorkOrderRow } from "./dashboard/DataTable";

type Booking = any;

type Props = {
    filterType?: string;
    allowCreateButton?: boolean;
};

const mapFilterToStatus = (filterType?: string) => {
    if (filterType === "processing") return "pending";
    if (filterType === "completed") return "completed";
    if (filterType === "archived") return "cancelled";
    return "";
};

export default function WorkOrdersClient({ filterType }: Props) {
    const { data: session } = useSession();
    const [bookings, setBookings] = useState<Booking[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const params = new URLSearchParams();
                const status = mapFilterToStatus(filterType);
                if (status) params.set("status", status);
                if (!params.has("take")) params.set("take", "500");

                const res = await fetch(`/api/bookings?${params.toString()}`);
                if (!res.ok) {
                    setBookings([]);
                    return;
                }
                const data = await res.json().catch(() => []);
                setBookings(data || []);
            } catch (err) {
                console.error("Error fetching bookings:", err);
                setBookings([]);
            }
        })();
    }, [filterType, session]);

    if (!session) {
        return (
            <div className="text-center py-8">
                <p className="text-foreground mb-4">
                    You need to log in to manage bookings.
                </p>
                <Link
                    href="/login"
                    className="bg-background text-foreground px-4 py-2 rounded"
                >
                    Go to Login
                </Link>
            </div>
        );
    }

    const tableRows: WorkOrderRow[] = bookings.map((booking: any) => {
        const origin = booking.trip?.route?.origin?.name || "-";
        const destination = booking.trip?.route?.destination?.name || "-";
        const routeLabel = `${origin} -> ${destination}`;
        const busPlate = booking.trip?.bus?.plateNumber || "-";
        const busModel = booking.trip?.bus?.model || "";
        const busLabel = busModel ? `${busPlate} - ${busModel}` : busPlate;
        const passengerLabel =
            booking.passenger?.name || booking.passenger?.email || "-";

        return {
            id: booking.id,
            bookingRef:
                booking.bookingRef || `BK-${String(booking.id).slice(0, 8)}`,
            route: routeLabel,
            bus: busLabel,
            passenger: passengerLabel,
            paymentStatus: String(booking.payment?.status || "-").toLowerCase(),
            status: String(booking.status || "pending").toLowerCase(),
            departAt: booking.trip?.departAt || null,
        };
    });

    return (
        <>
            <div className="md:hidden py-8 text-center text-sm text-muted-foreground">
                Bookings table is best viewed on desktop.
            </div>
            <div className="hidden h-full flex-1 flex-col gap-6 p-4 sm:p-6 md:flex">
                <DataTable rows={tableRows} />
            </div>
        </>
    );
}
