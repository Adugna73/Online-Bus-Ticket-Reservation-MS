function normalizeRole(value: any): string {
    return String(value?.role?.key || value?.roleKey || value?.role || "")
        .trim()
        .toLowerCase();
}

export function isScopedHqAdminUser(_user: any): boolean {
    return false;
}

export function canManageAdminUsers(user: any): boolean {
    return normalizeRole(user) === "admin";
}
