import { NextResponse } from "next/server";
import { FEATURES } from "@/lib/features/registry";

// GET /api/features — discovery endpoint listing all 12 gap features, their
// status, priority, API prefix, and capabilities. Used by the features hub UI.
export async function GET() {
  return NextResponse.json({ features: FEATURES, count: FEATURES.length });
}
