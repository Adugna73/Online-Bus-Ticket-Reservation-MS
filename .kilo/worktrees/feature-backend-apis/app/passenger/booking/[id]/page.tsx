import { redirect } from "next/navigation";

export default function PassengerBookingRedirect({
    params,
}: {
    params: { id: string };
}) {
    redirect(`/passenger/bookings/${params.id}`);
}
