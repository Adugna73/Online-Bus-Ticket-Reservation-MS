import Link from "next/link";

export const metadata = {
    title: "Access Required",
};

export default function NoAccessPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
            <div className="max-w-2xl text-center py-20">
                <h1 className="text-3xl font-semibold mb-4">
                    You don&apos;t have access
                </h1>
                <p className="text-muted mb-6">
                    It looks like your account is authenticated but not
                    authorized for this system. contact your administrator.
                </p>

                <div className="flex items-center justify-center gap-4">
                    <a
                        href="mailto:it-helpdesk@ethiotelecom.et?subject=Request%20Access%20to%20PM%20System"
                        className="rounded-md bg-primary px-4 py-2 text-white font-medium shadow hover:brightness-95"
                    >
                        Request access via email
                    </a>

                    <Link
                        href="/login"
                        className="rounded-md border px-4 py-2 text-sm text-muted hover:underline"
                    >
                        Back to login
                    </Link>
                </div>

                <p className="text-xs text-muted mt-6">
                    If you recently were added to the staff list, it may take a
                    minute to propagate. Try signing out and signing in again.
                </p>
            </div>
        </main>
    );
}
