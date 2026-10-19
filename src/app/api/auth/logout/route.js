import { NextResponse } from 'next/server';

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}

  const referer = req.headers.get('referer') || '';
  const isAdminLogout = Boolean(body.isAdminLogout || referer.includes('/admin'));
  const logoutAll = Boolean(body.all);

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  if (isAdminLogout || logoutAll) {
    response.cookies.set('admin_session', '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
    });
    response.cookies.delete('admin_session');
  }

  if (!isAdminLogout || logoutAll) {
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
  }

  return response;
}
