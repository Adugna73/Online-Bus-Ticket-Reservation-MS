import { redirect } from "next/navigation";

export default function PassengerWorkordersDetailRedirect({
    params,
}: {
    params: { id: string };
}) {
    redirect(`/passenger/bookings/${params.id}`);
}
