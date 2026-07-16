import { redirect } from "next/navigation";

export const metadata = {
    title: "No Access - Bookings",
};

export default function NoAccessWorkordersRedirectPage() {
    redirect("/no-access");
}
