import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET Staff accounts
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Only Super Admin can manage staff.' }, { status: 403 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    const staffMembers = await usersCol
      .find({
        role: { $in: [ROLES.SUPER_ADMIN, ROLES.OPERATION_ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.COIN_MANAGER, ROLES.CHAT_SUPPORT] },
      })
      .toArray();

    return NextResponse.json({
      success: true,
      staff: staffMembers.map((s) => ({
        id: s._id ? s._id.toString() : s.id,
        username: s.username,
        email: s.email,
        role: s.role,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST Create new staff
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Only Super Admin can create staff accounts.' }, { status: 403 });
    }

    const body = await req.json();
    const { username, email, password, role } = body;

    if (!username || !email || !password || !role) {
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    const cleanEmail = email.toLowerCase().trim();
    const cleanUser = username.toLowerCase().trim();

    const exists = await usersCol.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUser }],
    });

    if (exists) {
      return NextResponse.json({ success: false, error: 'Username or email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newStaff = {
      username: cleanUser,
      email: cleanEmail,
      passwordHash,
      role,
      balanceSC: 1000.0,
      balanceGC: 100000,
      kycStatus: 'approved',
      createdAt: new Date(),
    };

    await usersCol.insertOne(newStaff);
    return NextResponse.json({ success: true, message: `Staff account created for ${cleanUser} with role ${role}` });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
