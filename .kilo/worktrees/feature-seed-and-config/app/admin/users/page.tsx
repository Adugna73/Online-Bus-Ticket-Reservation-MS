import DashboardShell from "@/components/DashboardShell";
import UsersClient from "@/components/UsersClient";

export default function AdminUsersPage() {
    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-6">
                <UsersClient />
            </div>
        </DashboardShell>
    );
}
