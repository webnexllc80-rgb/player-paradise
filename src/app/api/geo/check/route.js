import { NextResponse } from 'next/server';
import { checkGeoAccess } from '@/lib/geoCheck';

export async function GET(req) {
  const result = checkGeoAccess(req);
  return NextResponse.json(result);
}
