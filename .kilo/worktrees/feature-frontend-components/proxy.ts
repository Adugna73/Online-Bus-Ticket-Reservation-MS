import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ROLE_PATHS = ["admin", "manager", "supervisor", "technician"] as const;

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const roleMatch = pathname.match(
        /^\/(admin|manager|supervisor|technician)\/(bookings|workorders)(\/.*)?$/,
    );

    if (!roleMatch) {
        return NextResponse.next();
    }

    const role = roleMatch[1];
    const section = roleMatch[2];
    const rest = roleMatch[3] || "";

    if (section === "workorders") {
        const url = request.nextUrl.clone();
        url.pathname = `/${role}/bookings${rest}`;
        return NextResponse.redirect(url);
    }

    if (section === "bookings") {
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
