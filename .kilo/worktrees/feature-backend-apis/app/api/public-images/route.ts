import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    const files = await fs.readdir(imagesDir);
    const imgs = files.filter((f) => /\.(png|jpe?g|svg|webp)$/i.test(f)).map((f) => `/images/${f}`);
    return NextResponse.json(imgs);
  } catch (err) {
    return NextResponse.json([], { status: 200 });
  }
}
