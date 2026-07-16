import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { updateCorporate } from "@/lib/services/enterprise";

async function requireAdmin() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return { status: 401, error: "unauthorized" } as const;
  }
  const role = String(session.user.role || "").toLowerCase();
  if (role !== "admin") {
    return { status: 403, error: "forbidden" } as const;
  }
  return { status: 200, session } as const;
}

// PATCH: update a corporate account.
export async function PATCH(
  req: Request,
  context: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const id = String(params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id_required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const corporate = await updateCorporate(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      billingEmail:
        body.billingEmail !== undefined
          ? body.billingEmail
            ? String(body.billingEmail)
            : null
          : undefined,
      creditLimit:
        body.creditLimit !== undefined ? Number(body.creditLimit) : undefined,
    });

    return NextResponse.json({ corporate });
  } catch (error) {
    console.error("[enterprise] PATCH failed", error);
    const msg = String((error as any)?.message || "");
    if (msg === "name_required") {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
