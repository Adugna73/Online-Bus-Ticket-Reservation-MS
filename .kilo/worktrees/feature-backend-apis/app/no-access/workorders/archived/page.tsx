import { redirect } from "next/navigation";

export const metadata = {
    title: "No Access - Archived Bookings",
};

export default function NoAccessArchivedWorkordersRedirectPage() {
    redirect("/no-access");
}
