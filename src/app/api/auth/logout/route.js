import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  // Explicitly invalidate cookies with maxAge 0 and path /
  response.cookies.set('vegas_session', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
  });
  response.cookies.set('players_session', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
  });
  response.cookies.delete('vegas_session');
  response.cookies.delete('players_session');

  return response;
}
