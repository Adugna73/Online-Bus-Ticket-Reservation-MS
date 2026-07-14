import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const file = path.join(process.cwd(), 'data', 'maintenance-templates.json');
  const raw = fs.readFileSync(file, 'utf-8');
  const templates = JSON.parse(raw);
  return NextResponse.json(templates);
}
