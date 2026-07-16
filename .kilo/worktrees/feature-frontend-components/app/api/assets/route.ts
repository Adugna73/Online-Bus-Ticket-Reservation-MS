import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
    const assets = await prisma.asset.findMany({ include: { site: true } });
    return NextResponse.json(assets);
}
