import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
    const body = await req.json();
    // Normalize site reference: accept either `siteId` (UUID) or `siteCode`/numeric code supplied by clients
    try {
        let siteId = body.siteId;
        // if siteId not provided but siteCode given, resolve it
        if (!siteId && body.siteCode) {
            const found = await prisma.site.findFirst({ where: { siteCode: String(body.siteCode) } });
            if (!found) return NextResponse.json({ error: 'site_not_found', siteCode: body.siteCode }, { status: 400 });
            siteId = found.id;
        }

        // If siteId provided but doesn't match an existing site id, attempt to resolve as siteCode
        if (siteId) {
            const exists = await prisma.site.findUnique({ where: { id: String(siteId) } });
            if (!exists) {
                // try by siteCode
                const byCode = await prisma.site.findFirst({ where: { siteCode: String(siteId) } });
                if (byCode) siteId = byCode.id;
                else return NextResponse.json({ error: 'site_not_found', siteId: body.siteId }, { status: 400 });
            }
        }

        const data = { ...body, siteId };
        const asset = await prisma.asset.create({ data });
        return NextResponse.json(asset);
    } catch (err: any) {
        console.error('Error creating asset:', err);
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
}
