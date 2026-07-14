"use client";

import { Badge } from "../ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../ui/table";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export type BookingRow = {
    id: string | number;
    bookingRef: string;
    route: string;
    bus?: string;
    passenger?: string;
    paymentStatus?: string;
    status: string;
    departAt?: string;
};

const statusColor: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
> = {
    pending: "secondary",
    confirmed: "default",
    cancelled: "destructive",
    completed: "outline",
};

export function DataTable({ rows }: { rows: BookingRow[] }) {
    const router = useRouter();
    const { data: session } = useSession();
    const roleKey = String((session as any)?.user?.role || "").toLowerCase();
    const rolePath =
        roleKey === "admin"
            ? "admin"
            : roleKey === "manager"
              ? "manager"
              : roleKey === "supervisor"
                ? "supervisor"
                : "passenger";

    const formatDate = (iso?: string) => {
        if (!iso) return "-";
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Bookings</CardTitle>
                    <CardDescription>
                        Latest items across statuses
                    </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                    {rows.length} items
                </Badge>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <table className="min-w-full text-sm">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Booking Ref</TableHead>
                                <TableHead>Route</TableHead>
                                <TableHead>Bus</TableHead>
                                <TableHead>Passenger</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Departure</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="text-center text-muted-foreground"
                                    >
                                        No bookings yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium">
                                        {row.bookingRef}
                                    </TableCell>
                                    <TableCell>{row.route}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {row.bus || "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {row.passenger || "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {row.paymentStatus || "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        <Badge
                                            variant={
                                                statusColor[row.status] ||
                                                "outline"
                                            }
                                        >
                                            {row.status.replace("_", " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(row.departAt)}
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            className="text-xs underline"
                                            onClick={() =>
                                                router.push(
                                                    `/${rolePath}/bookings/${row.id}`,
                                                )
                                            }
                                        >
                                            Details
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </Table>
            </CardContent>
        </Card>
    );
}

export default DataTable;
