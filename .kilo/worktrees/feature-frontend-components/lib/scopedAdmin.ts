const SCOPED_HQ_ADMIN_EMAILS = new Set([
    "buzayehu.fininsa@ethiotelecom.et",
    "fekadu.dagnachew@ethiotelecom.et",
]);

const SCOPED_HQ_ADMIN_NAMES = new Set([
    "BUZAYEHU FININSA MULETA",
    "FEKADU DAGNACHEW DAFI",
]);

function normalizeEmail(value: unknown): string {
    return String(value || "").trim().toLowerCase();
}

function normalizeName(value: unknown): string {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}

export function isScopedHqAdminUser(user: any): boolean {
    const role = String(user?.role?.key || user?.roleKey || user?.role || "")
        .trim()
        .toLowerCase();
    if (role !== "admin") return false;

    const email = normalizeEmail(user?.email);
    const name = normalizeName(user?.fullName || user?.name);

    return (
        SCOPED_HQ_ADMIN_EMAILS.has(email) ||
        SCOPED_HQ_ADMIN_NAMES.has(name)
    );
}

export function canManageAdminUsers(user: any): boolean {
    const role = String(user?.role?.key || user?.roleKey || user?.role || "")
        .trim()
        .toLowerCase();
    return role === "admin" && !isScopedHqAdminUser(user);
}