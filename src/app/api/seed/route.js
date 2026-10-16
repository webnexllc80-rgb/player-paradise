import { NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/initDb';

export async function GET() {
  const ok = await ensureDbInitialized();
  return NextResponse.json({
    success: ok,
    message: ok ? 'Database initialized successfully' : 'Database initialization encountered an issue',
  });
}
