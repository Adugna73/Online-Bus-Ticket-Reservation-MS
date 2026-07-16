import { NextResponse } from 'next/server';

const categories = [
  { id: 'pm', name: 'Planned Maintenance' },
  { id: 'reactive', name: 'Reactive / Repair' },
  { id: 'fiber', name: 'Fiber' },
  { id: 'transmission', name: 'Transmission' },
  { id: 'ip', name: 'IP Backbone' },
  { id: 'power', name: 'Power' },
];

export async function GET() {
  return NextResponse.json(categories);
}
