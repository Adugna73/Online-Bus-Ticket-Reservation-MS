import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as chapa from "@/lib/services/chapa";

// Cancel an active Chapa transaction (expires the checkout link).
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const tx_ref = String(body?.tx_ref || "").trim();
    if (!tx_ref) {
      return NextResponse.json({ error: "tx_ref_required" }, { status: 400 });
    }
    const ok = await chapa.cancel(tx_ref);
    return NextResponse.json({ ok });
  } catch (error: any) {
    console.error("[chapa] cancel failed", error);
    return NextResponse.json(
      { error: error?.message || "server_error" },
      { status: 500 },
    );
  }
}
