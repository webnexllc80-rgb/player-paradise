import { NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/initDb';

export async function GET() {
  try {
    await ensureDbInitialized();
    return NextResponse.json({ success: true, message: 'Database initialized and seeded successfully.' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
